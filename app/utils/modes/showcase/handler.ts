import { ModeHandler, MoveData, SignedMovePackage, GameEndResult, StorageResult } from '../types';
import { hashMovePackage, computeAnchorHash, verifyChain, computeGameHash, MovePackageData } from '../normal/hash-chain';
import { getMoveSigner } from '../normal/move-signer';
import { updateGameOnChain, LiveGameState } from './live-storage';
import { createGameSubId } from '../normal/subid-storage';
import { getPlayerName } from '@/app/utils/verus-rpc';
import { getGameConfig } from '@/app/games/registry';
import { prisma } from '@/lib/prisma';

export const showcaseHandler: ModeHandler = {

  async onMove(game: any, moveData: MoveData): Promise<SignedMovePackage> {
    const signer = getMoveSigner();
    const config = getGameConfig(game.gameType || 'chess');

    let session = await prisma.gameSession.findUnique({ where: { gameId: game.id } });
    if (!session) {
      session = await prisma.gameSession.create({ data: { gameId: game.id } });
    }
    const subIdName = session.subIdName || game.id;

    const moveNum = await prisma.move.count({ where: { gameId: game.id } }) + 1;

    let prevHash: string;
    if (moveNum === 1) {
      const p1 = game.player1?.verusId || game.player1Id;
      const p2 = game.player2?.verusId || game.player2Id;
      prevHash = computeAnchorHash(subIdName, p1, p2);
    } else {
      const prevMove = await prisma.move.findFirst({
        where: { gameId: game.id },
        orderBy: { createdAt: 'desc' },
      });
      if (prevMove?.movePackage) {
        prevHash = hashMovePackage(prevMove.movePackage as MovePackageData);
      } else {
        const p1 = game.player1?.verusId || game.player1Id;
        const p2 = game.player2?.verusId || game.player2Id;
        prevHash = computeAnchorHash(subIdName, p1, p2);
      }
    }

    const movePackage: MovePackageData = {
      subIdName,
      player: moveData.player,
      moveNum,
      move: moveData.move,
      prevHash,
    };

    const canonical = JSON.stringify(movePackage, Object.keys(movePackage).sort());
    const signature = signer.sign(canonical);

    // Get all moves including this new one for the chain update
    const existingMoves = await prisma.move.findMany({
      where: { gameId: game.id },
      orderBy: { createdAt: 'asc' },
    });
    const allMoveStrings = [...existingMoves.map(m => m.move), moveData.move];

    const fullGame = await prisma.game.findUnique({
      where: { id: game.id },
      include: { player1: true, player2: true },
    });

    const player1Name = fullGame?.player1 ? getPlayerName(fullGame.player1) : '';
    const player2Name = fullGame?.player2 ? getPlayerName(fullGame.player2) : '';

    const liveState: LiveGameState = {
      white: player1Name,
      black: player2Name,
      moves: allMoveStrings,
      moveCount: allMoveStrings.length,
      startedAt: Math.floor((fullGame?.createdAt?.getTime() || Date.now()) / 1000),
      mode: 'showcase',
      status: 'in_progress',
      whiteOpenSig: session.player1OpeningSig || '',
      blackOpenSig: session.player2OpeningSig || '',
    };

    // Fire chain update in the background — don't block the move/socket relay
    (async () => {
      try {
        if (!session.subIdAddress) {
          // Fallback: pool was empty, create SubID on-the-fly
          console.log(`[Showcase] No pool SubID for ${subIdName}, creating on-the-fly...`);
          const subIdResult = await createGameSubId(subIdName, config.parentIdentityAddress, config.parentIdentityName);
          await prisma.gameSession.update({
            where: { gameId: game.id },
            data: { subIdAddress: subIdResult.address },
          });
        } else {
          console.log(`[Showcase] Using pool SubID ${subIdName} (${session.subIdAddress})`);
        }
        await updateGameOnChain(subIdName, liveState, config.vdxfKeys, config.parentIdentityName);
      } catch (error: any) {
        console.error(`[Showcase] Live chain update failed for move ${moveNum}:`, error.message);
      }
    })();

    return { ...movePackage, signature };
  },

  async onGameEnd(game: any): Promise<GameEndResult> {
    const signer = getMoveSigner();

    const fullGame = await prisma.game.findUnique({
      where: { id: game.id },
      include: { player1: true, player2: true, moves: { orderBy: { createdAt: 'asc' } } },
    });
    if (!fullGame) throw new Error(`Game not found: ${game.id}`);

    const session = await prisma.gameSession.findUnique({ where: { gameId: game.id } });
    const subIdName = session?.subIdName || game.id;

    const packages: MovePackageData[] = fullGame.moves
      .filter(m => m.movePackage)
      .map(m => m.movePackage as MovePackageData);

    const verification = verifyChain(
      subIdName,
      fullGame.player1.verusId,
      fullGame.player2.verusId,
      packages,
    );

    if (!verification.valid) {
      console.error(`[Showcase] Chain verification failed for game ${game.id}:`, verification.error);
      return { gameHash: '', player1FinalSig: '', player2FinalSig: '', verified: false };
    }

    const gameHash = computeGameHash(packages);

    // For showcase mode, only store the gameHash and verification timestamp.
    // Do NOT overwrite player1FinalSig/player2FinalSig — those come from player
    // signmessage submissions via the showcase-sign API. (fix #2)
    if (session) {
      await prisma.gameSession.update({
        where: { gameId: game.id },
        data: { gameHash, verifiedAt: new Date() },
      });
    }

    return { gameHash, player1FinalSig: '', player2FinalSig: '', verified: true };
  },

  async storeOnChain(game: any): Promise<StorageResult> {
    const config = getGameConfig(game.gameType || 'chess');
    const fullGame = await prisma.game.findUnique({
      where: { id: game.id },
      include: { player1: true, player2: true, moves: { orderBy: { createdAt: 'asc' } } },
    });
    if (!fullGame) return { success: false, error: 'Game not found' };

    const session = await prisma.gameSession.findUnique({ where: { gameId: game.id } });
    if (!session?.gameHash) return { success: false, error: 'Game not verified' };

    const subIdName = session.subIdName || game.id;
    const moves = fullGame.moves.map(m => m.move);
    const moveSigs = fullGame.moves.filter(m => m.signature).map(m => m.signature as string);
    const duration = Math.floor((fullGame.updatedAt.getTime() - fullGame.createdAt.getTime()) / 1000);

    const player1Name = fullGame.player1.displayName
      ? `${fullGame.player1.displayName}@`
      : fullGame.player1.verusId;
    const player2Name = fullGame.player2.displayName
      ? `${fullGame.player2.displayName}@`
      : fullGame.player2.verusId;

    let winnerName = '';
    if (fullGame.winner) {
      if (fullGame.winner === fullGame.player1Id) winnerName = player1Name;
      else if (fullGame.winner === fullGame.player2Id) winnerName = player2Name;
      else winnerName = fullGame.winner;
    }

    const finalState: LiveGameState = {
      white: player1Name,
      black: player2Name,
      moves,
      moveCount: moves.length,
      startedAt: Math.floor(fullGame.createdAt.getTime() / 1000),
      mode: 'showcase',
      status: 'completed',
      whiteOpenSig: session.player1OpeningSig || '',   // opening sigs from dedicated columns
      blackOpenSig: session.player2OpeningSig || '',
      winner: winnerName,
      result: fullGame.status === 'COMPLETED' ? 'checkmate' : fullGame.status.toLowerCase(),
      duration,
      gameHash: session.gameHash,
      whiteSig: session.player1FinalSig || '',          // closing sigs from dedicated columns
      blackSig: session.player2FinalSig || '',
      moveSigs,
    };

    try {
      const { txid } = await updateGameOnChain(subIdName, finalState, config.vdxfKeys, config.parentIdentityName);
      await prisma.gameSession.update({
        where: { gameId: game.id },
        data: { storedAt: new Date(), txId: txid },
      });
      // Also update Game.blockchainTxId so GameOver shows 'stored' on reload
      await prisma.game.update({
        where: { id: game.id },
        data: { blockchainTxId: txid, blockchainStoredAt: new Date() },
      });
      return { success: true, transactionId: txid, subIdName, subIdAddress: session.subIdAddress || '' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
};

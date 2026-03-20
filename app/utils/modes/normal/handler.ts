import { ModeHandler, MoveData, SignedMovePackage, GameEndResult, StorageResult } from '../types';
import { hashMovePackage, computeAnchorHash, verifyChain, computeGameHash, MovePackageData } from './hash-chain';
import { getMoveSigner } from './move-signer';
import { createGameSubId, storeGameData, GameData } from './subid-storage';
import { getPlayerName } from '@/app/utils/verus-rpc';
import { getGameConfig } from '@/app/games/registry';
import { prisma } from '@/lib/prisma';

export const normalHandler: ModeHandler = {

  async onMove(game: any, moveData: MoveData): Promise<SignedMovePackage> {
    const signer = getMoveSigner();

    // Get the GameSession for this game
    let session = await prisma.gameSession.findUnique({ where: { gameId: game.id } });
    if (!session) {
      // Create GameSession on first move (if not created at game creation)
      session = await prisma.gameSession.create({
        data: { gameId: game.id },
      });
    }

    // Determine subIdName from GameSession or game counter
    const subIdName = session.subIdName || game.id;

    // Get move count for moveNum
    const moveNum = await prisma.move.count({ where: { gameId: game.id } }) + 1;

    // Compute prevHash
    let prevHash: string;
    if (moveNum === 1) {
      // Anchor hash for first move
      const p1 = game.player1?.verusId || game.player1Id;
      const p2 = game.player2?.verusId || game.player2Id;
      prevHash = computeAnchorHash(subIdName, p1, p2);
    } else {
      // Hash of previous move package
      const prevMove = await prisma.move.findFirst({
        where: { gameId: game.id },
        orderBy: { createdAt: 'desc' },
      });
      if (prevMove?.movePackage) {
        prevHash = hashMovePackage(prevMove.movePackage as MovePackageData);
      } else {
        // Fallback: recompute from beginning
        const allMoves = await prisma.move.findMany({
          where: { gameId: game.id },
          orderBy: { createdAt: 'asc' },
        });
        if (allMoves.length === 0) {
          const p1 = game.player1?.verusId || game.player1Id;
          const p2 = game.player2?.verusId || game.player2Id;
          prevHash = computeAnchorHash(subIdName, p1, p2);
        } else {
          const lastMove = allMoves[allMoves.length - 1];
          prevHash = hashMovePackage(lastMove.movePackage as MovePackageData);
        }
      }
    }

    // Build move package
    const movePackage: MovePackageData = {
      subIdName,
      player: moveData.player,
      moveNum,
      move: moveData.move,
      prevHash,
    };

    // Sign the package
    const canonical = JSON.stringify(movePackage, Object.keys(movePackage).sort());
    const signature = signer.sign(canonical);

    return {
      ...movePackage,
      signature,
    };
  },

  async onGameEnd(game: any): Promise<GameEndResult> {
    const signer = getMoveSigner();

    // Load the full game with players
    const fullGame = await prisma.game.findUnique({
      where: { id: game.id },
      include: { player1: true, player2: true, moves: { orderBy: { createdAt: 'asc' } } },
    });
    if (!fullGame) {
      throw new Error(`Game not found: ${game.id}`);
    }

    const session = await prisma.gameSession.findUnique({ where: { gameId: game.id } });
    const subIdName = session?.subIdName || game.id;

    // Rebuild move packages from DB
    const packages: MovePackageData[] = fullGame.moves
      .filter(m => m.movePackage)
      .map(m => m.movePackage as MovePackageData);

    // Verify the entire chain
    const verification = verifyChain(
      subIdName,
      fullGame.player1.verusId,
      fullGame.player2.verusId,
      packages,
    );

    if (!verification.valid) {
      console.error(`[Normal] Chain verification failed for game ${game.id}:`, verification.error);
      // Update GameSession to flag verification failure
      if (session) {
        await prisma.gameSession.update({
          where: { gameId: game.id },
          data: { verifiedAt: null },
        });
      }
      return {
        gameHash: '',
        player1FinalSig: '',
        player2FinalSig: '',
        verified: false,
      };
    }

    // Compute final game hash
    const gameHash = computeGameHash(packages);

    // Sign on behalf of both players (Phase 1: same server key)
    const player1FinalSig = signer.sign(gameHash);
    const player2FinalSig = signer.sign(gameHash);

    // Update GameSession
    if (session) {
      await prisma.gameSession.update({
        where: { gameId: game.id },
        data: {
          gameHash,
          player1FinalSig,
          player2FinalSig,
          verifiedAt: new Date(),
        },
      });
    }

    return {
      gameHash,
      player1FinalSig,
      player2FinalSig,
      verified: true,
    };
  },

  async storeOnChain(game: any): Promise<StorageResult> {
    // Load full game data
    const fullGame = await prisma.game.findUnique({
      where: { id: game.id },
      include: { player1: true, player2: true, moves: { orderBy: { createdAt: 'asc' } } },
    });
    if (!fullGame) {
      return { success: false, error: 'Game not found' };
    }

    const session = await prisma.gameSession.findUnique({ where: { gameId: game.id } });
    if (!session) {
      return { success: false, error: 'No GameSession found — run onGameEnd first' };
    }
    if (!session.gameHash || !session.verifiedAt) {
      return { success: false, error: 'Game not verified — run onGameEnd first' };
    }

    const subIdName = session.subIdName || game.id;

    // Load game config for VDXF keys and parent identity
    const config = getGameConfig(fullGame.gameType || 'chess');

    try {
      // Step 1: Create SubID (skips if already exists)
      let subIdAddress = session.subIdAddress;
      if (!subIdAddress) {
        const subIdResult = await createGameSubId(subIdName, config.parentIdentityAddress, config.parentIdentityName);
        subIdAddress = subIdResult.address;
        await prisma.gameSession.update({
          where: { gameId: game.id },
          data: { subIdAddress },
        });
      }

      // Step 2: Store game data on the SubID
      const duration = Math.floor((fullGame.updatedAt.getTime() - fullGame.createdAt.getTime()) / 1000);
      const moves = fullGame.moves.map(m => m.move);

      // Collect per-move signatures if tournament storage requested
      const includeMovesSigs = (game as any)._includeMovesSigs === true;
      const moveSigs = includeMovesSigs
        ? fullGame.moves.filter(m => m.signature).map(m => m.signature as string)
        : undefined;

      // Resolve winner from Prisma cuid to VerusID
      let winnerVerusId = '';
      if (fullGame.winner) {
        if (fullGame.winner === fullGame.player1Id) {
          winnerVerusId = fullGame.player1.verusId;
        } else if (fullGame.winner === fullGame.player2Id) {
          winnerVerusId = fullGame.player2.verusId;
        } else {
          winnerVerusId = fullGame.winner; // Already a verusId or 'DRAW'
        }
      }

      const player1Name = getPlayerName(fullGame.player1);
      const player2Name = getPlayerName(fullGame.player2);

      let winnerDisplayName = '';
      if (winnerVerusId) {
        if (winnerVerusId === fullGame.player1.verusId) {
          winnerDisplayName = player1Name;
        } else if (winnerVerusId === fullGame.player2.verusId) {
          winnerDisplayName = player2Name;
        } else {
          winnerDisplayName = winnerVerusId; // 'DRAW' or already a name
        }
      }

      const gameData: GameData = {
        player1Name,
        player2Name,
        winner: winnerDisplayName,
        result: fullGame.status === 'COMPLETED' ? 'checkmate' : fullGame.status.toLowerCase(),
        moves,
        moveCount: moves.length,
        duration,
        startedAt: Math.floor(fullGame.createdAt.getTime() / 1000),
        gameHash: session.gameHash,
        player1Sig: session.player1FinalSig || '',
        player2Sig: session.player2FinalSig || '',
        mode: includeMovesSigs ? 'tournament' : ((fullGame as any).mode || 'normal'),
        moveSigs,
      };

      const { txid } = await storeGameData(subIdName, gameData, config.vdxfKeys, config.parentIdentityName);

      // Update session with storage info
      await prisma.gameSession.update({
        where: { gameId: game.id },
        data: {
          storedAt: new Date(),
          txId: txid,
        },
      });

      return {
        success: true,
        transactionId: txid,
        subIdName,
        subIdAddress,
      };
    } catch (error: any) {
      console.error(`[Normal] storeOnChain failed for game ${game.id}:`, error);
      return {
        success: false,
        error: error.message || 'Failed to store on chain',
      };
    }
  },
};

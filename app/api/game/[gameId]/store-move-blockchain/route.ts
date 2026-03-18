import { NextRequest, NextResponse } from 'next/server';
import { BlockchainMoveStorageBasic } from '@/app/utils/blockchain-move-storage-basic';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

export async function POST(req: NextRequest, { params }: { params: { gameId: string } }) {
  const resolvedParams = await params;
  const { gameId } = resolvedParams;

  // Check game mode — Normal mode handles move signing through the /move route
  const gameForMode = await prisma.game.findUnique({ where: { id: gameId }, select: { mode: true } });
  if (gameForMode?.mode === 'normal') {
      return NextResponse.json({
          success: true,
          message: 'Normal mode: moves are signed via the server action, not stored individually on-chain',
      });
  }
  const reqBody = await req.json();
  const { move, player } = reqBody;

  // Calculate moveIndex if not provided
  let moveIndex = typeof reqBody.moveIndex === 'number' ? reqBody.moveIndex : undefined;
  if (moveIndex === undefined) {
    // Count all moves for this game to determine the index
    moveIndex = await prisma.move.count({ where: { gameId } });
  }

  console.log(`[store-move-blockchain] Called for gameId: ${gameId}, move: ${move}, player: ${player}, moveIndex: ${moveIndex}`);

  // 1. Atomic lock: set processing flag for this move
  let processingResult;
  try {
    processingResult = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Find or create the move
      let dbMove = await tx.move.findFirst({ where: { gameId, move }, orderBy: { createdAt: 'asc' } });
      if (!dbMove) {
        dbMove = await tx.move.create({
          data: {
            gameId,
            move,
            createdAt: new Date(),
          },
        });
      }
      // Check if already stored on chain
      if (dbMove.blockchainTxId && dbMove.blockchainTxId !== 'PROCESSING') {
        return {
          success: true,
          message: 'Move already stored on blockchain',
          transactionId: dbMove.blockchainTxId,
          vdxfKey: dbMove.blockchainVdxfKey
        };
      }
      // Check if currently being processed
      if (dbMove.blockchainTxId === 'PROCESSING') {
        return {
          success: false,
          message: 'Move is currently being processed for blockchain storage',
          status: 'processing',
          code: 409
        };
      }
      // Set processing flag atomically
      const processingUpdate = await tx.move.updateMany({
        where: {
          id: dbMove.id,
          blockchainTxId: null,
        },
        data: {
          blockchainTxId: 'PROCESSING',
          blockchainStoredAt: new Date(),
        },
      });
      if (processingUpdate.count === 0) {
        return {
          success: false,
          message: 'Move is already being processed for blockchain storage',
          status: 'processing',
          code: 409
        };
      }
      return { dbMove };
    });
  } catch (err) {
    console.error('[store-move-blockchain] Transaction error:', err);
    return NextResponse.json({ success: false, error: 'Database transaction error' }, { status: 500 });
  }

  // Handle early returns from transaction
  if (processingResult && processingResult.success === true) {
    return NextResponse.json(processingResult);
  }
  if (processingResult && processingResult.status === 'processing') {
    return NextResponse.json({
      success: false,
      message: processingResult.message,
      status: 'processing'
    }, { status: processingResult.code || 409 });
  }

  // 2. Now do blockchain work outside transaction
  const dbMove = processingResult.dbMove;
  if (!dbMove) {
    return NextResponse.json({ success: false, error: 'Move not found after transaction' }, { status: 404 });
  }

  // Fetch the previous move's blockchain txid (if any)
  let previousTxid = null;
  const prevMove = await prisma.move.findFirst({
    where: {
      gameId,
      createdAt: { lt: dbMove.createdAt },
    },
    orderBy: { createdAt: 'desc' },
  });
  if (prevMove && prevMove.blockchainTxId && prevMove.blockchainTxId !== 'PROCESSING') {
    previousTxid = prevMove.blockchainTxId;
  }

  // 3. Store move on chain, waiting for previous confirmation if needed
  const blockchain = new BlockchainMoveStorageBasic();
  let result: { success?: boolean; transactionId?: string; vdxfKey?: string; error?: string };
  try {
    result = await blockchain.storeMoveAlternatingIdentities(
      { gameId, move, player },
      moveIndex,
    );
    console.log(`[store-move-blockchain] Blockchain result:`, result);
  } catch (blockchainError) {
    console.error('[store-move-blockchain] Blockchain exception:', blockchainError);
    // Clear processing flag on failure
    try {
      await prisma.move.update({
        where: { id: dbMove.id },
        data: { blockchainTxId: null, blockchainStoredAt: null }
      });
    } catch (clearError) {
      console.error('Failed to clear processing flag after blockchain exception:', clearError);
    }
    const errorMsg = (typeof blockchainError === 'object' && blockchainError && 'message' in blockchainError) ? (blockchainError as any).message : String(blockchainError);
    return NextResponse.json({ success: false, error: errorMsg || 'Blockchain storage threw exception' }, { status: 500 });
  }

  if (!result || typeof result['success'] === 'undefined') {
    console.error('Blockchain storage failed: No result returned');
    await prisma.move.update({
      where: { id: dbMove.id },
      data: { blockchainTxId: null, blockchainStoredAt: null }
    });
    return NextResponse.json({ success: false, error: 'Blockchain storage failed: No result returned' }, { status: 500 });
  }

  // Handle the result
  if (!result['success']) {
    const errMsg = typeof (result as any).error === 'string' ? (result as any).error.toLowerCase() : '';
    if (
      errMsg.includes('already in chain') ||
      errMsg.includes('already in mempool') ||
      errMsg.includes('transaction already exists')
    ) {
      // Treat as success
      await prisma.move.update({
        where: { id: dbMove.id },
        data: {
          blockchainTxId: result['transactionId'] || 'ALREADY_IN_CHAIN',
          blockchainVdxfKey: result['vdxfKey'],
          blockchainStoredAt: new Date(),
        }
      });
      return NextResponse.json({
        success: true,
        message: 'Transaction already in chain or mempool',
        transactionId: result['transactionId'] || 'ALREADY_IN_CHAIN',
        vdxfKey: result['vdxfKey'] || null
      });
    }
    // Clear processing flag on failure
    await prisma.move.update({
      where: { id: dbMove.id },
      data: { blockchainTxId: null, blockchainStoredAt: null }
    });
    return NextResponse.json({ success: false, error: (result as any).error || 'Blockchain storage failed' }, { status: 500 });
  }

  // Success! Update database with blockchain transaction info
  await prisma.move.update({
    where: { id: dbMove.id },
    data: {
      blockchainTxId: result['transactionId'],
      blockchainVdxfKey: result['vdxfKey'],
      blockchainStoredAt: new Date(),
    }
  });

  return NextResponse.json({
    success: true,
    transactionId: result['transactionId'],
    vdxfKey: result['vdxfKey'],
    message: 'Move stored on blockchain successfully'
  });
}
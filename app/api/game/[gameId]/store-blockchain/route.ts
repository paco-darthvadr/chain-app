import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { BlockchainStorage } from '../../../../utils/blockchain-storage.js';
import { getModeHandler } from '@/app/utils/modes/mode-resolver';

// POST /api/game/[gameId]/store-blockchain - Store completed game on blockchain
export async function POST(request: Request, { params }: { params: { gameId: string } }) {
    console.log('API route called for gameId:', params.gameId, 'at', new Date().toISOString());

    // Check game mode — Normal mode uses its own flow outside the transaction
    const gameForMode = await prisma.game.findUnique({
        where: { id: params.gameId },
        include: { player1: true, player2: true },
    });
    if (!gameForMode) {
        return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }
    if (gameForMode.mode === 'normal' || gameForMode.mode === 'showcase') {
        // Only store completed games
        if (gameForMode.status !== 'COMPLETED') {
            return NextResponse.json({ error: 'Game is not completed' }, { status: 400 });
        }

        // Check if already stored — allow tournament to overwrite normal
        let requestIsTournament = false;
        try {
            const body = await request.clone().json();
            requestIsTournament = body?.tournament === true;
        } catch {}

        if (gameForMode.blockchainTxId && gameForMode.blockchainTxId !== 'PROCESSING') {
            // Already stored — tournament trumps normal (allow overwrite)
            if (requestIsTournament) {
                console.log(`[Store] Tournament overwrite for game ${params.gameId}`);
            } else {
                return NextResponse.json({
                    success: true,
                    message: 'Game already stored on blockchain',
                    transactionId: gameForMode.blockchainTxId,
                });
            }
        }

        const handler = getModeHandler(gameForMode.mode);

        // Check if SubID is ready before attempting store
        const session = await prisma.gameSession.findUnique({ where: { gameId: params.gameId } });
        if (session?.subIdName && !session.subIdAddress) {
            // SubID was assigned but not yet confirmed on chain
            return NextResponse.json({
                success: false,
                pending: true,
                error: `Game SubID (${session.subIdName}) hasn't been confirmed on chain yet. Please wait for it to be mined.`,
            }, { status: 202 });
        }

        // Run game-end verification first
        const endResult = await handler.onGameEnd(gameForMode);
        if (!endResult || !endResult.verified) {
            return NextResponse.json({
                success: false,
                error: 'Game verification failed',
            }, { status: 400 });
        }

        // Use already-parsed tournament flag
        const includeMovesSigs = requestIsTournament;

        // Store on chain — pass tournament flag via game object
        const gameWithFlags = { ...gameForMode, _includeMovesSigs: includeMovesSigs };
        const result = await handler.storeOnChain(gameWithFlags);
        return NextResponse.json(result);
    }

    // Original mode: fall through to existing $transaction logic below
    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        try {
            // Get the game data from database
            const game = await tx.game.findUnique({
                where: { id: params.gameId },
                include: {
                    player1: true,
                    player2: true,
                },
            });

            if (!game) {
                return NextResponse.json({ error: 'Game not found' }, { status: 404 });
            }

            // Check if already stored on blockchain
            if (game.blockchainTxId && game.blockchainTxId !== 'PROCESSING') {
                return NextResponse.json({ 
                    success: true, 
                    message: 'Game already stored on blockchain',
                    transactionId: game.blockchainTxId 
                });
            }

            // Check if currently being processed
            if (game.blockchainTxId === 'PROCESSING') {
                return NextResponse.json({ 
                    success: false, 
                    message: 'Game is currently being processed for blockchain storage',
                    status: 'processing'
                }, { status: 409 });
            }

            // Only store completed games
            if (game.status !== 'COMPLETED') {
                return NextResponse.json({ error: 'Game is not completed' }, { status: 400 });
            }

            // Set processing flag atomically - only one request can set this
            const processingUpdate = await tx.game.updateMany({
                where: {
                    id: params.gameId,
                    blockchainTxId: null, // Only update if not already set
                },
                data: {
                    blockchainTxId: 'PROCESSING',
                    blockchainStoredAt: new Date(),
                },
            });

            // If no rows were updated, another request is already processing
            if (processingUpdate.count === 0) {
                return NextResponse.json({ 
                    success: false, 
                    message: 'Game is already being processed for blockchain storage',
                    status: 'processing'
                }, { status: 409 });
            }

            console.log('Atomic lock acquired for game:', params.gameId);

            // Get moves from board state (robust for string or object, with logging)
            const moves: any[] = [];
            let boardState = game.boardState;
            if (typeof boardState === 'string') {
                try {
                    boardState = JSON.parse(boardState);
                } catch (e) {
                    console.error('Failed to parse boardState JSON:', e, 'Raw value:', game.boardState);
                    boardState = {};
                }
            }
            if (boardState && typeof boardState === 'object' && 'moves' in boardState && Array.isArray(boardState.moves)) {
                moves.push(...boardState.moves);
            } else {
                console.warn('No moves found in boardState:', boardState);
            }

            // Sanitize and validate all data to match verus-test-v2.js format
            console.log('=== SANITIZING CHESS GAME DATA ===');
            
            const safeGameId = String(game.id || "");
            const safeWhite = String(game.player1.verusId || game.player1.displayName || "");
            const safeBlack = String(game.player2.verusId || game.player2.displayName || "");
            const safeWinner = game.winner ? String(game.winner) : "";
            const safeStatus = (game.status || "").toLowerCase() === "completed" ? "completed" : "active";
            // Convert move objects to 4-character strings if needed
            const safeMoves = Array.isArray(moves)
              ? moves
                  .map(m => (typeof m === "string"
                    ? m
                    : (m.from && m.to && typeof m.from === "string" && typeof m.to === "string")
                      ? `${m.from}${m.to}`
                      : null))
                  .filter(m => typeof m === "string" && m.length === 4)
              : [];
            const safeTimestamp = new Date().toISOString();

            console.log('Original data:');
            console.log('  gameId:', game.id);
            console.log('  white:', game.player1.verusId || game.player1.displayName);
            console.log('  black:', game.player2.verusId || game.player2.displayName);
            console.log('  winner:', game.winner);
            console.log('  status:', game.status);
            console.log('  moves:', moves);
            console.log('  timestamp:', safeTimestamp);

            console.log('Sanitized data:');
            console.log('  safeGameId:', safeGameId);
            console.log('  safeWhite:', safeWhite);
            console.log('  safeBlack:', safeBlack);
            console.log('  safeWinner:', safeWinner);
            console.log('  safeStatus:', safeStatus);
            console.log('  safeMoves:', safeMoves);
            console.log('  safeTimestamp:', safeTimestamp);

            // Validate data quality
            if (!safeGameId) {
                console.error('Game ID is empty after sanitization');
                // Clear processing flag on validation error
                await tx.game.update({
                    where: { id: params.gameId },
                    data: { blockchainTxId: null, blockchainStoredAt: null }
                });
                return NextResponse.json({ error: 'Invalid game ID' }, { status: 400 });
            }
            if (!safeWhite || !safeBlack) {
                console.error('Player names are empty after sanitization');
                // Clear processing flag on validation error
                await tx.game.update({
                    where: { id: params.gameId },
                    data: { blockchainTxId: null, blockchainStoredAt: null }
                });
                return NextResponse.json({ error: 'Invalid player names' }, { status: 400 });
            }
            if (safeMoves.length === 0) {
                console.warn('No valid moves found (all moves must be 4-character strings)');
            }

            console.log('Data sanitization complete - creating ChessGame object...');

            // Create sanitized game object for blockchain storage
            const sanitizedGame = {
                id: safeGameId,
                player1: { verusId: safeWhite, displayName: safeWhite },
                player2: { verusId: safeBlack, displayName: safeBlack },
                winner: safeWinner,
                status: safeStatus,
                timestamp: safeTimestamp
            };

            // Initialize blockchain storage
            const blockchainStorage = new BlockchainStorage();
            
            // Store game on blockchain with sanitized data
            const result: any = await blockchainStorage.storeCompletedGame(sanitizedGame, safeMoves);
            
            if (!result || typeof result['success'] === 'undefined') {
                console.error('Blockchain storage failed: No result returned');
                // Clear processing flag on failure
                await tx.game.update({
                    where: { id: params.gameId },
                    data: { blockchainTxId: null, blockchainStoredAt: null }
                });
                return NextResponse.json({ error: 'Blockchain storage failed: No result returned' }, { status: 500 });
            }

            // Handle the result
            if (!result['success']) {
                // Check for "already in chain"/"already in mempool" errors
                const errMsg = (result['error'] || '').toLowerCase();
                if (
                    errMsg.includes('already in chain') ||
                    errMsg.includes('already in mempool') ||
                    errMsg.includes('transaction already exists')
                ) {
                    console.warn('Transaction already in chain/mempool, treating as success');
                    // Update database with the transaction info (even if it was already broadcast)
                    await tx.game.update({
                        where: { id: params.gameId },
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
                console.error('Blockchain storage error:', result['error']);
                // Clear processing flag on failure
                await tx.game.update({
                    where: { id: params.gameId },
                    data: { blockchainTxId: null, blockchainStoredAt: null }
                });
                return NextResponse.json({ error: result['error'] || 'Blockchain storage failed' }, { status: 500 });
            }

            // Success! Update database with blockchain transaction info
            await tx.game.update({
                where: { id: params.gameId },
                data: {
                    blockchainTxId: result['transactionId'],
                    blockchainVdxfKey: result['vdxfKey'],
                    blockchainStoredAt: new Date(),
                }
            });

            console.log('Database updated with blockchain transaction info');

            return NextResponse.json({
                success: true,
                transactionId: result['transactionId'],
                vdxfKey: result['vdxfKey'],
                compactSize: result['compactSize'],
                message: 'Game stored on blockchain successfully'
            });

        } catch (error) {
            console.error('Error storing game on blockchain:', error);
            
            // Ensure processing flag is cleared on any error
            try {
                await tx.game.update({
                    where: { id: params.gameId },
                    data: { blockchainTxId: null, blockchainStoredAt: null }
                });
            } catch (clearError) {
                console.error('Failed to clear processing flag:', clearError);
            }
            
            return NextResponse.json({ 
                error: 'Internal server error',
                message: 'Failed to store game on blockchain'
            }, { status: 500 });
        }
    });
}
import axios from 'axios';
import { prisma } from '@/lib/prisma';

// ---------------------------------------------------------------------------
// RPC helper
// ---------------------------------------------------------------------------

const VERUS_RPC_URL = `http://${process.env.VERUS_RPC_USER}:${process.env.VERUS_RPC_PASSWORD}@${process.env.VERUS_RPC_HOST || '127.0.0.1'}:${process.env.VERUS_RPC_PORT || 18843}`;

async function rpcCall(method: string, params: any[] = []): Promise<any> {
  const response = await axios.post(VERUS_RPC_URL, {
    method,
    params,
    id: 1,
    jsonrpc: '2.0',
  });
  if (response.data.error) {
    throw new Error(`RPC ${method} error: ${JSON.stringify(response.data.error)}`);
  }
  return response.data.result;
}

// ---------------------------------------------------------------------------
// 1. isPoolEnabled
// ---------------------------------------------------------------------------

/**
 * Returns true unless SUBID_POOL_ENABLED is explicitly set to 'false'.
 * If the env var is unset or undefined the pool is treated as enabled.
 */
export function isPoolEnabled(): boolean {
  return process.env.SUBID_POOL_ENABLED !== 'false';
}

// ---------------------------------------------------------------------------
// 2. getPoolStatus
// ---------------------------------------------------------------------------

/**
 * Returns counts of SubIDs in each status bucket.
 */
export async function getPoolStatus(): Promise<{
  ready: number;
  registering: number;
  used: number;
}> {
  const [ready, registering, used] = await Promise.all([
    prisma.subIdPool.count({ where: { status: 'ready' } }),
    prisma.subIdPool.count({ where: { status: 'registering' } }),
    prisma.subIdPool.count({ where: { status: 'used' } }),
  ]);
  return { ready, registering, used };
}

// ---------------------------------------------------------------------------
// 3. popReadySubId
// ---------------------------------------------------------------------------

/**
 * Atomically claims the lowest-numbered 'ready' SubID, marks it as 'used',
 * and sets usedAt.  Returns null when the pool is empty or disabled.
 */
export async function popReadySubId(): Promise<{
  subIdName: string;
  gameNumber: number;
  address: string;
} | null> {
  if (!isPoolEnabled()) return null;

  return prisma.$transaction(async (tx) => {
    const ready = await tx.subIdPool.findFirst({
      where: { status: 'ready' },
      orderBy: { gameNumber: 'asc' },
    });
    if (!ready || !ready.address) return null;

    await tx.subIdPool.update({
      where: { id: ready.id },
      data: { status: 'used', usedAt: new Date() },
    });

    return {
      subIdName: ready.subIdName,
      gameNumber: ready.gameNumber,
      address: ready.address,
    };
  });
}

// ---------------------------------------------------------------------------
// 4. ensurePoolSize
// ---------------------------------------------------------------------------

/**
 * Checks how many 'ready' + 'registering' SubIDs exist.  If fewer than
 * minSize, kicks off background registration for the shortfall.
 * Returns immediately — registration runs in the background.
 * No-op when the pool is disabled.
 */
export async function ensurePoolSize(minSize: number = 5): Promise<void> {
  if (!isPoolEnabled()) return;

  const available = await prisma.subIdPool.count({
    where: { status: { in: ['ready', 'registering'] } },
  });

  const needed = minSize - available;
  if (needed <= 0) return;

  console.log(
    `[SubID Pool] Need ${needed} more SubIDs (have ${available} ready/registering)`,
  );

  // Fire off background registrations — don't await them
  for (let i = 0; i < needed; i++) {
    registerOneSubId().catch((err) => {
      console.error(
        '[SubID Pool] Background registration failed:',
        err.message,
      );
    });
  }
}

// ---------------------------------------------------------------------------
// 5. registerOneSubId
// ---------------------------------------------------------------------------

/**
 * Waits for a transaction to get at least one confirmation.
 * Polls getrawtransaction every 10 s, up to maxWait ms.
 */
async function waitForConfirmation(
  txid: string,
  maxWait: number = 120000,
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    try {
      const tx = await rpcCall('getrawtransaction', [txid, 1]);
      if (tx && tx.confirmations && tx.confirmations > 0) {
        console.log(
          `[SubID Pool] TX ${txid.substring(0, 16)}... confirmed (${tx.confirmations} conf)`,
        );
        return true;
      }
    } catch {
      // TX not found yet — keep waiting
    }
    await new Promise((resolve) => setTimeout(resolve, 10000));
  }
  return false;
}

/**
 * Allocates the next game number, registers a fresh SubID on-chain via the
 * two-step commitment flow, and records it in the SubIdPool table.
 *
 * The function is designed to run in the background and will never throw in
 * a way that crashes the server — errors are logged and the pool record is
 * cleaned up.
 */
export async function registerOneSubId(): Promise<void> {
  // 1. Allocate game number from GameCounter (same pattern as game/route.ts)
  await prisma.$executeRaw`INSERT OR IGNORE INTO GameCounter (id, nextGame) VALUES ('singleton', 1)`;
  const gameNumber = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`UPDATE GameCounter SET nextGame = nextGame + 1 WHERE id = 'singleton'`;
    const result = await tx.gameCounter.findUnique({
      where: { id: 'singleton' },
    });
    return result!.nextGame - 1;
  });
  const subIdName = `game${String(gameNumber).padStart(4, '0')}`;

  // 2. Create SubIdPool record with status 'registering'
  const poolRecord = await prisma.subIdPool.create({
    data: {
      subIdName,
      gameNumber,
      status: 'registering',
    },
  });

  try {
    const parentAddress = process.env.CHESSGAME_IDENTITY_ADDRESS;
    if (!parentAddress) {
      throw new Error('CHESSGAME_IDENTITY_ADDRESS env var is not set');
    }

    // 3. registernamecommitment
    const commitment = await rpcCall('registernamecommitment', [
      subIdName,
      parentAddress,
      '',
      parentAddress,
    ]);
    console.log(
      `[SubID Pool] Name commitment for ${subIdName}: txid=${commitment.txid}`,
    );

    // 4. Save commitTxId
    await prisma.subIdPool.update({
      where: { id: poolRecord.id },
      data: { commitTxId: commitment.txid },
    });

    // 5. Wait for confirmation
    const confirmed = await waitForConfirmation(commitment.txid, 120000);
    if (!confirmed) {
      throw new Error(
        `Commitment ${commitment.txid} not confirmed after 120 s`,
      );
    }

    // 6. registeridentity
    const parentIdentity = await rpcCall('getidentity', [parentAddress]);
    const parentPrimaryAddress =
      parentIdentity.identity.primaryaddresses[0];

    await rpcCall('registeridentity', [
      {
        txid: commitment.txid,
        namereservation: commitment.namereservation,
        identity: {
          name: subIdName,
          parent: parentAddress,
          primaryaddresses: [parentPrimaryAddress],
          minimumsignatures: 1,
        },
      },
    ]);
    console.log(`[SubID Pool] registeridentity sent for ${subIdName}`);

    // 7. Poll getidentity to obtain the i-address
    const parentName = process.env.CHESSGAME_IDENTITY_NAME || 'ChessGame@';
    const fullName = `${subIdName}.${parentName.replace('@', '')}@`;
    let identityAddress: string | null = null;

    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        const registered = await rpcCall('getidentity', [fullName]);
        if (registered?.identity?.identityaddress) {
          identityAddress = registered.identity.identityaddress;
          break;
        }
      } catch {
        // Not found yet
      }
      if (attempt < 5) {
        console.log(
          `[SubID Pool] ${fullName} not found yet, waiting 10 s... (${attempt + 1}/6)`,
        );
        await new Promise((resolve) => setTimeout(resolve, 10000));
      }
    }

    if (!identityAddress) {
      throw new Error(
        `${fullName} registered but not visible on chain after 6 attempts`,
      );
    }

    // 8. Update SubIdPool: status='ready', address=identityAddress
    await prisma.subIdPool.update({
      where: { id: poolRecord.id },
      data: { status: 'ready', address: identityAddress },
    });

    console.log(
      `[SubID Pool] ${subIdName} ready at ${identityAddress}`,
    );
  } catch (err: any) {
    console.error(
      `[SubID Pool] Registration failed for ${subIdName}:`,
      err.message,
    );
    // Clean up the pool record so it doesn't count toward available slots
    try {
      await prisma.subIdPool.delete({ where: { id: poolRecord.id } });
    } catch {
      // Record may already be gone — ignore
    }
  }
}

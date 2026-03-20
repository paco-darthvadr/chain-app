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

export function isPoolEnabled(): boolean {
  return process.env.SUBID_POOL_ENABLED !== 'false';
}

// ---------------------------------------------------------------------------
// 2. getPoolStatus
// ---------------------------------------------------------------------------

export async function getPoolStatus(): Promise<{
  ready: number;
  registering: number;
  failed: number;
  used: number;
}> {
  const [ready, registering, failed, used] = await Promise.all([
    prisma.subIdPool.count({ where: { status: 'ready' } }),
    prisma.subIdPool.count({ where: { status: 'registering' } }),
    prisma.subIdPool.count({ where: { status: 'failed' } }),
    prisma.subIdPool.count({ where: { status: 'used' } }),
  ]);
  return { ready, registering, failed, used };
}

// ---------------------------------------------------------------------------
// 3. popReadySubId
// ---------------------------------------------------------------------------

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

export async function ensurePoolSize(minSize: number = 5): Promise<void> {
  if (!isPoolEnabled()) return;

  // First: find failed records that need retry
  const failed = await prisma.subIdPool.findMany({
    where: { status: 'failed' },
    orderBy: { gameNumber: 'asc' },
  });

  // Count ready + actively registering
  const available = await prisma.subIdPool.count({
    where: { status: { in: ['ready', 'registering'] } },
  });

  // After retrying failed, how many NEW ones do we need?
  const newNeeded = Math.max(0, minSize - available - failed.length);

  if (failed.length === 0 && newNeeded === 0) return;

  console.log(
    `[SubID Pool] Retrying ${failed.length} failed, registering ${newNeeded} new (have ${available} ready/registering)`,
  );

  // Sequential background: retry failed first, then register new
  (async () => {
    for (const record of failed) {
      try {
        await registerSubId(record);
      } catch (err: any) {
        console.error(`[SubID Pool] Retry failed for ${record.subIdName}:`, err.message);
      }
    }
    for (let i = 0; i < newNeeded; i++) {
      try {
        await registerSubId();
      } catch (err: any) {
        console.error('[SubID Pool] New registration failed:', err.message);
      }
    }
  })();
}

// ---------------------------------------------------------------------------
// 5. registerSubId — handles both new and retry
// ---------------------------------------------------------------------------

async function waitForConfirmation(
  txid: string,
  maxWait: number = 300000,
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
 * Register a SubID on chain. Pass an existing pool record to retry a failed
 * registration, or omit to allocate a new game number.
 *
 * On failure, the pool record is marked 'failed' (never deleted) so it can
 * be retried later without burning the game number.
 */
async function registerSubId(existingRecord?: any): Promise<void> {
  let poolRecord: any;
  let subIdName: string;

  if (existingRecord) {
    // Retry: reuse existing record
    poolRecord = existingRecord;
    subIdName = existingRecord.subIdName;
    await prisma.subIdPool.update({
      where: { id: poolRecord.id },
      data: { status: 'registering' },
    });
    console.log(`[SubID Pool] Retrying registration for ${subIdName}...`);
  } else {
    // New: allocate game number from shared GameCounter
    await prisma.$executeRaw`INSERT OR IGNORE INTO GameCounter (id, nextGame) VALUES ('singleton', 1)`;
    const gameNumber = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`UPDATE GameCounter SET nextGame = nextGame + 1 WHERE id = 'singleton'`;
      const result = await tx.gameCounter.findUnique({
        where: { id: 'singleton' },
      });
      return result!.nextGame - 1;
    });
    subIdName = `game${String(gameNumber).padStart(4, '0')}`;
    poolRecord = await prisma.subIdPool.create({
      data: { subIdName, gameNumber, status: 'registering' },
    });
  }

  const parentAddress = process.env.CHESSGAME_IDENTITY_ADDRESS;
  const parentName = process.env.CHESSGAME_IDENTITY_NAME || 'ChessGame@';
  const fullName = `${subIdName}.${parentName.replace('@', '')}@`;

  try {
    if (!parentAddress) {
      throw new Error('CHESSGAME_IDENTITY_ADDRESS env var is not set');
    }

    // Check if SubID already exists on chain (handles partial success from prior attempt)
    try {
      const existing = await rpcCall('getidentity', [fullName]);
      if (existing?.identity?.identityaddress) {
        await prisma.subIdPool.update({
          where: { id: poolRecord.id },
          data: { status: 'ready', address: existing.identity.identityaddress },
        });
        console.log(`[SubID Pool] ${subIdName} already exists at ${existing.identity.identityaddress}`);
        return;
      }
    } catch {
      // Not found — proceed with registration
    }

    // Step 1: registernamecommitment
    const commitment = await rpcCall('registernamecommitment', [
      subIdName,
      parentAddress,
      '',
      parentAddress,
    ]);
    console.log(`[SubID Pool] Name commitment for ${subIdName}: txid=${commitment.txid}`);

    await prisma.subIdPool.update({
      where: { id: poolRecord.id },
      data: { commitTxId: commitment.txid },
    });

    // Step 2: wait for confirmation
    const confirmed = await waitForConfirmation(commitment.txid);
    if (!confirmed) {
      throw new Error(`Commitment ${commitment.txid} not confirmed after 300 s`);
    }

    // Step 3: registeridentity
    const parentIdentity = await rpcCall('getidentity', [parentAddress]);
    const parentPrimaryAddress = parentIdentity.identity.primaryaddresses[0];

    await rpcCall('registeridentity', [{
      txid: commitment.txid,
      namereservation: commitment.namereservation,
      identity: {
        name: subIdName,
        parent: parentAddress,
        primaryaddresses: [parentPrimaryAddress],
        minimumsignatures: 1,
      },
    }]);
    console.log(`[SubID Pool] registeridentity sent for ${subIdName}`);

    // Step 4: poll for identity to appear on chain
    let identityAddress: string | null = null;
    for (let attempt = 0; attempt < 18; attempt++) {
      try {
        const registered = await rpcCall('getidentity', [fullName]);
        if (registered?.identity?.identityaddress) {
          identityAddress = registered.identity.identityaddress;
          break;
        }
      } catch {
        // Not found yet
      }
      if (attempt < 17) {
        console.log(`[SubID Pool] ${fullName} not found yet, waiting 10 s... (${attempt + 1}/18)`);
        await new Promise((resolve) => setTimeout(resolve, 10000));
      }
    }

    if (!identityAddress) {
      throw new Error(`${fullName} registered but not visible on chain after 18 attempts (3 min)`);
    }

    // Step 5: mark ready
    await prisma.subIdPool.update({
      where: { id: poolRecord.id },
      data: { status: 'ready', address: identityAddress },
    });
    console.log(`[SubID Pool] ${subIdName} ready at ${identityAddress}`);

  } catch (err: any) {
    console.error(`[SubID Pool] Registration failed for ${subIdName}:`, err.message);
    // Mark as failed — will be retried by ensurePoolSize, never deleted
    try {
      await prisma.subIdPool.update({
        where: { id: poolRecord.id },
        data: { status: 'failed' },
      });
    } catch {
      // Record may be gone — ignore
    }
  }
}

// Keep registerOneSubId as the public API (wraps registerSubId for new registrations)
export async function registerOneSubId(): Promise<void> {
  return registerSubId();
}

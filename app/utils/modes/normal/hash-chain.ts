import { createHash } from 'crypto';

export interface MovePackageData {
  subIdName: string;
  player: string;
  moveNum: number;
  move: string;
  prevHash: string;
}

/**
 * Compute SHA256 hash of a move package (deterministic JSON serialization).
 * Keys are sorted to ensure consistent hashing regardless of insertion order.
 */
export function hashMovePackage(pkg: MovePackageData): string {
  const canonical = JSON.stringify(pkg, Object.keys(pkg).sort());
  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * Compute the initial anchor hash for the first move.
 * This ties the hash chain to the specific game and players.
 */
export function computeAnchorHash(subIdName: string, white: string, black: string): string {
  const anchor = {
    subIdName,
    white,
    black,
    startPos: 'standard',
  };
  const canonical = JSON.stringify(anchor, Object.keys(anchor).sort());
  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * Verify the integrity of an entire move chain.
 * Returns { valid: true } or { valid: false, error: string, moveNum: number }.
 */
export function verifyChain(
  subIdName: string,
  white: string,
  black: string,
  packages: MovePackageData[]
): { valid: boolean; error?: string; moveNum?: number } {
  if (packages.length === 0) {
    return { valid: true };
  }

  const anchorHash = computeAnchorHash(subIdName, white, black);

  let expectedPrevHash = anchorHash;
  for (let i = 0; i < packages.length; i++) {
    const pkg = packages[i];

    if (pkg.prevHash !== expectedPrevHash) {
      return {
        valid: false,
        error: `Hash chain broken at move ${pkg.moveNum}: expected prevHash ${expectedPrevHash}, got ${pkg.prevHash}`,
        moveNum: pkg.moveNum,
      };
    }

    if (pkg.moveNum !== i + 1) {
      return {
        valid: false,
        error: `Move number mismatch at index ${i}: expected ${i + 1}, got ${pkg.moveNum}`,
        moveNum: pkg.moveNum,
      };
    }

    expectedPrevHash = hashMovePackage(pkg);
  }

  return { valid: true };
}

/**
 * Compute the final game hash from the last move package.
 */
export function computeGameHash(packages: MovePackageData[]): string {
  if (packages.length === 0) {
    return createHash('sha256').update('empty').digest('hex');
  }
  return hashMovePackage(packages[packages.length - 1]);
}

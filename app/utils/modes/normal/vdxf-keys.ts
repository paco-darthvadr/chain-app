/**
 * VDXF key definitions for the chessgame::game.v1 schema.
 * Generated via `getvdxfid` on the Verus daemon.
 * These keys are deterministic — same URI always produces same i-address.
 *
 * Schema is published on ChessGame@ contentmultimap as DefinedKeys
 * so any app can discover and parse chess game data.
 */

export const CHESS_VDXF_KEYS = {
  version:   { uri: 'chessgame::game.v1.version',   vdxfid: 'i68daedRarsq5o8XAyqtDoLNKFsnPbHfy3' },
  white:     { uri: 'chessgame::game.v1.white',     vdxfid: 'iHQYL4kHxcppiFHNPKfQnUqGUpqXW1rGje' },
  black:     { uri: 'chessgame::game.v1.black',     vdxfid: 'iNywJcF2dSwbQzzNw2s92obHLrebuFoqvX' },
  winner:    { uri: 'chessgame::game.v1.winner',    vdxfid: 'i6YXjwdUmQPP8VcswDqAdX2VfCtfokqcqq' },
  result:    { uri: 'chessgame::game.v1.result',    vdxfid: 'i4xV1gwrsQWK8smrqzhUxGiCb7M4fNWeQm' },
  moves:     { uri: 'chessgame::game.v1.moves',     vdxfid: 'i8xnxTewAa4jGfL2qxHGCzN9oni7XLTg2y' },
  movecount: { uri: 'chessgame::game.v1.movecount', vdxfid: 'iMPovQC9LMr8f9AQi3fNnuJaywVnYvKY9L' },
  duration:  { uri: 'chessgame::game.v1.duration',  vdxfid: 'i7huWK1jULuZz4uw1FuEoVhX7XrSuGbV8M' },
  startedat: { uri: 'chessgame::game.v1.startedat', vdxfid: 'iBwYB8M81jj6BaQZ3gF2gs5jH2f9oDWqKB' },
  gamehash:  { uri: 'chessgame::game.v1.gamehash',  vdxfid: 'i5DTzWhVndJN2LK7aKYa6AHRufKCkjrGaF' },
  whitesig:  { uri: 'chessgame::game.v1.whitesig',  vdxfid: 'iBRVxYHAk2iwbPvoX7Ra5VqjwyZanhS9YT' },
  blacksig:  { uri: 'chessgame::game.v1.blacksig',  vdxfid: 'iEV6cVwMx6MqoKa9d4UMrvvpAHvnzuyJnA' },
  mode:      { uri: 'chessgame::game.v1.mode',      vdxfid: 'i7m9fT6XCANjEEfH22tusdzkNGeF5Bn721' },
  movesigs:  { uri: 'chessgame::game.v1.movesigs',  vdxfid: 'iJeeGG5tHwd8wNUkjrVG2UeVwd7ScfYFRu' },
} as const;

/** Helper to hex-encode a string value for contentmultimap */
export function hexEncode(value: string): string {
  return Buffer.from(value).toString('hex');
}

/** Helper to hex-decode a contentmultimap value */
export function hexDecode(hex: string): string {
  return Buffer.from(hex, 'hex').toString();
}

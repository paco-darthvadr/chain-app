/**
 * VDXF key definitions for the checkersgame::game.v1 schema.
 * Generated via `getvdxfid` on the Verus daemon.
 * These keys are deterministic — same URI always produces same i-address.
 *
 * Schema is published on CheckersGame@ contentmultimap as DefinedKeys
 * so any app can discover and parse checkers game data.
 */

export const CHECKERS_VDXF_KEYS = {
  version:      { uri: 'checkersgame::game.v1.version',      vdxfid: 'i9EbQVPJ3e6uXo9mJJRvNMV2n5jNrZCyKz' },
  red:          { uri: 'checkersgame::game.v1.red',          vdxfid: 'iDsap52QN26kxoWS3KN7aubscDqyCjvjXD' },
  black:        { uri: 'checkersgame::game.v1.black',        vdxfid: 'iJi5M1T7N2YhT29yw16J4BkkcHhpqyufSP' },
  winner:       { uri: 'checkersgame::game.v1.winner',       vdxfid: 'iLJPZxGGxzcef6mCJQnFBusFUE43q9r3v6' },
  result:       { uri: 'checkersgame::game.v1.result',       vdxfid: 'i8jWc9AtwDvaNEzDm7bXwsb2ejd6YJY947' },
  moves:        { uri: 'checkersgame::game.v1.moves',        vdxfid: 'i9UZDUGoRhuqihvLfejPBqLYiBEvgKBkmB' },
  movecount:    { uri: 'checkersgame::game.v1.movecount',    vdxfid: 'iSQbWPKFuQywXForyR1KfkMrRQL21dA49x' },
  duration:     { uri: 'checkersgame::game.v1.duration',      vdxfid: 'iNC8eN85qkmdFeUhSSCUEKvrRDGcEvBrGz' },
  startedat:    { uri: 'checkersgame::game.v1.startedat',    vdxfid: 'iFR4NjA8nSHZHXe2sjec8A4CiehqGjgf63' },
  gamehash:     { uri: 'checkersgame::game.v1.gamehash',     vdxfid: 'iBzLg6mPDC3STQPwHFb8x5k3tGCiqz1b5X' },
  redsig:       { uri: 'checkersgame::game.v1.redsig',       vdxfid: 'iCGPLU3eHxY61jg7Q9RRfKDcgf6KR26DRA' },
  blacksig:     { uri: 'checkersgame::game.v1.blacksig',     vdxfid: 'iSTNY18mQDiusjhpSs7B1Ndc1iAethYjFy' },
  mode:         { uri: 'checkersgame::game.v1.mode',         vdxfid: 'iKCMCFgGAcwHaD9a8fZxg1mwnf8hJE5r8d' },
  movesigs:     { uri: 'checkersgame::game.v1.movesigs',     vdxfid: 'iCo3Jz3hZZwTut5njLudvVzK6etHdu4Wm9' },
  redopensig:   { uri: 'checkersgame::game.v1.redopensig',   vdxfid: 'iEGysiNeLzg3AtaZyRyTyzcrMPE9GPN1ao' },
  blackopensig: { uri: 'checkersgame::game.v1.blackopensig', vdxfid: 'iGBAdPJWfXs5SfEhxFQYN9PohSe75oDk52' },
  status:       { uri: 'checkersgame::game.v1.status',       vdxfid: 'iDdQykHEyTJn4QJNaqkeaVpAL2B2n9b9Dj' },
} as const;

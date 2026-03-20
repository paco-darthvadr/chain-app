/**
 * VDXF key definitions for the checkersgame::game.v1 schema.
 * Placeholder — vdxfids are empty until generated via `getvdxfid` on the Verus daemon.
 */

export const CHECKERS_VDXF_KEYS = {
  version:      { uri: 'checkersgame::game.v1.version',      vdxfid: '' },
  red:          { uri: 'checkersgame::game.v1.red',          vdxfid: '' },
  black:        { uri: 'checkersgame::game.v1.black',        vdxfid: '' },
  winner:       { uri: 'checkersgame::game.v1.winner',       vdxfid: '' },
  result:       { uri: 'checkersgame::game.v1.result',       vdxfid: '' },
  moves:        { uri: 'checkersgame::game.v1.moves',        vdxfid: '' },
  movecount:    { uri: 'checkersgame::game.v1.movecount',    vdxfid: '' },
  duration:     { uri: 'checkersgame::game.v1.duration',     vdxfid: '' },
  startedat:    { uri: 'checkersgame::game.v1.startedat',    vdxfid: '' },
  gamehash:     { uri: 'checkersgame::game.v1.gamehash',     vdxfid: '' },
  redsig:       { uri: 'checkersgame::game.v1.redsig',       vdxfid: '' },
  blacksig:     { uri: 'checkersgame::game.v1.blacksig',     vdxfid: '' },
  mode:         { uri: 'checkersgame::game.v1.mode',         vdxfid: '' },
  movesigs:     { uri: 'checkersgame::game.v1.movesigs',     vdxfid: '' },
  redopensig:   { uri: 'checkersgame::game.v1.redopensig',   vdxfid: '' },
  blackopensig: { uri: 'checkersgame::game.v1.blackopensig', vdxfid: '' },
  status:       { uri: 'checkersgame::game.v1.status',       vdxfid: '' },
} as const;

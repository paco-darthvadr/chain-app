import { ModeHandler } from './types';
import { originalHandler } from './original/handler';
import { normalHandler } from './normal/handler';
import { showcaseHandler } from './showcase/handler';

export function getModeHandler(mode: string | undefined | null): ModeHandler {
  switch (mode) {
    case 'normal':
      return normalHandler;
    case 'showcase':
      return showcaseHandler;
    case 'original':
    default:
      return originalHandler;
  }
}

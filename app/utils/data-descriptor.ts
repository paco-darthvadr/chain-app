/** DataDescriptor key i-address (the type marker for DD objects) */
export const DD_KEY = 'i4GC1YGEVD21afWudGoFJVdnfjJ5XWnCQv';

/**
 * Wrap a value as a DataDescriptor for contentmultimap.
 * The daemon auto-decodes these into readable JSON with labels and MIME types.
 */
export function dd(value: string, label: string, mimetype: string = 'text/plain'): object {
  return {
    [DD_KEY]: {
      version: 1,
      mimetype,
      objectdata: { message: value },
      label,
    }
  };
}

export const privateHeaders = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
};

/** Read bytes before decoding so multibyte input cannot bypass the limit. */
export async function boundedText(
  stream: ReadableStream<Uint8Array> | null,
  max: number,
  signal?: AbortSignal,
) {
  if (!stream) return '';
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const abort = () => {
    void reader.cancel(signal?.reason).catch(() => undefined);
  };
  signal?.addEventListener('abort', abort, { once: true });
  let bytes = 0;
  let result = '';
  try {
    signal?.throwIfAborted();
    while (true) {
      const { done, value } = await reader.read();
      signal?.throwIfAborted();
      if (done) return result + decoder.decode();
      bytes += value.byteLength;
      if (bytes > max) {
        await reader.cancel();
        return null;
      }
      result += decoder.decode(value, { stream: true });
    }
  } finally {
    signal?.removeEventListener('abort', abort);
    reader.releaseLock();
  }
}

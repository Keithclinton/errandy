/**
 * Strips a filename down to characters safe for a Blob storage pathname. Spaces
 * and other punctuation in the original name (e.g. "WhatsApp Image 2026-02-05
 * at 17.02.18.jpeg") produce a client-upload token whose signed pathname and
 * the browser's actual request URL get encoded differently, which Vercel Blob
 * rejects with a 403 that shows up in the browser as a CORS error.
 */
export function sanitizeFilename(filename: string): string {
  return filename.normalize("NFKD").replace(/[^\w.-]/g, "-");
}

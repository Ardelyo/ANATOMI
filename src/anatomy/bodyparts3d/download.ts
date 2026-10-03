/**
 * Mendekode response buffer model BodyParts3D gzipped.
 */
export async function decodeModelResponse(
  response: Response,
  expectedBytes: number,
  compressed: boolean,
): Promise<ArrayBuffer> {
  if (!response.ok) throw new Error("Berkas geometri anatomi gagal dimuat.");
  const payload = await response.arrayBuffer();
  const signature = new Uint8Array(payload, 0, Math.min(2, payload.byteLength));
  const isGzip = compressed && signature[0] === 0x1f && signature[1] === 0x8b;

  const buffer = isGzip && typeof DecompressionStream !== "undefined"
    ? await new Response(new Blob([payload]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer()
    : payload;

  if (buffer.byteLength !== expectedBytes) {
    throw new Error(`Ukuran buffer tidak sesuai (diharapkan ${expectedBytes}, diterima ${buffer.byteLength}).`);
  }
  return buffer;
}

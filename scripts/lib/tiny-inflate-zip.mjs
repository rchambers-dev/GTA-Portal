/**
 * Minimal ZIP reader for OOXML (docx/pptx) content extraction.
 * Supports stored (0) and deflate (8) entries. No external deps.
 */
import { inflateRawSync } from "zlib";

function u16(buf, o) {
  return buf.readUInt16LE(o);
}
function u32(buf, o) {
  return buf.readUInt32LE(o);
}

/**
 * @param {Buffer} buf
 * @returns {Record<string, Uint8Array>}
 */
export function unzipSync(buf) {
  if (buf.length < 22) throw new Error("ZIP too small");
  // Find EOCD
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 66_000; i--) {
    if (u32(buf, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("EOCD not found");
  const entriesCount = u16(buf, eocd + 10);
  const centralOffset = u32(buf, eocd + 16);
  /** @type {Record<string, Uint8Array>} */
  const out = {};
  let off = centralOffset;
  for (let n = 0; n < entriesCount; n++) {
    if (u32(buf, off) !== 0x02014b50) throw new Error("Bad central directory");
    const method = u16(buf, off + 10);
    const compSize = u32(buf, off + 20);
    const nameLen = u16(buf, off + 28);
    const extraLen = u16(buf, off + 30);
    const commentLen = u16(buf, off + 32);
    const localOff = u32(buf, off + 42);
    const name = buf.slice(off + 46, off + 46 + nameLen).toString("utf8");
    off += 46 + nameLen + extraLen + commentLen;
    if (name.endsWith("/")) continue;

    if (u32(buf, localOff) !== 0x04034b50) throw new Error(`Bad local header ${name}`);
    const lNameLen = u16(buf, localOff + 26);
    const lExtraLen = u16(buf, localOff + 28);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const compressed = buf.slice(dataStart, dataStart + compSize);
    let data;
    if (method === 0) data = compressed;
    else if (method === 8) data = inflateRawSync(compressed);
    else throw new Error(`Unsupported ZIP method ${method} for ${name}`);
    out[name] = data;
  }
  return out;
}

export function strFromU8(u8) {
  return Buffer.from(u8).toString("utf8");
}

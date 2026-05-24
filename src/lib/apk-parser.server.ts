// Parser mínimo de AndroidManifest.xml binário (AXML) — extrai só
// versionCode e versionName do elemento raiz <manifest>. Pure JS,
// compatível com runtime Cloudflare Worker (sem deps nativas).
//
// Formato AXML (resumido):
// - Arquivo = sequência de chunks. Cada chunk: u16 type, u16 headerSize,
//   u32 chunkSize, depois body.
// - Tipos relevantes: 0x0001 STRING_POOL, 0x0102 START_ELEMENT.
// - STRING_POOL header: stringCount(u32), styleCount(u32), flags(u32,
//   bit 0x100 = UTF-8), stringsStart(u32), stylesStart(u32). Depois
//   offsets[stringCount] u32, depois bytes das strings.
//   - UTF-16: u16 length, então `length` chars u16, então u16 0.
//   - UTF-8: u8 utf16Len, u8 utf8Len (bit alto = length de 2 bytes),
//     então bytes UTF-8, então 0x00.
// - START_ELEMENT body (após chunk header de 8 bytes):
//   lineNumber(u32), comment(u32), ns(u32 strRef), name(u32 strRef),
//   attrStart(u16), attrSize(u16), attrCount(u16), idIdx(u16),
//   classIdx(u16), styleIdx(u16), depois attrCount atributos.
// - Atributo: ns(u32), name(u32), rawValue(u32), size(u16), 0(u8),
//   type(u8), data(u32). type 0x03 = string (data = strRef),
//   type 0x10 = int decimal (data = valor u32).

import { unzipSync, strFromU8 } from "fflate";

const CHUNK_STRING_POOL = 0x0001;
const CHUNK_START_ELEMENT = 0x0102;
const FLAG_UTF8 = 0x100;
const TYPE_STRING = 0x03;

export type ApkVersionInfo = {
  versionName: string | null;
  versionCode: number | null;
  packageName: string | null;
};

function readStringPool(buf: Uint8Array, offset: number): {
  strings: string[];
  endOffset: number;
} {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  // chunk header
  const chunkSize = dv.getUint32(offset + 4, true);
  const stringCount = dv.getUint32(offset + 8, true);
  const flags = dv.getUint32(offset + 16, true);
  const stringsStart = dv.getUint32(offset + 20, true);
  const utf8 = (flags & FLAG_UTF8) !== 0;

  const offsetsStart = offset + 28;
  const stringsBase = offset + stringsStart;
  const strings: string[] = [];
  const decoder = new TextDecoder(utf8 ? "utf-8" : "utf-16le");

  for (let i = 0; i < stringCount; i++) {
    const strOffset = dv.getUint32(offsetsStart + i * 4, true);
    let p = stringsBase + strOffset;
    if (utf8) {
      // u8 utf16Len (descartado) — pode ter bit alto para 2 bytes
      let u16len = buf[p++];
      if (u16len & 0x80) u16len = ((u16len & 0x7f) << 8) | buf[p++];
      let u8len = buf[p++];
      if (u8len & 0x80) u8len = ((u8len & 0x7f) << 8) | buf[p++];
      strings.push(decoder.decode(buf.subarray(p, p + u8len)));
    } else {
      let u16len = dv.getUint16(p, true);
      p += 2;
      if (u16len & 0x8000) {
        u16len = ((u16len & 0x7fff) << 16) | dv.getUint16(p, true);
        p += 2;
      }
      strings.push(decoder.decode(buf.subarray(p, p + u16len * 2)));
    }
  }
  return { strings, endOffset: offset + chunkSize };
}

function parseAxml(buf: Uint8Array): ApkVersionInfo {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  // Cabeçalho do arquivo XML (chunk type 0x0003): pula 8 bytes
  let offset = 8;
  let strings: string[] = [];
  let info: ApkVersionInfo = {
    versionName: null,
    versionCode: null,
    packageName: null,
  };

  while (offset < buf.byteLength - 8) {
    const type = dv.getUint16(offset, true);
    const headerSize = dv.getUint16(offset + 2, true);
    const chunkSize = dv.getUint32(offset + 4, true);
    if (chunkSize === 0) break;

    if (type === CHUNK_STRING_POOL) {
      const { strings: pool } = readStringPool(buf, offset);
      strings = pool;
    } else if (type === CHUNK_START_ELEMENT) {
      // body começa após chunk header (8) + XML node header (8: lineNumber + comment)
      const bodyStart = offset + 16;
      const nameIdx = dv.getUint32(bodyStart + 4, true);
      const attrStart = dv.getUint16(bodyStart + 8, true);
      const attrSize = dv.getUint16(bodyStart + 10, true);
      const attrCount = dv.getUint16(bodyStart + 12, true);
      const elementName = strings[nameIdx] ?? "";

      if (elementName === "manifest") {
        const attrsBase = bodyStart + attrStart;
        for (let i = 0; i < attrCount; i++) {
          const a = attrsBase + i * attrSize;
          const attrNameIdx = dv.getUint32(a + 4, true);
          const rawValueIdx = dv.getUint32(a + 8, true);
          const valueType = buf[a + 15];
          const valueData = dv.getUint32(a + 16, true);
          const attrName = strings[attrNameIdx] ?? "";
          if (attrName === "versionCode") {
            info.versionCode = valueData | 0;
          } else if (attrName === "versionName") {
            const idx = valueType === TYPE_STRING ? valueData : rawValueIdx;
            info.versionName = strings[idx] ?? null;
          } else if (attrName === "package") {
            const idx = valueType === TYPE_STRING ? valueData : rawValueIdx;
            info.packageName = strings[idx] ?? null;
          }
        }
        // já achamos o que precisa
        return info;
      }
    }
    offset += chunkSize;
  }
  return info;
}

export function extractApkVersion(apkBytes: Uint8Array): ApkVersionInfo {
  const files = unzipSync(apkBytes, {
    filter: (file) => file.name === "AndroidManifest.xml",
  });
  const manifest = files["AndroidManifest.xml"];
  if (!manifest) {
    throw new Error("AndroidManifest.xml não encontrado dentro do APK");
  }
  return parseAxml(manifest);
}
// strFromU8 reexport para o caller poder usar se precisar
export { strFromU8 };
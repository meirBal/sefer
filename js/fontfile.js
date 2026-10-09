// ===== FONT FILES — read a font file's real name and embedding licence (TrueType/OpenType 'name' + 'OS/2' tables),
// import fonts installed on this computer (Chrome/Edge desktop: Local Font Access), and embed a font in a .docx
// (ECMA-376 obfuscated font) so Word shows it on devices that don't have it installed. Pure helpers, no app state. =====

// → { family, embed: 'yes' | 'print' | 'no', why? } or null if not a TrueType/OpenType font (WOFF, junk, truncated).
// family = Windows GDI family name (nameID 1) — the name Word matches embedded fonts by.
export function fontInfo(buf) {
  try {
    const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf), v = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    const tag = (o) => String.fromCharCode(u8[o], u8[o + 1], u8[o + 2], u8[o + 3]);
    let base = 0, why = '';
    if (tag(0) === 'ttcf') { base = v.getUint32(12); why = 'ttc'; }        // collection: read the first face
    const kind = tag(base);
    if (!['\0\x01\0\0', 'OTTO', 'true'].includes(kind)) return null;
    if (kind === 'OTTO') why = 'cff';                                        // PostScript outlines: Word won't embed these
    const tables = {};
    for (let i = 0, n = v.getUint16(base + 4); i < n; i++) tables[tag(base + 12 + i * 16)] = v.getUint32(base + 12 + i * 16 + 8);
    const found = {};
    if (tables.name != null) {
      const t = tables.name, count = v.getUint16(t + 2), str = t + v.getUint16(t + 4);
      for (let i = 0; i < count && t + 6 + i * 12 + 12 <= v.byteLength; i++) {
        const r = t + 6 + i * 12, [pid, , lang, id, len, off] = [0, 2, 4, 6, 8, 10].map((k) => v.getUint16(r + k));
        if ((pid !== 3 && pid !== 0) || (id !== 1 && id !== 16) || str + off + len > v.byteLength) continue;
        let s = '';
        for (let k = 0; k + 1 < len; k += 2) s += String.fromCharCode(v.getUint16(str + off + k));
        found[`${id}:${pid === 3 && lang === 0x409 ? 'en' : 'x'}`] ??= s;
      }
    }
    let embed = 'yes';
    if (tables['OS/2'] != null) {                       // fsType: least restrictive bit wins
      const fs = v.getUint16(tables['OS/2'] + 8);
      embed = fs & 0x0200 ? 'no' : fs & 0x0008 || !(fs & 0x000E) ? 'yes' : fs & 0x0004 ? 'print' : 'no';
    }
    if (why) embed = 'no';
    return { family: (found['1:en'] || found['1:x'] || found['16:en'] || found['16:x'] || '').trim(), embed, why };
  } catch { return null; }                              // truncated / corrupt file
}

// Fonts installed on this computer whose family matches (Chrome/Edge on a computer; asks the user for permission).
export const canQueryLocal = () => typeof window.queryLocalFonts === 'function';
export async function localFonts(match = /guttman|^stam|סת"?ם/i) {
  const byFamily = new Map();
  for (const f of await window.queryLocalFonts()) if (match.test(f.family)) {
    const cur = byFamily.get(f.family);
    if (!cur || /regular|normal/i.test(f.style)) byFamily.set(f.family, f);   // prefer the regular style
  }
  return [...byFamily.values()];
}

// .docx embedding: the font's first 32 bytes XOR-ed with a key derived from a GUID (ECMA-376 Part 1 §17.8.1).
export function obfuscate(bytes) {
  const hex = crypto.randomUUID().replace(/-/g, '').toUpperCase(), out = new Uint8Array(bytes);
  const key = Array.from({ length: 16 }, (_, i) => parseInt(hex.substr(30 - i * 2, 2), 16));
  for (let i = 0; i < 32; i++) out[i] ^= key[i % 16];
  const guid = `{${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}}`;
  return { data: out, key: guid };
}

export const dataUrlBytes = async (url) => new Uint8Array(await (await fetch(url)).arrayBuffer());

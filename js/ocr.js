// ===== OCR — photos of printed pages → the app's document model, via the free server function page-ocr (Gemini).
// The phone shrinks each photo first (long side ≤ 2400 px JPEG for reading + a small thumbnail for the check strip),
// so neither the upload nor the screen ever holds the 12–48 MP original. One request per page. =====
const URL_OCR = 'https://enhqzgjqqyubgfysnjib.supabase.co/functions/v1/page-ocr';
const KEY = 'sb_publishable_w3aqbIxj_ECmMOUhANPebw_thGqD9o1';          // public key of the free server (no secrets here)
const SIZE = { small: 11, normal: 14, large: 18 }, HEAD = { 1: 18, 2: 15, 3: 14 };
const fail = (msg, status) => Object.assign(new Error(msg), { status });

const toJpeg = (bmp, s, q) => new Promise((ok, no) => {
  const c = Object.assign(document.createElement('canvas'), { width: Math.max(1, Math.round(bmp.width * s)), height: Math.max(1, Math.round(bmp.height * s)) });
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  c.toBlob((b) => { c.width = c.height = 0; b ? ok(b) : no(fail('הטלפון לא הצליח לעבד את התמונה')); }, 'image/jpeg', q);
});
const b64 = async (blob) => {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
};

// File → { full, thumb } JPEG blobs (EXIF orientation applied by the browser).
export async function shrink(file, max = 2400) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
    .catch(() => { throw fail('לא ניתן לפתוח את התמונה — שמרו או צלמו אותה כ-JPEG'); });
  try {
    const big = Math.max(bmp.width, bmp.height);
    return { full: await toJpeg(bmp, Math.min(1, max / big), 0.85), thumb: await toJpeg(bmp, Math.min(1, 240 / bmp.height), 0.7) };
  } finally { bmp.close?.(); }
}

// Shrunk photo (shrink().full) → [{runs:[{t,sz,b}], h, center, brk:false, empty:false}].
// Errors carry .status (0 = no network) so the caller can stop a batch on quota/network trouble.
export async function readPage(full, signal) {
  let res;
  try {
    res = await fetch(URL_OCR, { method: 'POST', signal, headers: { 'Content-Type': 'application/json', apikey: KEY }, body: JSON.stringify({ image: await b64(full) }) });
  } catch (e) { if (e.name === 'AbortError') throw e; throw fail('אין חיבור לאינטרנט — קריאת צילומים צריכה רשת', 0); }
  const out = await res.json().catch(() => ({}));
  if (!res.ok || !Array.isArray(out.paras)) throw fail(out.error || 'קריאת הדף נכשלה', res.status);
  return out.paras.map((p) => ({
    runs: p.runs.map((r) => ({ t: r.t, sz: p.heading ? HEAD[p.heading] : SIZE[r.size] || 14, b: !!(p.bold || p.heading) })),
    h: p.heading || 0, center: !!p.center, brk: false, empty: false,
  }));
}

// ===== page-ocr text clean-up — pure functions (unit-tested in tests/ocr-text.test.mjs) =====
const FOREIGN = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g;   // Arabic letters / harakat
// Runs of one paragraph: drop foreign marks, merge same-size neighbours, keep a space where two printed lines meet.
// A lone letter "run" is the model splitting a word at gershayim (אגימו״ן → "אגימו ", "ן"): glued back, not a size change.
export function tidy(runs: { t: string; size?: string }[]) {
  const out: { t: string; size?: string }[] = [];
  for (const r of runs) {
    const t = r.t.replace(FOREIGN, '').replace(/\s+/g, ' '), last = out.at(-1);
    if (!t.trim()) continue;
    if (!last) { out.push({ t, size: r.size }); continue; }
    const tiny = t.replace(/[\s\u0591-\u05C7]/g, '').length <= 1;
    if (tiny && /^[ךםןףץ]/.test(t)) last.t = last.t.trimEnd();       // a final letter ends the previous word
    else if (!/\s$/.test(last.t) && !/^[\s.,:;)\]״"']/.test(t)) last.t += ' ';
    if (tiny || last.size === r.size) last.t += t; else out.push({ t, size: r.size });
  }
  return out;
}
export type Para = { runs: { t: string; size?: string }[]; heading: number; center: boolean; bold: boolean };
// Gemini answer → paragraphs; [] when cut off (MAX_TOKENS), blocked (RECITATION/SAFETY) or not valid JSON → next model.
export function parse(out: any): Para[] {
  const c = out?.candidates?.[0];
  if (c?.finishReason !== 'STOP') { console.error('finish', c?.finishReason ?? out?.promptFeedback?.blockReason); return []; }
  try {
    return (JSON.parse(c.content?.parts?.[0]?.text ?? '{}').paras ?? []).slice(0, 400).map((p: any) => ({
      runs: tidy((p.runs ?? []).filter((x: any) => typeof x?.t === 'string' && x.t).map((x: any) => ({ t: x.t.slice(0, 5000), size: x.size }))),
      heading: Math.max(0, Math.min(3, Number(p.heading) || 0)), center: !!p.center, bold: !!p.bold,
    })).filter((p: Para) => p.runs.length);
  } catch { return []; }
}

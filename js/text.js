// ===== TEXT — pure helpers (no DOM): marks, tokens, Hebrew numerals, file-split plans =====

const NIQQUD = /[\u05B0-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]/g;
const TAAMIM = /[\u0591-\u05AF\u05C0]/g; // te'amim + paseq

// mode: all = keep everything · niqqud = drop cantillation only · none = plain letters
export const stripMarks = (s, mode) =>
  mode === 'none' ? s.replace(TAAMIM, '').replace(NIQQUD, '') : mode === 'niqqud' ? s.replace(TAAMIM, '') : s;

export const esc = (s) => String(s).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// Paragraph runs → layout tokens. A word keeps its trailing space, so splitting between tokens never orphans a space.
// Sizes are rounded to 0.5pt because Word stores half-points — screen and Word must use identical sizes.
export function tokenize(runs, mode, scale) {
  const out = [];
  for (const r of runs) {
    const sz = Math.round(r.sz * scale * 2) / 2;
    for (const part of stripMarks(r.t, mode).split('\n').entries()) {
      if (part[0]) out.push({ br: true, sz, b: r.b });
      for (const w of part[1].match(/[^ \t\r]+[ \t\r]*|[ \t\r]+/g) || []) out.push({ t: w, sz, b: r.b }); // NBSP stays in its word
    }
  }
  while (out.length && !out[0].br && !out[0].t.trim()) out.shift(); // leading blanks
  return out;
}

const HEB = [[400, 'ת'], [300, 'ש'], [200, 'ר'], [100, 'ק'], [90, 'צ'], [80, 'פ'], [70, 'ע'], [60, 'ס'], [50, 'נ'],
  [40, 'מ'], [30, 'ל'], [20, 'כ'], [10, 'י'], [9, 'ט'], [8, 'ח'], [7, 'ז'], [6, 'ו'], [5, 'ה'], [4, 'ד'], [3, 'ג'], [2, 'ב'], [1, 'א']];
const AVOID = [['רצח', 'רחצ'], ['רעב', 'ערב'], ['רעה', 'ערה'], ['שמד', 'שדמ'], ['רע', 'ער'], ['שד', 'דש']]; // customary reorderings (endings)
export function gematria(n) {
  let s = '';
  for (let r = n % 1000; r > 0;) {
    if (r === 15 || r === 16) { s += r === 15 ? 'טו' : 'טז'; break; }   // never spell the Divine Name
    const [v, c] = HEB.find(([v]) => v <= r);
    s += c; r -= v;
  }
  const fix = AVOID.find(([a]) => s.endsWith(a));
  if (fix) s = s.slice(0, -fix[0].length) + fix[1];
  return (n >= 1000 ? gematria(Math.floor(n / 1000)) + "'" : '') + s;
}
export const pageLabel = (n, fmt) => (fmt === 'heb' ? gematria(n) : fmt === 'num' ? String(n) : '');

// Split plan → list of [from, to] (1-based, inclusive). Throws a Hebrew message on bad input.
// mode: one | every (spec = N pages per file) | parts (spec = N files) | ranges (spec = "1-50, 51-120")
export function splitPlan(total, mode, spec) {
  if (total < 1) return [];
  if (mode === 'one') return [[1, total]];
  if (mode === 'ranges') {
    const out = String(spec).split(/[,;\n]+/).map((x) => x.trim()).filter(Boolean).map((x) => {
      const m = x.match(/^(\d+)\s*(?:-\s*(\d+))?$/);
      if (!m) throw new Error(`טווח לא תקין: "${x}"`);
      const a = +m[1], b = m[2] ? +m[2] : a;
      if (a < 1 || b > total || a > b) throw new Error(`הטווח ${x} מחוץ לעמודים 1–${total}`);
      return [a, b];
    });
    if (!out.length) throw new Error('לא הוזנו טווחים');
    return out;
  }
  const n = Math.floor(+spec);
  if (!(n >= 1)) throw new Error('יש להזין מספר חיובי');
  const out = [];
  if (mode === 'every') for (let a = 1; a <= total; a += n) out.push([a, Math.min(total, a + n - 1)]);
  else for (let k = 0, m = Math.min(n, total); k < m; k++) out.push([Math.floor(k * total / m) + 1, Math.floor((k + 1) * total / m)]);
  return out;
}

// Split by chapters: starts = 1-based pages where a chapter begins (sorted). n chapters per file; pages before the first
// chapter (title, introduction) go with the first file. → [[from, to, firstChapterIndex]]
export function chapterPlan(total, starts, n) {
  n = Math.floor(+n || 1);
  if (!(n >= 1)) throw new Error('יש להזין מספר חיובי');
  if (!starts.length) throw new Error('לא נמצאו פרקים — סמנו כותרות בוורד (כותרת 1) או בחרו חלוקה אחרת');
  const cuts = starts.filter((p, i) => i % n === 0).map((p, i) => (i === 0 ? 1 : p));
  return cuts.map((a, i) => [a, (cuts[i + 1] ?? total + 1) - 1, i * n]);
}

// Text edited in a plain text box → runs again, keeping each run's size/bold: only the changed middle takes the
// look of the run it was typed into. Then "\n" (Enter) splits into paragraphs. → [runs, runs, …] (empty ones dropped)
export function reRun(runs, oldT, newT) {
  let a = 0, b = 0;
  while (a < oldT.length && a < newT.length && oldT[a] === newT[a]) a++;
  while (b < oldT.length - a && b < newT.length - a && oldT[oldT.length - 1 - b] === newT[newT.length - 1 - b]) b++;
  const owner = runs.flatMap((r, i) => Array(r.t.length).fill(i));            // char → its run (UTF-16 units, as compared)
  const mid = owner[a > 0 ? a - 1 : a] ?? 0;
  const own = [...owner.slice(0, a), ...Array(newT.length - a - b).fill(mid), ...owner.slice(owner.length - b)];
  const paras = [[]];
  for (let i = 0; i < newT.length; i++) {
    if (newT[i] === '\n') { paras.push([]); continue; }
    const cur = paras.at(-1), last = cur.at(-1);
    if (last?.i === own[i]) last.t += newT[i]; else cur.push({ ...runs[own[i]], t: newT[i], i: own[i] });
  }
  return paras.map((rs) => rs.map(({ i, ...r }) => r)).filter((rs) => rs.some((r) => r.t.trim()));
}

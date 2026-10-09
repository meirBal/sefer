// ===== SEARCH — find text in the laid-out book. Matching ignores niqqud/te'amim and treats maqaf as a space, so
// "על פני" finds "עַל־פְּנֵי". Results point to (page, paragraph fragment, character range); the match is marked with the
// CSS Highlight API (no DOM changes — safe with letter stretching), falling back to marking the paragraph. =====
const SKIP = /[֑-ֽֿ׀ׁׂ׃ׇׅׄ]/;

// Normalized text + map from each normalized char to its index in the original string.
export function normMap(str) {
  let s = '';
  const map = [];
  for (let i = 0; i < str.length; i++) {
    let c = str[i];
    if (SKIP.test(c)) continue;
    if (c === '\u05BE' || /\s/.test(c)) { if (s.endsWith(' ') || !s) continue; c = ' '; }
    const l = c.toLowerCase();
    s += l.length === 1 ? l : c; map.push(i);              // keep s and map the same length
  }
  return { s, map };
}

// Per-layout caches: normalized paragraph text (paras array) and paragraph → page fragments (pages array).
const textCache = new WeakMap(), whereCache = new WeakMap();
function paraText(paras, pi) {
  let all = textCache.get(paras);
  if (!all) textCache.set(paras, (all = []));
  if (all[pi]) return all[pi];
  const starts = [], brs = [];                             // brs: char positions of <br> (absent from the page's DOM text)
  let text = '';
  for (const t of paras[pi].tok) { starts.push(text.length); if (t.br) { brs.push(text.length); text += '\n'; } else text += t.t; }
  return (all[pi] = { starts, brs, ...normMap(text) });
}
function pagesOf(pages) {
  let where = whereCache.get(pages);
  if (!where) {
    whereCache.set(pages, (where = new Map()));             // pi → [[fromTok, toTok, pageIdx]]
    pages.forEach((pg, k) => { if (!pg.blank) for (const it of pg.items) (where.get(it.pi) ?? where.set(it.pi, []).get(it.pi)).push([it.from, it.to, k]); });
  }
  return where;
}
export const queryLength = (q) => normMap(q.trim()).s.length;

// → [{ page (index), pi, from, to }] — from/to = char range inside that page's fragment DOM text.
export function find(query, paras, pages, max = 2000) {
  const q = normMap(query.trim()).s;
  if (q.length < 2) return [];
  const where = pagesOf(pages), out = [];
  for (let pi = 0; pi < paras.length && out.length < max; pi++) {
    const p = paras[pi];
    if (p.empty || p.orn) continue;
    const { s, map, starts, brs } = paraText(paras, pi);
    let tok = 0;
    for (let i = s.indexOf(q); i >= 0 && out.length < max; i = s.indexOf(q, i + 1)) {
      const from = map[i], to = map[i + q.length - 1] + 1;
      while (tok + 1 < starts.length && starts[tok + 1] <= from) tok++;   // matches come in order: pointer only moves forward
      const frag = (where.get(pi) || []).find(([a, b]) => tok >= a && tok < b);
      if (!frag) continue;
      const base = starts[frag[0]], dom = (c) => c - base - brs.filter((b) => b >= base && b < c).length;
      out.push({ page: frag[2], pi, from: dom(from), to: dom(to) });
    }
  }
  return out;
}

// Mark hit inside its page element. Text nodes inside stretched-letter overlays (.xp) are not part of the text.
export function mark(pageEl, src, hit) {
  clear();
  const frag = pageEl.querySelector(`[data-s="${src}"]`);
  if (!frag) return null;
  if (!window.CSS?.highlights || typeof Highlight === 'undefined') { frag.classList.add('hit'); return frag; }
  const tw = document.createTreeWalker(frag, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.parentElement.closest('.xp') ? 2 : 1) });
  const r = document.createRange();
  let pos = 0, started = false;
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    const end = pos + n.data.length;
    if (!started && hit.from < end) { r.setStart(n, hit.from - pos); started = true; }
    if (started && hit.to <= end) { r.setEnd(n, hit.to - pos); break; }
    r.setEnd(n, n.data.length);                             // match runs past this node (or past the page: clamp)
    pos = end;
  }
  if (started) CSS.highlights.set('found', new Highlight(r)); else frag.classList.add('hit');
  return frag;
}
export function clear() {
  window.CSS?.highlights?.delete('found');
  for (const e of document.querySelectorAll('.hit')) e.classList.remove('hit');
}

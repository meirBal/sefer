// Unit tests for pure helpers. usage: node book/tests/text.test.mjs
import assert from 'node:assert/strict';
import { stripMarks, tokenize, gematria, splitPlan, esc, chapterPlan, reRun } from '../js/text.js';
import { impose } from '../js/print.js';

const t = (name, fn) => { try { fn(); console.log('✓', name); } catch (e) { console.log('✗', name, e.message); process.exitCode = 1; } };
const word = 'בְּרֵאשִׁ֖ית';
t('marks: all keeps', () => assert.equal(stripMarks(word, 'all'), word));
t('marks: niqqud drops te\'amim only', () => assert.equal(stripMarks(word, 'niqqud'), 'בְּרֵאשִׁית'));
t('marks: none = letters', () => assert.equal(stripMarks(word, 'none'), 'בראשית'));
t('gematria', () => assert.deepEqual([1, 15, 16, 19, 115, 270, 272, 304, 670, 499, 1001, 1016].map(gematria), ['א', 'טו', 'טז', 'יט', 'קטו', 'ער', 'ערב', 'דש', 'תער', 'תצט', "א'א", "א'טז"]));
t('esc strips XML-illegal control chars', () => assert.equal(esc('a\x0Cb<'), 'ab&lt;'));
t('tokens keep trailing space, scale, half-points, br', () => {
  const k = tokenize([{ t: ' שלום  עולם\nשני', sz: 11, b: false }], 'all', 16 / 11);
  assert.deepEqual(k.map((x) => x.br ? '⏎' : x.t), ['שלום  ', 'עולם', '⏎', 'שני']);
  assert.equal(k[0].sz, 16);
});
t('split: one/every/parts', () => {
  assert.deepEqual(splitPlan(10, 'one'), [[1, 10]]);
  assert.deepEqual(splitPlan(10, 'every', 4), [[1, 4], [5, 8], [9, 10]]);
  assert.deepEqual(splitPlan(10, 'parts', 3), [[1, 3], [4, 6], [7, 10]]);
  assert.equal(splitPlan(9, 'parts', 4).length, 4);
  assert.deepEqual(splitPlan(3, 'parts', 9), [[1, 1], [2, 2], [3, 3]]);
});
t('split: ranges + errors', () => {
  assert.deepEqual(splitPlan(100, 'ranges', '1-48, 49-96;97'), [[1, 48], [49, 96], [97, 97]]);
  for (const bad of ['0-3', '5-2', '1-101', 'abc', '']) assert.throws(() => splitPlan(100, 'ranges', bad));
  assert.throws(() => splitPlan(10, 'every', 0));
});
t('impose: Hebrew booklet pairs 1↔last, 2↔last-1', () => {
  assert.deepEqual(impose(8, 'book'), [[0, 7], [6, 1], [2, 5], [4, 3]]);
  assert.deepEqual(impose(6, 'book'), [[0, null], [null, 1], [2, 5], [4, 3]]);   // padded to 8 with blanks
  assert.deepEqual(impose(8, 'sig', 4), [[0, 3], [2, 1], [4, 7], [6, 5]]);       // two 4-page signatures
});
t('chapter split: front matter joins first file, n per file', () => {
  assert.deepEqual(chapterPlan(20, [3, 8, 15], 1), [[1, 7, 0], [8, 14, 1], [15, 20, 2]]);
  assert.deepEqual(chapterPlan(20, [3, 8, 15], 2), [[1, 14, 0], [15, 20, 2]]);
  assert.throws(() => chapterPlan(20, [], 1));
});
import { fontInfo, obfuscate } from '../js/fontfile.js';
import fs from 'node:fs';
const FT = '/tmp/claude-0/ft';
if (fs.existsSync(`${FT}/TestEmbed-s.ttf`)) t('font file: real family name + embedding licence', () => {
  const read = (n) => fs.readFileSync(`${FT}/${n}`).buffer.slice(0);
  assert.deepEqual(fontInfo(read('TestEmbed-s.ttf')), { family: 'TestEmbed Serif', embed: 'yes', why: '' });
  assert.equal(fontInfo(new Uint8Array(read('TestEmbed-s.ttf')).slice(0, 300)), null);   // truncated file: no throw
  assert.equal(fontInfo(read('Restricted-s.ttf')).embed, 'no');
  assert.equal(fontInfo(new TextEncoder().encode('wOF2xxxxxxxxxxxx').buffer), null);
});
t('docx font obfuscation is reversible with the GUID key', () => {
  const src = Uint8Array.from({ length: 64 }, (_, i) => i), { data, key } = obfuscate(src);
  const hex = key.replace(/[{}-]/g, ''), k = Array.from({ length: 16 }, (_, i) => parseInt(hex.substr(30 - i * 2, 2), 16));
  assert.match(key, /^\{[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}\}$/);
  assert.notDeepEqual([...data.slice(0, 32)], [...src.slice(0, 32)]);
  assert.deepEqual([...data.slice(0, 32)].map((b, i) => b ^ k[i % 16]), [...src.slice(0, 32)]);
  assert.deepEqual([...data.slice(32)], [...src.slice(32)]);
});
t('reRun: a fixed letter keeps every run\'s size; Enter splits the paragraph', () => {
  const runs = [{ t: 'הוראה קטנה ', sz: 11, b: false }, { t: 'פסוק גדול', sz: 18, b: true }], old = 'הוראה קטנה פסוק גדול';
  assert.deepEqual(reRun(runs, old, old), [runs]);
  assert.deepEqual(reRun(runs, old, 'הוראה קטנה פסוק גדול!'), [[runs[0], { ...runs[1], t: 'פסוק גדול!' }]]);
  assert.deepEqual(reRun(runs, old, 'הוראה קטנה\nפסוק גדול'), [[{ ...runs[0], t: 'הוראה קטנה' }], [runs[1]]]);
  assert.deepEqual(reRun(runs, old, ' '), []);
});

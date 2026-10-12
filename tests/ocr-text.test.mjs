// page-ocr clean-up (server/page-ocr/text.ts). usage: node --experimental-strip-types tests/ocr-text.test.mjs
import assert from 'node:assert/strict';
import { tidy, parse } from '../server/page-ocr/text.ts';

const t = (name, fn) => { try { fn(); console.log('✓', name); } catch (e) { console.log('✗', name, '\n ', e.message); process.exitCode = 1; } };
const S = (t, size = 'small') => ({ t, size }), N = (t) => S(t, 'normal');
const ok = (paras) => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ paras }) }] } }] });

t('same-size runs merge, with a space where printed lines meet', () =>
  assert.deepEqual(tidy([S('סוף שורה'), S('תחילת שורה'), S(', ופסיק')]), [S('סוף שורה תחילת שורה, ופסיק')]));
t('size change keeps separate runs and one space between them', () =>
  assert.deepEqual(tidy([S('הוראה'), N('פסוק')]), [S('הוראה '), N('פסוק')]));
t('a lone final letter split at gershayim is glued back to its word', () =>
  assert.deepEqual(tidy([S('אגימו '), N('ן'), S(' אלימו '), N('ן'), S(' טפ')]), [S('אגימון אלימון טפ')]));
t('Arabic marks and empty runs are dropped, whitespace collapsed', () =>
  assert.deepEqual(tidy([S('שָׁלוֹםَ  עוֹלָם'), S('   ')]), [S('שָׁלוֹם עוֹלָם')]));
t('parse: cut-off / blocked / broken answers → [] (server tries the next model)', () => {
  assert.deepEqual(parse({ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{"paras":[' }] } }] }), []);
  assert.deepEqual(parse({ candidates: [{ finishReason: 'RECITATION' }] }), []);
  assert.deepEqual(parse(null), []);
  assert.deepEqual(parse({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'not json' }] } }] }), []);
});
t('parse: clamps heading, drops empty paragraphs and non-text runs', () =>
  assert.deepEqual(parse(ok([{ runs: [N('כותרת')], heading: 9, center: 1 }, { runs: [{ t: 5 }, N('')] }])),
    [{ runs: [N('כותרת')], heading: 3, center: true, bold: false }]));

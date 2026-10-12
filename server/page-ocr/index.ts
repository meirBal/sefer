// ===== EDGE FUNCTION page-ocr — photo of a Hebrew sacred-text page → paragraphs with niqqud, sizes, headings (Gemini free tier)
// Deployed on the HomeApp Supabase project (shares its GEMINI_API_KEY). No login (the book app has none), so it is guarded by
// an allowed-origin check and daily caps per IP and in total, counted in table public.ocr_calls (service role only).
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { parse } from './text.ts';

const ORIGINS = ['https://meirbal.github.io', 'http://localhost', 'http://127.0.0.1'];
const PER_IP = 40, TOTAL = 150;                                  // pages per 24h (free-tier friendly)
const allowed = (o: string) => { try { const u = new URL(o); return ORIGINS.includes(`${u.protocol}//${u.hostname}`); } catch { return false; } };
const cors = (o: string) => ({
  'Access-Control-Allow-Origin': allowed(o) ? o : ORIGINS[0],
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Vary': 'Origin',
});

const PROMPT = `זהו צילום של דף מטקסט קודש בעברית (סידור, תפילה, ספר). העתק את כל הטקסט שבדף.
כללים:
- העתק בדיוק כפי שמודפס: כל אות, ניקוד, טעמים, פיסוק, גרש וגרשיים, מירכאות ומראי מקומות בסוגריים. אל תתקן, אל תשלים ואל תשנה מילים — גם אם נראה שיש טעות. שמות קודש וכינויים (הויה, אלקים, ה׳) בדיוק כפי שהם בדף.
- ניקוד: רק היכן שהוא מודפס. שורה או מילה שמודפסת בלי ניקוד — העתק בלי ניקוד. אל תנחש ניקוד.
- רק אותיות עבריות, ניקוד וטעמים עבריים, ספרות ופיסוק. לעולם לא אותיות או סימנים בערבית או בכתב אחר.
- כשמילה לא ברורה — קרא אותה לפי ההקשר של הפסוק או התפילה המוכרים, אבל כתוב רק את מה שמודפס.
- סדר קריאה: מימין לשמאל, מלמעלה למטה. אל תשבור פסקה באמצע במקום שבו רק השורה נגמרת — פסקה = קטע רציף של טקסט.
- כל פסקה היא פריט ב-paras. בתוך פסקה, runs = קטעים לפי גודל האותיות (קטע חדש רק כשהגודל משתנה, לא בסוף שורה): size = small / normal / large ביחס לטקסט הרגיל בדף (פסוקים באותיות גדולות = large, הוראות והערות באותיות קטנות = small).
- heading: 1 לכותרת ראשית, 2 לכותרת משנה או שורת כותרת בראש הדף, 0 לטקסט רגיל. center: true אם הפסקה ממורכזת. bold: true אם מודגשת.
- טקסט בשוליים או בעמודה צדדית ששייך לשורה (למשל "יום א") — כתוב אותו בתחילת אותה פסקה ואחריו " – ".
- טקסט בתוך מסגרת — פסקה ממורכזת.
- התעלם ממספר עמוד מודפס, מחותמות, מכתמים ומטקסט שנראה דרך הנייר מהצד השני.`;

// Model order: strongest free model first; the lighter ones when the free tier is busy or over quota. Override: OCR_MODELS.
const MODELS = (Deno.env.get('OCR_MODELS') || 'gemini-pro-latest,gemini-flash-latest,gemini-flash-lite-latest').split(',');
const RUN = { type: 'OBJECT', properties: { t: { type: 'STRING' }, size: { type: 'STRING', enum: ['small', 'normal', 'large'] } }, required: ['t', 'size'] };
const SCHEMA = {
  type: 'OBJECT',
  properties: { paras: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
    runs: { type: 'ARRAY', items: RUN }, heading: { type: 'INTEGER' }, center: { type: 'BOOLEAN' }, bold: { type: 'BOOLEAN' } },
    required: ['runs'] } } },
  required: ['paras'],
};

Deno.serve(async (req) => {
  const origin = req.headers.get('origin') ?? '', h = cors(origin);
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...h, 'Content-Type': 'application/json' } });
  if (req.method === 'OPTIONS') return new Response('ok', { headers: h });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  if (!allowed(origin)) return json({ error: 'לא מורשה' }, 403);
  try { return await handle(req, json); } catch (e) { console.error(e); return json({ error: 'שגיאת שרת' }, 500); }
});

async function handle(req: Request, json: (b: unknown, s?: number) => Response) {
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) return json({ error: 'קריאת צילומים עדיין לא הופעלה' }, 503);
  let image: string;
  try { ({ image } = await req.json()); } catch { return json({ error: 'בקשה לא תקינה' }, 400); }
  if (typeof image !== 'string' || image.length < 1000 || image.length > 4_500_000) return json({ error: 'התמונה לא תקינה או גדולה מדי' }, 400);

  // ----- daily caps (atomic, in SQL). IP = the address Cloudflare saw — the caller can't fake it, unlike x-forwarded-for[0] -----
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const ip = (req.headers.get('cf-connecting-ip') ?? req.headers.get('x-real-ip') ?? (req.headers.get('x-forwarded-for') ?? '').split(',').at(-1) ?? '').trim().slice(0, 64);
  const { data: cap, error } = await sb.rpc('ocr_take', { p_ip: ip, per_ip: PER_IP, total: TOTAL });
  if (error) throw error;
  if (cap === 'ip') return json({ error: `הגעת ל־${PER_IP} דפים היום — אפשר להמשיך מחר` }, 429);
  if (cap === 'all') return json({ error: 'המכסה היומית של השירות נוצלה — אפשר להמשיך מחר' }, 429);

  // ----- Gemini: main model, then the lighter one when the free tier is busy -----
  const body = JSON.stringify({
    contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: 'image/jpeg', data: image } }] }],
    generationConfig: { temperature: 0, maxOutputTokens: 32768, responseMimeType: 'application/json', responseSchema: SCHEMA },
  });
  const t0 = Date.now(), left = () => 140_000 - (Date.now() - t0);    // stay inside the edge function's ~150 s limit
  let status = 0;
  for (const model of MODELS) {
    for (let retry = 0; retry < 2 && left() > 15_000; retry++) {
      if (retry) await new Promise((ok) => setTimeout(ok, 2500));
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST', signal: AbortSignal.timeout(Math.min(left(), model.includes('pro') ? 50_000 : 45_000)),
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body,
      }).catch(() => undefined);
      status = r?.status ?? 0;
      const paras = r?.ok ? parse(await r.json().catch(() => null)) : (await r?.body?.cancel(), []);
      if (paras.length) { console.log('model', model, Date.now() - t0); return json({ paras, model }); }
      if (r?.ok) status = 422;
      console.error('gemini', model, status || 'timeout', Date.now() - t0);
      if (![500, 503].includes(status) || left() < 70_000) break;   // retry "busy" once, only if the next models still get their turn
    }
  }
  if (status === 429) return json({ error: 'עברנו את המכסה החינמית להיום — נסו מחר' }, 429);
  if (status === 422) return json({ error: 'לא הצלחתי לקרוא את הדף — נסו צילום חד וישר יותר' }, 422);
  return json({ error: 'שירות הקריאה עמוס כרגע — נסו שוב בעוד דקה' }, 502);
}

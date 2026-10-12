## 2.3.0 — 2026-10-12
- צילום דף → טקסט: קריאת דפים מודפסים בשירות AI חינמי, תמונות לבדיקה מעל הטקסט, עצירה, דף שנכשל מסומן
- previous: v2.2.1 (rollback: scripts/rollback.sh 2.2.1)

## 2.2.1 — 2026-10-09
- Missing-font guidance corrected: Office fonts are used on the computer they came with and travel inside the Word/PDF files you make; copying the font file to other devices needs an extended licence
- previous: v2.2.0 (rollback: scripts/rollback.sh 2.2.0)

## 2.2.0 — 2026-10-09
- Fonts: import Guttman Stam straight from the computer (Chrome/Edge); added font files keep their real Word name; the font is embedded inside exported Word files (when its licence allows) so Word shows it on devices without it — e.g. a phone; clear steps when the font is missing
- previous: v2.1.0 (rollback: scripts/rollback.sh 2.1.0)

## 2.1.0 — 2026-10-09
- Text search (ignores niqqud/te'amim, maqaf = space; highlights; ▲▼ / Enter); save split 'by chapters' (N chapters per file, files named by chapter); new option: chapter starts on a new page / right-hand page (auto blank)
- previous: v2.0.0 (rollback: scripts/rollback.sh 2.0.0)

## 2.0.0 — 2026-10-09
- Moved to its own address https://meirbal.github.io/sefer/ (own repo, full history and restore points kept); no longer shares anything with the home-management app
- previous: v1.3.0 (rollback: scripts/rollback.sh 1.3.0)

<!-- v1.x was developed inside meirBal/home-app (book/); its rollback lines there read "APP=book …" — here use scripts/rollback.sh X.Y.Z -->
## 1.3.0 — 2026-10-09
- Installs as its own app (own name, icon and home-screen entry) alongside the home-management app
- previous: v1.2.3 (rollback: APP=book scripts/rollback.sh 1.2.3)

## 1.2.3 — 2026-10-09
- New releases show on the next open (no 10-minute browser cache, no mix of old and new files); works offline after first use
- previous: v1.2.2 (rollback: APP=book scripts/rollback.sh 1.2.2)

## 1.2.2 — 2026-10-09
- Fix: print preview pages slid off-screen on phones (booklet sheets); share button — PDF straight to WhatsApp/any app via the phone's share sheet (desktop: saved for attaching); share-the-app link
- previous: v1.2.1 (rollback: APP=book scripts/rollback.sh 1.2.1)

## 1.2.1 — 2026-10-09
- One booklet limited to 64 pages (thick books → signatures) with clear message; print preview tells which paper size to pick (phones ignore the page size)
- previous: v1.2.0 (rollback: APP=book scripts/rollback.sh 1.2.0)

## 1.2.0 — 2026-10-09
- Stam justification by stretching one word-final ם/ת/ה per line (roof only, max 1.8x, Divine Names protected); settings split basic/advanced; duplex test sheet; optional enlarged first word + chapter dividers; review fixes (lazy word wrapping, per-unit PDF stretching, divider never at a page edge, settle cap)
- previous: v1.1.0 (rollback: APP=book scripts/rollback.sh 1.1.0)

## 1.1.0 — 2026-10-09
- Tap text to edit (type/size/bold/center/new page/merge/delete, undo); headers right+center+left; page number top/bottom, outer (mirrored) or fixed side, numbering start, hide per page; running head first/last; no lone lines at page breaks; fix: headings no longer forced onto their own page; print preview; booklet (1+last, 2+last-1…) and signatures; ready PDF (gray or 1-bit 600dpi); bundled free square font; phone tabs + page ⋯ button; 3-role review fixes
- previous: v1.0.0 (rollback: APP=book scripts/rollback.sh 1.0.0)

## 1.0.0 — 2026-10-08
- First release: Word → book in Ashuri/Stam script — A5/A4, proportional sizing, niqqud/te'amim options, running headers (auto/edit/copy/forward), Hebrew page numbers, blank pages + padding, Word export (exact page breaks) and print/PDF, split into files; 37 review fixes
- first release


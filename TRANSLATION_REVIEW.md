# Translation review — Hindi and Kannada (P12)

Status of the P12 interface translation: English (en), Hindi (hi), Kannada (kn).

## What is covered

- Typed dictionary in `src/lib/i18n.ts` with 60 keys per language. The `hi` and `kn`
  tables are typed as `Record<TranslationKey, string>`, so a missing or extra key is
  a compile error, not a silent English leak.
- Core ledger vocabulary: gold slip, jeweller, karigar, issue, return, settle,
  approved, pending, due date, weight, purity, job, wastage, wedding, amount, status.
- Dashboard: header actions, all seven navigation tabs, KPI labels, section titles,
  the issue-gold action and the loading line.
- Karigar phone: back action, "The karigar's side", viewer label, gold-in-hand balance.
- Offline banner: queued-action counts (singular and plural), saved-locally and
  connection-required notices, sync action.
- The language switcher (`EN` / `हिंदी` / `ಕನ್ನಡ`) sits in both the jeweller header and
  the karigar header. Each target is 48×48 px (`min-h-12 min-w-12`).
- Choice is per browser and per session: stored under `tola.language`, applied through
  an external store, so every mounted screen switches instantly; `document.lang` is
  updated too.

## Untranslated on purpose

- Demo-only narrative panels, AI agent transcripts, judge notes, ledger event prose and
  seeded names stay in English. Translating generated event text would imply the data
  itself is localized, which it is not.
- Money and weight formats (`₹`, `g`, dates) keep their Indian formatting in all three
  languages.

## Fonts

Local Noto Sans Devanagari and Noto Sans Kannada (400/700, WOFF2) are in
`public/fonts/`, declared with `@font-face` in `src/app/globals.css`. Font stacks keep
the Latin sketch faces first, so English keeps the hand-drawn look while Devanagari and
Kannada glyphs fall through to Noto. No Google Fonts request is made at runtime, which
matters on patchy signal.

## Review method and gaps

- `tests/i18n.test.ts` asserts exact key parity for all three dictionaries, no empty or
  placeholder values, translated core terms (not copied English), interpolation, and the
  English fallback for a missing key.
- Hindi and Kannada strings were written for this demo and should get a native-speaker
  review before a pilot, particularly `common.wastage` (क्षय / ವೇಸ್ಟೇಜ್) and
  `dash.daysToPay`, where trade usage varies by region.
- No screen-reader or low-literacy user test has been run. The English fallback means a
  review fix can land one string at a time without breaking the UI.
- Not every component string is wired yet: the issue/settle panels, AI agent screens and
  message log still render English copy. Their labels are in the dictionary where they
  are shared, but a full pass is follow-up work.

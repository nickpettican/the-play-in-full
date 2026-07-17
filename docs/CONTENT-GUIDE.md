# Content guide — The Unfolding Play

How to add dialogue, quotes, and characters to the game. For agents and humans alike.

## Ground rules

1. **Never fabricate scripture.** Every answer or narration line that claims a source must be a
   faithful quotation (or tight, honest condensation) of a real text, and `src` must name it.
   If a line is only inspired by a text, prefix the source with `after` (e.g. `after the Diamond Sūtra`).
2. Narration from the Lalitavistara must be verbatim from the translation in
   `raw/extracted/play-in-full-lalitavistara-toh95.md` (84000, Toh 95). Trim only folio markers
   like `[F.123.b]` and footnote numbers.
3. Keep each bubble 1–4 sentences. Long teachings are split across several pages (array entries).
4. The raw Lalitavistara file is extracted from `raw/epubs/…toh95.epub` by
   `tools/extract_source.py` and includes verses and `[14.­10]`-style milestone anchors
   (chapter.passage, matching the 84000 reading room — cite these, they survive
   re-extraction). When quoting, strip milestones, folio markers (`[F.96.b]`), bare
   bracketed numbers, and trailing footnote digits. Planned scenes with verified anchors
   live in `docs/content-expansion-spec.md`.

## Where everything lives

All text is in **`src/content.js`**. No other file needs touching for content work.

| Export | What it is |
|---|---|
| `NARRATION` | Per-act story pages: `{ act0: [{q, src}, ...], ... act12 }` |
| `QA_PALI` | Question bank for ordinary monastics (90% draw from here) |
| `QA_MAHAYANA` | Question bank for the Mahayana minority (10%) and bodhisattvas |
| `QA_IMPERMANENCE` | Bank used by the sangha in Act XII (the great passing) |
| `BODHISATTVAS` | The eight great bodhisattvas: `{name, hue, qa: [...]}` |
| `DISCIPLES` | The great disciples: `{name, halo, robe, qa: [...]}` |
| `SCRIPT` | The few scripted, non-scriptural lines (prompts, ending titles) |

## Adding a question and answer

Append an object to the right bank or character:

```js
{ q: 'What the player asks (shown as a menu choice)?',
  a: 'The answer, quoted or faithfully condensed from a real text.',
  src: 'Dhammapada 183' }
```

- `QA_PALI` sources: Pali canon only (Dhammapada, Majjhima/Saṃyutta/Aṅguttara Nikāya, Sutta Nipāta…).
- `QA_MAHAYANA` sources: Mahayana sutras (Heart, Diamond, Lotus, Vimalakīrti, Avataṃsaka, Lalitavistara…).
- A bodhisattva's `qa` must always be Mahayana. A disciple's `qa` should be something that
  disciple actually says (or is taught) in the suttas — check who speaks in the cited text.
- Nothing else to wire up: markers, menus, and the "questions exhausted" logic are automatic.
  NPCs pick randomly from the banks at spawn (`pickQA` in `src/acts.js`).

## Adding a disciple or bodhisattva

Append to `DISCIPLES` (set `halo: 'white'` only if the person was an arhat during the
Buddha's life — Ānanda, famously, was not) or to `BODHISATTVAS` (pick an unused `hue`).
They are spawned automatically in the Jeta Grove acts (0, XI, free roam) by
`spawnDisciples` / `spawnSangha` in `src/acts.js`.

## Adding narration pages to an act

Append `{q, src}` objects to the act's array in `NARRATION`. Acts show them in order in one
bubble sequence; the mindfulness meter tracks reading pace on any narration opened with
`{focus: true}`. Extraction tip: chapter headings in the raw sutra file are `##` lines —
grep for them, then copy contiguous prose.

## Testing your changes

No build step. Serve the repo root (`python -m http.server 8433`) and open the game.
Debug hooks on `window`: `__game` (state, `interactables`), `__player`, and
`__startAct(n)` to jump straight to an act (0–12). A puppeteer auto-player pattern lives in
the project memory: teleport to `__game.interactables[0]`, click `.choice` / `.next` in the DOM.

## Translating the game (i18n)

UI strings live in `src/i18n.js` (`STR.en` / `STR.es`); act titles and the few non-verbatim
script lines live in `src/content.js` (`ACT_TITLES_ES`, `SCRIPT_ES`). The Spanish option on
the title screen is currently disabled (`#langStep .charCard.off` in `index.html`) because the
game content itself — `NARRATION` and the Q&A banks — is not yet translated.

To finish Spanish support: add Spanish variants of `NARRATION` and the Q&A banks and switch
on them via `LANG` (follow the `actTitle()` / `script()` pattern), then remove the `off` class
from the Español card in `index.html`. Rule that must not be broken: scripture quotes must
come from a real published translation, cited in `src` — never machine-translate or paraphrase
the 84000 English text and present it as the sutra. If no published Spanish translation exists
for a passage, keep that passage in English and mark the interface accordingly.

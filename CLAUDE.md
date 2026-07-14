# The Play in Full — agent instructions

A complete open-world Three.js browser game of the Buddha's twelve deeds from the
Lalitavistara Sutra (Spanish title: "La Obra Completa").

## Hard rules

1. **Never fabricate scripture.** Narration is verbatim from the 84000 translation in
   `raw/extracted/play-in-full-lalitavistara-toh95.md`; NPC answers are faithful quotations
   with a `src` attribution. Full rules in `docs/CONTENT-GUIDE.md`. Never machine-translate
   scripture — that is why the Spanish content is deferred.
2. **No build step.** Serve the repo root statically (`python -m http.server 8433`) and open
   `index.html`. The user manages the server; assume it is already running on port 8433.
3. Three.js is pinned to **0.180.0** via the jsdelivr import map in `index.html` (and
   `posetest.html`). No npm, no bundler, no new dependencies.
4. All geometry is procedural except the decimated GLBs in `assets/models/`.
5. Use British English in text and comments.
6. **Never tune character poses blind.** Use `posetest.html` (sliders + copyable output);
   see `docs/characters-and-poses.md`.

## Documentation

- `docs/architecture.md` — module map, boot flow, act lifecycle, worlds, dialogue, NPCs.
- `docs/characters-and-poses.md` — the character rig, pose conventions, posetest workflow.
- `docs/testing.md` — e2e hooks, puppeteer patterns, screenshot camera maths, known gotchas.
- `docs/CONTENT-GUIDE.md` — adding dialogue/quotes/characters, i18n, quote-fidelity rules.

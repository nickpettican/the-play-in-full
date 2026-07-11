# Testing and debugging

No test framework. Verification is `node --check` on every module plus puppeteer-core
scripts against the running dev server, reviewing screenshots as images.

```sh
for f in src/*.js; do node --check "$f" || echo "FAIL $f"; done
```

The dev server is `python -m http.server 8433` at the repo root — assume the user already
has it running.

## Debug hooks (set in `src/main.js`)

- `window.__game` — `{act, updaters, props, interactables}`
- `window.__player` — the player object (`pos`, `yaw`, `camYaw`, `camPitch`, `person`,
  `world`, `sitToggle`, …)
- `window.__startAct(n)` — jump to an act
- `window.__snapDaylight(name)` — instant daylight preset ('night' to see the moon)

## Booting the game from a script

The title screen has THREE steps — forgetting the language step breaks old scripts:

```js
await page.goto('http://localhost:8433/', { waitUntil: 'networkidle2' });
await page.click('#beginBtn');
await page.click('.charCard[data-l="en"]');          // language step
await page.waitForFunction(() =>
  document.getElementById('loadNote').textContent.trim() === '');
await page.click('.charCard[data-c="nun"]');          // or "monk"
```

Launch: puppeteer-core with `executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'`,
`headless: 'new'`, args `['--use-angle=metal', '--enable-unsafe-swiftshader', '--mute-audio']`.
Always attach `page.on('pageerror', …)`.

## Screenshot camera maths (repeated source of black frames)

The camera orbits the PLAYER at fixed distance ~5.2 and always looks at the player's head:

```
cameraPos = playerPos + (sin(camYaw)·cos(camPitch), sin(camPitch), cos(camYaw)·cos(camPitch)) · dist
```

- View direction is therefore `−(sin camYaw, ·, cos camYaw)`. To look toward a target at
  `(dx, dz)` from the player: `camYaw = atan2(−dx, −dz)`.
- To photograph a character's FRONT: stand the player a few metres along the character's
  facing direction (`(sin ry, cos ry)`), then set `camYaw = ry` so the camera lies further
  along the same ray looking back. Getting this backwards puts the camera INSIDE the
  character → solid black frame.
- Character facing: `rotation.y = 0` faces +z; `rotation.y = atan2(dx, dz)` faces a target.
- The avatar lerps toward `player.yaw` each frame — set `person.group.rotation.y` again
  after a settle delay if you need an exact facing.
- Daylight presets aim the sun/moon at horizontal direction `(cos az, sin az)` (NOT
  sin/cos): to look at the moon, `camYaw = atan2(−cos az, −sin az)`, `camPitch ≈ −el`.

## E2E auto-playthrough

The scratchpad pattern (`e2e.mjs`): boot as above, then in a loop teleport to
`__game.interactables[0]` (or the nearest NPC), fire interact, click `.next`/`.choice`
elements until the bubble closes, and watch `__game.act` advance −1 → 12. A clean run
reaches "ending + free roam" with no page errors in ~6–8 minutes (rushing dialogue is
rate-limited by the mindfulness meter, so pace clicks).

## Pose screenshots

`posetest.html` (see `docs/characters-and-poses.md`) exposes `window.__cam(yaw, pitch, dist)`
and `window.__set(key, value)`. The scratchpad `poseshot.mjs` pattern: load
`posetest.html?mode=…&aLx=…`, then screenshot front / three-quarter / side views.

## Known gotchas

- **GLB renders black** → its material has metalness 1; `instantiate()` in engine.js zeroes
  it — use `instantiate`, never add raw GLTF scenes.
- **Sky-shader features vanish** → `vDir` must be re-normalised in the fragment shader;
  interpolated varyings shrink mid-triangle and tight `dot` thresholds (moon disc) never fire.
- **Arms snap back when an anim changes** → set `P.lockArms = true` for hand-posed arms.
- **A character bows in a loop** → someone set a huge `bowT`; use `P.bowHold = true`.
- **Quadruped legs cross sideways** → they are authored along +x: swing legs about
  `rotation.z`, not x.
- **Stale camera between acts** → `camYaw` carries over; set `player.camYaw` (and `yaw`)
  after `transition()` when the act should open facing something.
- **Pose numbers clip inside the Buddha** → his arms are 1.25× longer; retune him
  separately in posetest's `buddha` mode.

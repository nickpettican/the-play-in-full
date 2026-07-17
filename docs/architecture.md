# Architecture

Plain ES modules, no build step. `index.html` defines an import map (three@0.180.0 from
jsdelivr) and loads `src/main.js`. Everything else is `import`ed from there.

## Module map

| File | Role |
|---|---|
| `src/main.js` | Boot: title screen (BEGIN → language step → character pick), preload, main loop, debug hooks |
| `src/engine.js` | Renderer, camera, sky-dome shader (sun, moon disc, stars), lights, day/night presets, GLB loading |
| `src/world.js` | `World` class (procedural terrain) + one builder per location, `switchWorld(name)` |
| `src/acts.js` | The 13-act state machine (`ACTS[0..12]` + prelude −1) and stage helpers |
| `src/characters.js` | Procedural people and animals (see `docs/characters-and-poses.md`) |
| `src/cloth.js` | Verlet cloth dress (robes, skirts, hair, tops, wraps), auto-attached by `makePerson` (see `docs/cloth-simulation.md`) |
| `src/player.js` | Third-person controller, camera, witness forms, begging bowl |
| `src/npc.js` | NPC spawning, wandering, talk menus, Q&A state |
| `src/dialogue.js` | Speech bubble, typewriter, choices, mindfulness meter, act title cards, fade veil |
| `src/content.js` | ALL text: narration, Q&A banks, act titles (en/es), scripted lines |
| `src/i18n.js` | UI strings `STR.en/.es`, `T(key)`, `LANG`, `setLang` (localStorage `pif-lang`) |
| `src/audio.js` | WebAudio ambiences, procedural sfx, `sfxFile()` for the mp3 stingers |
| `src/particles.js` | petals, motes, radiance, fireflies, aura |

## Boot flow

BEGIN button → language step (`.charCard[data-l]`; Español card is disabled/"próximamente"
until content is translated) → character pick (`.charCard[data-c]`, monk or nun) →
`createPlayerAvatar` → `startAct(0)`. The main loop calls `updatePlayer`, `updateNPCs`,
`updateActs`, `updateParticles`, `updateDaylight` each frame.

## Act lifecycle (`src/acts.js`)

Each act is an async function in the `ACTS` array. The standard opening:

```js
ACTS[n] = async () => {
  const W = await transition(n, 'worldName', 'daylightPreset', 'ambienceName');
  // stage the scene…
};
```

`transition()` fades out, calls `clearStage()` (removes props, updaters, interactables and
NPCs), switches world, moves the player to `W.spots.playerStart`, snaps daylight/ambience,
shows the act title card, fades in. Set `player.camYaw`/`player.yaw` right after `transition`
if the default spawn faces the wrong way.

Stage helpers (module-local in acts.js):

- `addProp(obj)` — add to scene, auto-removed on next transition.
- `onUpdate(fn)` — per-frame updater `(dt, t)`, cleared on transition.
- `addInteractable({pos, r, markerY, host, action})` — floating speech-bubble marker; `pos`
  can be a Vector3 or a function; `action(it)` runs on E/tap, call `it.remove()` inside.
- `walkPerson(P, from, to, speed, W, done)` — walk a character across terrain.
- `placeBuddha(W, pos, {ry})` — seated Buddha on the stone seat (used in Jeta acts).
- `pickQA(bank, n)` — draw n random Q&A from a content.js bank.
- `spawnSangha` / `spawnDisciples` — the Jeta Grove assembly.
- `nextAct()` — advance; `startAct(i)` — jump (also on `window.__startAct`).

## Worlds (`src/world.js`)

`switchWorld(name)` with names from `BUILDERS`: `jeta`, `tushita`, `kapilavastu`, `lumbini`,
`magadha`, `deerpark`, `kushinagar`. Each builder makes a `World`:

- Periodic value-noise terrain (`groundHeight(x, z)` works everywhere; the world wraps).
- `flatten(x, z, r, h)` before `buildTerrain()`; `addCollider(x, z, r, h?)` for cylinders;
  `camBlockers` are raycast by the player camera; `spots` holds named Vector3 locations.
- `addWater(y)` sets a wadeable water level.
- Kapilavastu has palace walls with player-proximity swinging gate doors; `W.removeGate()`
  is called in the Great Departure act.

## Engine notes (`src/engine.js`)

- Day/night presets in `DAYLIGHT` (day, morning, golden, dusk, night, heaven, radiance);
  `setDaylight(name, dur)` lerps, `snapDaylight` is instant. `moon` in a preset shows the
  sky-shader moon disc and damps the sun bloom.
- Sky shader gotcha: `vDir` must be re-normalised in the fragment shader — interpolation
  shortens it mid-triangle and silently kills tight `dot`-threshold features like the moon disc.
- GLBs load via `loadModel(name)` + `instantiate()`, which zeroes metalness (decimated GLBs
  otherwise render black) and applies shadow flags.

## Dialogue and mindfulness (`src/dialogue.js`)

`showNarration(pages, done, opts)` — pages are `{q, src?, who?}`. Mindfulness (`dialogue.focus`,
0..1) is tracked by default (`opts.focus !== false`): interrupting the typewriter costs focus
(and is refused at 0), a patient read earns some, sitting quietly (Ctrl) restores it slowly.
The player's halo opacity IS the meter. `showChoices` for menus, `showAnswer` for one Q→A.

## NPCs (`src/npc.js`)

`spawnNPC({kind, name, pos, yaw, behaviour: 'wander'|'idle'|'sit', qa, robe, skin, scale,
seesWitness})`. While the player is the translucent witness (Acts II–IX) NPCs ignore them —
no talking, no markers — unless spawned with `seesWitness: true`. `nearestNPC()` applies
that filter internally.

## Player (`src/player.js`)

- `setWitnessForm('heavenly'|'translucent'|'normal')`: deva form in Tushita, translucent
  monastic until the first teaching, then flesh again.
- Controls: WASD/stick, Shift run, Space jump, E/tap interact, F/right-click bow, R bowl,
  Ctrl sit. Mobile UI appears on coarse pointers.
- The camera orbits `camYaw/camPitch` at fixed distance with raycast collision against
  `camBlockers` (see `docs/testing.md` for the screenshot maths).

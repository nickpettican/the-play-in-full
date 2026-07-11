# Characters and poses

All characters are procedural primitives built in `src/characters.js`.

## The humanoid rig (`makePerson(opts)`)

`opts`: `{kind, robe, skin, halo, scale, ornate, hair, hairColor, skinny, handsJoined}`.
Kinds: monk, nun, laywoman, layman, deva, devi, prince, ascetic, demon, buddha.
Returned `P` exposes `group, body, headG, armL, armR, elbL, elbR, legL, legR, skirt`,
plus `setAnim('idle'|'walk'|'sit'|'lie'|'rage')`, `update(dt, t)`, `bow()`.

Anatomy (before `scale`):

- `root` → `body` (y 0.85, everything above the hips) → torso, neck, headG, arms.
- Arms: shoulder groups `armL`/`armR` at x ±0.255, y 0.52 → upper capsule → elbow group
  `elbL`/`elbR` at local y −0.37 → forearm + hand (hand at elbow-local y −0.33).
- **`armL` (the −x arm) is the anatomical RIGHT arm** — bare on monastics.
- Legs at hip y 0.9; women's hips are wider (±0.125) with a slight inward leg tilt.
- Women wear a short flared over-layer (`G.skirtOver`, waist → upper thigh) and a main
  skirt (`G.skirtUnder`) whose top is flush with the layer's hem — keep the two radii
  matched (over bottom 0.27, under top 0.265) or the layer visibly overflows.

## Rotation conventions

Euler order is XYZ, so **z applies first**:

- Positive `rotation.z` on an arm or elbow swings the limb tip toward +x. On `armL` that is
  inward (toward the body); negative z puts the elbow out. Mirror signs for `armR`.
- `rotation.x` folds forward: negative x on an elbow lifts the forearm up/forward; negative
  x on the arm tilts the whole arm forward (use this to pull hands out of the belly).
- `rotation.y` twists the limb about its own axis — the hand-tuned poses use it liberally.

## Tuning poses — use posetest.html

**Never guess pose numbers.** Open `http://localhost:8433/posetest.html`. Modes:
`meditation` (nun sitting), `buddha` (bhūmisparśa), `walkjoined` (Buddha walking, hands
joined), `skirt` (standing laywoman), `bowl` (monk holding the begging bowl). Sliders for
all four joints (mirror L→R checkbox), orbit with the mouse, and copy the printed
`rotation.set(...)` lines into the code. URL params preset values
(`?mode=meditation&aLx=-0.2&eLz=1.5`), and `window.__set/__vals/__cam` support scripted
screenshots (`poseshot.mjs` pattern in `docs/testing.md`).

Where each pose lives — keep posetest's `MODES` defaults in sync when you change them:

| Pose | File / place |
|---|---|
| Meditation sit | `characters.js`, `setAnim('sit')`, the `!handsJoined` branch |
| Buddha bhūmisparśa | `characters.js`, `setAnim('sit')`, the `P.bhumisparsha` branch |
| Buddha walking (hands joined) | `characters.js`, `restArms`, the `handsJoined` branch |
| Bowl hold | `player.js`, `toggleBowl`, the `player.bowlOut` branch |
| Bowl mesh offset | `player.js`, `attachBowl` |

## Pose flags on `P`

- `P.lockArms` — freezes arm poses through anim changes; `restArms`, the sit pose and the
  walk swing all respect it. Set it whenever you hand-pose arms (bowl, offering, stick).
- `P.bowHold` — static held bow (body.rotation.x 0.65). Use for mourners, offerings, the
  five ascetics; do NOT loop `bow()`.
- `P.bhumisparsha` — seated earth-witness mudrā instead of meditation hands (set by
  `makeBuddha`).
- `P.handsJoined` (opt) — joined palms at the navel when standing/walking.

## The Buddha (`makeBuddha`)

Scale 1.25 with arms stretched a further 1.25× in y (they reach lower — poses tuned for a
normal person clip deeper into his torso; check him separately in posetest's `buddha` mode).
Ushnisha hair cap hugs the skull (scale 0.92, 0.82, 0.92 at y 0.19). Head halo plus a faint
whole-body halo (`P.bodyHalo`) centred at the chest.

## Animals

Quadrupeds (`makeHorse`, `makeDeer`) are authored along +x inside an inner group rotated
−π/2, so **walking legs swing about `rotation.z`, not x**. The horse is scaled 1.5 on
`inner` only — riders attach to the root (seat y ≈ 1.6). The elephant follows the same
inner-group convention. `makeCarriage` likewise.

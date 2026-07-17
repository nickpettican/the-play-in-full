# Cloth simulation (src/cloth.js + clothtest.html)

The monastic outer robe, lower skirts, hair and tops simulated as real cloth, instead
of the rigid lathe meshes (`makeOuterRobe`, `G.skirt`, `G.hairBack`). This is now the
game's default dress: `makePerson` calls `dressCloth()` (src/cloth.js) for every
character except demons, and `cloth: false` opts out (used by `clothtest.html`, which
builds its own cloths to tune, by `posetest.html`, which tunes the rigid drape, and by
`scatterGods`, whose hundred distant sky figures would sink the frame rate).
Test page: `clothtest.html`, reachable from the **cloth** tab in `charactertest.html`.
Five tabs; each character can wear several independent cloths:

- **robe** — monk, nun and Buddha wearing a simulated outer robe (left shoulder covered,
  right bare, same wrap as `OUTER_ROBE`) plus a cloth lower skirt.
- **skirt** — monk, nun, laywoman and layman with the rigid under-skirt (and the lay
  over-layer) hidden and replaced by a closed cloth tube hanging from the hips.
- **woman** — the new female design: cloth hair wrapped around the hair cap falling to
  the top of the legs, a *static* tube top ending above the navel (bare belly and
  forearms, skin legs, chest mounds with matching colliders), a cloth skirt and a short
  static over-skirt (*wrap*). The new proportions apply: legs 5% longer, torso shortened
  from the bottom to meet the leg tops, height unchanged.
- **man** — royal (dressed arms, skin forearms), villager (skin arms), topless, and a
  deva, with shoulder-length cloth hair plus the man-bun, cloth skirts and the wrap.
- **ascetic** — Siddhārtha fasting and a fleshed ascetic, with the rendered `G.wrap`
  replaced by a short customisable cloth skirt.

Each cloth kind (robe / skirt / hair / top / wrap) has its own collapsible slider
section with its own colour, a **static** toggle, and shape and simulation values; the
*material* section applies to all. **Static** cloths (top and wrap by default — the top
sim explodes against the breast colliders) are moulded once over the colliders at build
time (a few constraint + push-out passes, so e.g. the top drapes over the bust), then
baked and parented to their anchor: rigid geometry, zero per-frame cost. Because the
bake uses `colliderK`, sim sliders trigger a rebuild for static kinds. Hair has a
`thick` parameter — an inner shell offset toward the head axis (one row shorter, so its
hem hides behind the outer sheet) that makes the sheet read as a volume. Monastic outer
robes AND lower skirts carry a kāṣāya rice-field patchwork texture (`kasayaTexture()`,
a canvas drawn in white so each cloth's material colour tints it — the pattern survives
the seated recolour).
The dress variants are `makePerson` options: `bareTorso`, `armsSkin`, `foreArmSkin`,
`legsSkin`, `breasts` (also triggers the female proportions), `hair: 'cap'` (tilted-back
hair cap, no rigid back sheet) and `hair: 'capbun'` (the same plus the man-bun).

## How it works

It is the classic Verlet cloth from three.js's `webgl_animation_cloth` example, run on
the CPU (the WebGPU compute variant needs a renderer we don't ship). Per robe:

1. **Particles.** A `cols × rows` grid of points wrapped part-way (robe, hair) or fully
   (skirt, top) around the body. Row 0 is the *pinned* top ring: every frame it is
   snapped to fixed positions in the character's local space (the `body` group for robe
   and top, so they follow torso bob and bows; the root group for the skirt; the head
   group for hair). Everything below row 0 is free.
2. **Integration.** Each free particle stores its current and previous position.
   Velocity is inferred as `pos − prev` (Verlet), damped, clamped to `maxSpeed`, then
   gravity and wind are added.
3. **Constraints.** Neighbouring particles are linked by distance constraints —
   horizontal, vertical and both diagonals (shear). Each solver iteration moves particle
   pairs toward their rest distance; when one end is pinned the free end takes the whole
   correction. More iterations = stiffer, less stretchy cloth. When `len ≈ 2` (a closed
   loop) the first and last columns are bound together so the seam cannot split.
4. **Collision.** A handful of spheres approximate the body: head, chest, belly, hips,
   and two per leg (skipped while seated, when the legs are hidden). Particles inside a
   sphere are pushed to its surface; the push-out runs inside every solver iteration so
   the constraints cannot drag cloth back through the body. A floor plane at y ≈ 0 lets
   hems pool on the ground.
5. **Rendering.** Particle positions are written straight into a `PlaneGeometry`'s
   position attribute each frame and normals recomputed. One shared
   `MeshPhysicalMaterial` (double-sided, with sheen for a fabric highlight).

The tuned defaults live in the `DEF` table at the top of `clothtest.html` (one
shape + sim pair per cloth kind). The panel's output box prints the current values as
JSON — copy them back into `DEF` (the same workflow as posetest → `OUTER_ROBE`).

## Shape parameters

The cloth's rest shape is a flared tube: a top ring lerping down to a hem ring.

| param | meaning |
|---|---|
| `cols`, `rows` | grid resolution around / down the body. Cost scales with `cols × rows`; keep coarse for mobile. |
| `topR`, `botR` | radius of the pinned collar/waist ring and of the hem. |
| `topY`, `botY` | height of those rings in the anchor's local space (robe: multiplied by the torso squash `tK`). |
| `start`, `len` | how far around the body the sheet wraps, in units of π. `len 2` = full circle, seam bound. The robe's `1.77` leaves the right shoulder bare. |
| `rotY` | spins the wrap around the body (positions the robe's opening). |
| `sx`, `sz` | ellipse factors — the body is flattened front-to-back, so `sz < sx`. |
| `y`, `z` | offset of the whole cloth. |
| `bulge`, `bulgeT` | a rounded swell added to the radius profile, peaking `bulgeT` of the way down — semi-spherical wraps instead of the bell shape a straight lerp gives. |
| `fHip`, `fHipT`, `fOvalZ`, `fTopY` | female skirts only: `fHip` widens the hips with a bump peaking `fHipT` of the way down (waist and hem stay put); `fOvalZ` is how much of that widening applies front-to-back (0 = x only, oval hips); `fTopY` raises the waistline. |
| `thick`, `thick2` | hair only: the inner-shell offset at the crown, tapering to `thick2` at the hem so the two layers converge instead of reading as a separate under-sheet. |

## Simulation parameters

| param | meaning |
|---|---|
| `gravity` | downward acceleration (m/s²). Higher than real-world (20 vs 9.8) reads better at this scale: the cloth settles fast and swings less. |
| `damping` | velocity kept per step (1 = none lost). Lower values calm the cloth but make it feel heavy/underwater. |
| `wind` | amplitude of a gentle sinusoidal push in z. 0 = off. |
| `stiffness` | constraint solver iterations per step. More = less stretch and faster settling, linearly more CPU. |
| `substeps` | physics steps per frame. More = stabler under fast motion, linearly more CPU. 1 is enough at the tuned settings. |
| `maxSpeed` | per-particle velocity clamp (m/s). The safety net that stops whip-crack explosions when a character turns or jumps sharply; too low and the cloth lags behind the body. |
| `colliderK` | scales every collider sphere radius. Smaller = cloth hugs the body closer (risking poke-through); larger = puffier. |
| `follow` | how much of the body's motion *beyond maxSpeed* the free particles inherit (0–1). Walking swing is untouched (below maxSpeed nothing is compensated); at running or carriage speed the cloth rides the body instead of streaming back like a cape. 0 restores the old fully-dragged behaviour. |
| `sway` | hard cap on deviation from the rest pose, in metres at the hem (scaling linearly from 0 at the pinned ring). Bounds how far starts, stops and turns can fling the cloth without making it static. 0 = unlimited. |

## Sitting

There is no good way to keep a standing-shaped cloth sensible on a seated body — the
game solves this for the rigid drape by swapping to `OUTER_ROBE_SIT`. The test page does
the same: pressing **sit** snapshots shape *and* sim, applies the `SIT_DEF` values
(short robe hem; the skirt becomes a low pooled cone over the seat) and rebuilds the
cloth in the seated pose. While seated, characters wearing the outer robe recolour their
skirt cloth and the crossed-legs base to the robe colour; wraps are hidden. You can tune
the seated values with the sliders while seated; **idle**/**walk** restores everything.

## In the game

`dressCloth(P, info)` decides the wardrobe from the character kind: monks and the
Buddha get the skirt + wrap (and the robe when `outerRobe` is set, replacing the rigid
drape); nuns the female-cut skirt and wrap plus a low-hemmed tube top in the outer-robe
colour; ascetics a short skirt; laywomen and devīs the full female set (hair, top,
skirt, wrap — skirt colour from `opts.skirtColour`, default a darkened robe); laymen,
princes and devas the male set. Seated, the crossed-legs base takes the outer-robe
colour (monastics) or the skirt colour (everyone else). The redesign body options (`bareTorso`, skin arms/legs,
`breasts`, cap hair) become the defaults for those kinds at the same time.

Cloth meshes are children of the character's group: particles simulate in world space
but are written back in group-local space each frame, so act cleanup, translucent
witness fades (`traverse` + material clone — rebuilt cloths copy `transparent`/`opacity`
forward) and nested parents like the carriage all work. Stepping rides a wrapped
`P.update`; a wrapped `P.setAnim` rebuilds on sit (seated shapes, outer-robe recolour of
skirt and seat base, wraps hidden) and on lie (robe and skirt bake static — gravity is
sideways to a lying body; hair stays live). A teleport larger than ~1 unit snaps the
cloth to its rest pose instead of letting it stream after the pins. Hems clamp to the
ground at the group's own height, so cloth works on terrain and in heaven.

## Performance

Some scenes have 20+ monastics. The **stress ×20** button spawns up to 20 cloth-wearing
characters; the fps readout is in the panel. At the tuned defaults (12×8 grid,
stiffness 6, 1 substep) 20 robes hold 60 fps in desktop Chrome — roughly 100 particles
and 600 constraint solves × iterations per robe per frame, plus a `computeVertexNormals`
each. The knobs that matter on a weak phone, in order: `cols × rows`, `stiffness`,
`substeps`. Level-of-detail (simulating only near/on-screen characters, freezing the
rest) is the obvious next step if the game ever struggles — not built, test page first.

## Known limitations

- No cloth self-collision, and no cloth–cloth collision between characters.
- Collision is a few spheres, so fast limbs can briefly poke through.
- The seated swap is a rebuild, not a transition — the cloth pops to the new shape.
- Pins have zero inherited velocity; body motion reaches the cloth only through the
  constraints (this is what makes it stable, but very fast movement makes the cloth lag).

# Content expansion spec — scenes, missions, and side quests from the source texts

A full run-through of the Lalitavistara (`raw/extracted/play-in-full-lalitavistara-toh95.md`,
84000 translation, re-extracted 2026-07 with verses intact) and a structural pass of DN 16
(`raw/extracted/DN 16_ Mahāparinibbānasutta—Bhikkhu Sujato.md`) found ~25 scenes that fit
the models, characters, and worlds the game already has. This is the plan for staging them
**as things the player does, not pages the player reads**. Read `docs/CONTENT-GUIDE.md`
first (fidelity rules) and `docs/architecture.md` (act lifecycle).

## The source file and how to cite it

The extraction was regenerated from `raw/epubs/play-in-full-lalitavistara-toh95.epub`
with the fixed `tools/extract_source.py`. What changed:

- **Verses are now present.** The old extraction dropped every verse block, which is why
  some famous speeches never made it into the game. Recovered and verified: Gopā's
  answer on going unveiled (12.67–71), the charioteer's four-sights answers (14.10–25),
  Bimbisāra's offer and the refusal (16.22–36), Māyādevī's lament at the river and the
  Bodhisattva's reassurance (17.29–37), Sārthavāha's warnings to Māra (21.14–20), the
  Buddha's replies to the ājīvika on the road (26.11–15), "O Brahmā, the gates of nectar
  are opened" (25.49).
- **Milestone anchors.** Every paragraph/stanza is prefixed `[14.­10]` (chapter.passage,
  as on the 84000 reading room). **Cite these, not line numbers** — they survive
  re-extraction. Grep for them: `grep -n "\[14.­10\]" <file>` (note the soft hyphen; when
  in doubt grep a phrase instead).
- **When quoting**: strip the `[14.­10]` milestone, `[F.96.b]` folio markers, bare
  `[188]`-style numbers, and trailing footnote digits. Spacing artefacts (`Monks ,`) are
  gone. Existing `content.js` quotes were spot-checked against the new file: all match
  verbatim after marker-stripping, apart from a few deliberate condensations (e.g. act2
  drops "during the constellation of Puṣya") — those are fine under the guide's
  condensation rule, but don't introduce new silent edits.

## What exists to build with

No new models or dependencies. Verify anything below in code before leaning on it.

- **People** (`makePerson`): kinds `deva devi monk nun layman laywoman prince ascetic
  demon` (+ `skinny`, `ornate`, `halo`, `scale`, `outerRobe`, `hair`, `setSadEyes`,
  `bowHold`, `lockArms` and per-limb rotations — pose via `posetest.html`, never blind);
  `makeBuddha`.
- **Props/creatures**: `makeHorse`, `makeElephant(white)`, `makeCarriage`, `makeDeer`,
  `makeBowl`, `makeHalo`, `makeNameLabel`, royal bed, palace guards.
- **Machinery** (`src/acts.js`): `addInteractable` (chainable — Act IX's
  Sujātā → tree → Māra → awakening chain is the pattern), `walkPerson`,
  `showNarration`/`showChoices`, `spawnNPC` behaviours (`idle/sit/wander/gather`),
  `scatterGods`, particles (`petals motes burst radiance fireflies aura`), day/ambient
  shifts, the nudge hint, the mindfulness/focus meter (`{focus: true}` narration +
  `maybeFocusReward`).
- **Player verbs**: walk/run/jump, **E** talk/interact, **F** bow (NPCs bow back),
  **R** hold out the alms bowl (`player.bowlOut`), **Ctrl** sit. F/R/Ctrl are almost
  unused by scenes — several missions below finally use them.
- **Worlds/spots** (`src/world.js`): jeta, tushita, kapilavastu, lumbini, magadha,
  deerpark, kushinagar; add new `W.spots` there.

## Design principles — missions, not exposition

The complaint to fix: most acts are *spawn scene → one gold bubble → wall of narration →
next act*. Every proposal below is shaped as a *mission*: a goal the player understands,
an action they perform, a payoff they watch. Rules:

1. **A beat per action.** Never stack more than ~4 narration pages on one interaction;
   split long passages across the steps of the mission (walk with someone, then talk,
   then witness).
2. **Use the verbs.** Bowing (F), offering/receiving with the bowl (R), sitting (Ctrl),
   following a moving character, finding someone, and choosing a dialogue option are all
   cheap and all feel like play. Example: Act VIII's teachers only teach the player who
   *sits* with them; Asita only takes the child after the player *bows*.
3. **Gold = main thread, white = side content.** The gold bubble marker
   (`makeTalkMarker('gold')`) must mean exactly one thing: "this advances the act."
   Side quests and side conversations get the plain white marker NPCs already use.
   *Existing bug to fix while at it: Act IV's Devadatta eavesdrop is side content but
   currently spawns a gold marker — switch it to white.*
4. **Side quests never gate `nextAct()`.** They enrich the scene, reward with atmosphere
   (`aura`, `sfxChime`, petals, a focus-meter bump), and expire silently when the act
   ends. A completed side quest may plant a payoff later (a returning character, an
   extra line), but the main thread must never wait for one.
5. **Hints scale with openness.** Scenes where the objective is not visible from spawn
   need a hint; scenes with a visible gold bubble don't. Use the nudge machinery, made
   parameterisable (below).
6. **Respect the witness constraint.** `witnessForm` in `acts.js`: the player is
   *heavenly* (addressable) in Act I, **translucent and unseen in Acts II–IX**, *veiled*
   (addressable) in Act X, normal elsewhere. In the unseen acts NPCs cannot see or talk
   to the player (`npc.js` filters them out), so:
   - Side content there must be **overheard vignettes** (white-marker eavesdrop
     interactables, the Act IV Devadatta pattern), never Q&A conversations. This is
     usually *more* faithful — Gopā addresses the court, not a bystander.
   - Missions there are witness-shaped: follow, find, watch, and private gestures.
     Bowing (F), sitting (Ctrl), and holding out the bowl (R) still work as the
     player's own unseen acts of reverence — they can trigger or reward a beat without
     any NPC acknowledging the player.
   - Exception precedent: Act VIII's ascetics have `seesWitness: true` ("hardened
     enough to notice even an unseen witness"). Extend it sparingly to beings the
     tradition credits with such sight — Asita ("who had the five extraordinary
     powers"), the two meditation teachers — when a scene genuinely wants them to
     glance at the player. Never give it to ordinary townsfolk.
7. **Sound carries the sad scenes.** For grief and tenderness (Māyādevī at the river,
   Ānanda at the door-jamb, Asita's tears) add a soft emotional cue via `sfxFile`
   (a low flute or gentle weeping ambience in `assets/mp3/` — source new royalty-free
   clips in the style of the existing ones) on top of the ambient bank; drop the music
   out (`setAmbient('night')`/quiet) rather than piling sounds on.
8. **Scene cards cover mid-act map moves.** When a mission jumps worlds mid-act
   (Lumbinī → the palace for Asita, the bodhi tree → deerpark), show the same card used
   between acts — minus the "ACT X" overline, just the scene name — so the world switch
   renders behind it.

### Small engine changes required (one-time, ~30 lines total)

- `addInteractable({ marker: 'gold' | 'white' | false })` — thread the kind through to
  `makeTalkMarker`. Default stays gold so existing call sites don't change.
- `armNudge(textKey)` — accept an i18n key so scenes can hint specifically
  ("Someone is weeping near the huts…" instead of the generic golden-bubble line).
  New keys live in `src/i18n.js` with Spanish left for the translation agent.
- A tiny side-quest reward helper: `sideReward()` = `aura(player…) + sfxChime()` +
  a small focus bump, so all side quests pay off consistently.
- `showSceneCard(name)` — the act card (`showActCard`) without the "ACT X" overline,
  for mid-act world switches; the switch happens behind the card exactly as `transition`
  does between acts. Scene names are UI strings → `SCRIPT_EN`/`SCRIPT_ES` + i18n.
- One or two emotional audio stings in `assets/mp3/` (soft flute / lament, royalty-free,
  matching the existing clips) for the grief scenes, played via `sfxFile`.

---

## Act-by-act missions

★ = main-thread beat (gold). ☆ = side quest / side conversation (white).
Priorities: **P1** do first, **P2** worthwhile, **P3** nice-to-have.

### Act I — The Heaven of Joy

**1.1 ★ The crown passes to Maitreya — P2** (5.5–5.9; narrated in act1 already)
Mission: after the farewell gathering, a second gold beat on Maitreya. The Bodhisattva
walks to him (`walkPerson`), lifts the crown from his own head onto Maitreya's (small
gold torus prop), gods bow, `burst` + chime. The player triggers it by speaking to
Maitreya — his existing Q&A gains the handover as the payoff.

**1.2 ☆ The gods debate the form of entry — P3** (6.33, line ~1653; also in `QA_DEVA`)
A huddle of 3–4 gods with white markers arguing what shape the descent should take
(young brahmin? Śakra? elephant?). Pure side conversation; pays off in Act II when the
player sees the answer.

### Act II — Entering the Womb

**2.1 ★ Tell the king what you saw — P1** (6.13–17, ~line 1560)
The act currently ends when the elephant lands. Add a second beat: fade to morning;
the gold marker moves to the king's court, where the dream-readers (2–3 `layman`
priests, hair 'bun', seated) have been summoned. The unseen player follows Māyā across
the courtyard (`walkPerson`, a follow beat) and witnesses the telling: her dream
account and the brahmins' prophecy ("Your Majesty, please speak. When we hear what you
saw in your dream, we will explain", 6.15, then the son-or-buddha reading).

### Act III — The Birth

**3.1 ★ The sage who came flying — P1** (7.87–7.105, lines ~2226–2287)
The best unstaged scene in the text. After the seven steps, a **scene card** ("The Sage
Asita") covers the world switch to the kapilavastu courtyard. Staging: the king
(`layman`, ornate) with the infant; Asita (`ascetic`, white long hair, stick) with young
Naradatta (`layman`, scale ~0.8). The player is an unseen witness here — the mission is
shaped around that: Asita, "who had the five extraordinary powers" (7.87), is the one
being in the court who *can* perceive the witness (`seesWitness`, the Act VIII ascetic
precedent) — on arrival he glances once at the player, a hair-raising grace note no one
else shares. Beats, each its own short page: Asita examines the child → weeps (soft
lament sting via `sfxFile`; the king's alarm plays as narration) → "I am not crying for
the sake of the prince… I cry for myself because I am elderly, old, and decrepit"
(7.97–7.99) → his instruction to Naradatta (7.105). Bowing (F) to the sage remains a
private, optional gesture — if the player does it, Asita returns it (`sideReward`).

**3.2 ☆ The rejoicing gods — P3** (7.x, the existing descent)
Give the six translucent rejoicing gods one white-marker *overheard* line each from the
birth chapter's prose (they currently say nothing; the unseen player eavesdrops, they
don't converse). Cheap texture.

**3.3 ★ Going to the temple — P2** (8.2–8.14, lines ~2522+)
A short second mission if 3.1 lands well, else defer: the aunt carries the child to the
temple; stone-grey `makePerson` figures on plinths stand and bow as the child passes
(8.12). Player walks alongside (follow beat). The child's line to his aunt — "Mother,
where are you taking me?" (8.5) — is the hook.

**3.4 ☆ The ornaments outshone — P3** (9.1–9.6, lines ~2574+)
Side conversation with Mahāprajāpatī Gautamī or a Śākya elder: the commissioned
ornaments lose their lustre on his body "like a lump of coal next to gold"; the grove
goddess Vimala rises (earth-goddess rig) and scatters flowers.

### Act IV — Skill in the Arts

**4.1 ★ Find the missing prince — P1** (11.1–11.25, lines ~2753–2901)
The rose apple tree, restructured as a search mission. The king's men are looking for
the boy; a `layman` minister (gold marker) asks the player to help search; the tree is
off in the fields with the seated prince beneath it, **his shadow unmoved while every
other shadow has swung** (11.13 prose; fake it with a rotated blob-shadow mesh under
neighbouring trees or narrate it). Nudge hint after 30 s ("Look where the shade has not
moved…"). Payoff: the minister runs to fetch the king, who bows to his own son (11.18
verse now available). This scene is deliberately echoed at 18.25 on the night of
awakening — quote it there too.

**4.2 ☆ The writing school — P3** (10.2–10.7, line ~2628)
White-marker vignette near the palace: schoolmaster Viśvāmitra prostrate before a small
prince, the god Śubhāṅga's verse explaining why (verses now extracted). Overheard, not
blocking.

**4.3 ★ The elephant at the gate — P2** (12.3–12.9; already quoted in act4 narration)
Stage what the narration already tells: a dead grey elephant (`makeElephant(false)`,
lying) blocking the town gate, mourning/complaining villagers (white chatter), Devadatta
unrepentant nearby. The gold beat: the young prince arrives, extends a foot from his
chariot, and the carcass arcs over the wall (projectile lerp + `burst`). Split the
existing narration pages across approach/witness/aftermath.

**4.4 ☆ The wrestling circle — P3** (12.44–47, line ~3260)
A ring of `layman` youths west of the archery lane; on interact, Nanda and Ānanda rush
in and collapse at a touch, then all thirty-two (stage 6–8), gods rain `petals`.

**4.5 ☆ Devadatta's envy — P0 fix** — switch the existing eavesdrop marker from gold to
white when the marker-kind option lands; it is the archetype side conversation.

### Act V — Gopā

**5.1 ★ Why a contest was needed — P2** (12.14–12.20, line ~3101)
Opening beat before the wedding tableau: Daṇḍapāṇi (`layman`, ornate, gold marker)
explains his refusal — "our family rule is such that a girl can only be granted to
someone who is skilled in the arts" — and the pledge of the five hundred. Then the
existing wedding beat plays as the outcome.

**5.2 ★ Gopā speaks — P1** (12.67–12.71, line ~3325; **verses recovered**)
Post-wedding beat, all witnessed (the player is unseen in this act). Two gossiping
`laywoman` NPCs (white, overheard): "A new wife is supposed to be covered, but this one
is always exposed." Then a gold marker on Gopā: she rises and answers **the whole court**
— exactly as the text has it ("in front of all the folk of the inner quarters") — with
her actual verses: "A noble being shines when uncovered, / Whether sitting, standing, or
walking… A noble being shines when speaking, / And even when silent, a noble being
shines" (12.67–69), closing with the king's delighted gift (prose, 12.72). Gopā is
currently a silent prop in her own act; this is her chapter.

### Act VI — The Four Sights

**6.1 ★ Ask the charioteer — P1** (14.9–14.32, lines ~4300–4400; **verses recovered**)
The missing half of the existing carriage rides: a charioteer figure (Chandaka's build)
now stands at the carriage, and at each stop the player's existing "What is this, that
we are seeing?" is answered by the charioteer's actual verses — "Your Highness, that man
is overcome by old age; / His senses are weak… he has been abandoned like a piece of
wood in the forest" (14.10) and the matching verses for sickness (14.16), death (14.20),
and the mendicant (14.25). After each of the first three sights the carriage visibly
turns back towards the palace before the next ride (the text's rhythm, 14.13 etc.).

**6.2 ☆ The king walls him in — P2** (14.33–36 + 15.9–10)
After the fourth sight, 2–4 armed guard NPCs (palace-guard recipe) appear at the town
gate with one overheard white line from the prose: five hundred men at each gate so the
prince cannot leave. Foreshadows Act VII; costs nothing.

### Act VII — Leaving Home

**7.1 ★ The hunter's saffron robes — P1** (15.99–15.103 + 16.2; lines ~5340, 5706)
Where the monk's robes come from — currently the haircut conjures them. After the
haircut beat: a figure in saffron (`layman`) approaches through the trees; gold marker;
the exchange — silks for saffron — then the "hunter" resumes his deva form (translucent
swap) and rises with the silks. Prose is verbatim throughout.

**7.2 ★ Send Chanda home — P2** (15.89–15.94 + 16.1; lines ~5300, ~5700)
Close the horse's arc: the farewell ("Chanda, you should go back now. Take these
ornaments and my horse Kaṇṭhaka and return to the palace"), Chandaka leading Kaṇṭhaka
off with the clop SFX fading, and the narration page that three young Śākyas —
Bhadrika, Mahānāma, Aniruddha — could not lift the ornaments he carried back (16.1).
Beat order: haircut → 7.1 robes → 7.2 farewell → act end.

### Act VIII — Austerities

**8.1 ★ Sit with the two teachers — P1** (16.3–16.7 lines ~5710–5730; 17.1–17.7 line
~5920)
The biggest narrative gap: between leaving home and the austerities he masters and
outgrows two meditation schools, first-person prose throughout. Two teacher camps in
magadha (new spots): Ārāḍa Kālāma with students, then Rudraka. Mission: the player must
**sit (Ctrl)** among the students before each teaching begins — nudge hint "Sit with
the students to hear the teaching" — the first required use of the sit verb; the focus
meter runs on the teaching pages. Sitting is the player's own act, so it works while
unseen; give the two teachers `seesWitness` (the Act VIII ascetic precedent) so they
may acknowledge the seated witness with a look. Each camp ends with the Bodhisattva's verdict ("this
teaching does not bring freedom") and him walking on — the player follows him to the
next camp (follow beat). The five companions join at the second camp (17.7) and walk
with him to the austerity grounds, becoming the five ascetics already spawned there.

**8.2 ★ The mother's midnight visit — P1** (17.29–17.37, lines ~6014–6060; **verses
recovered**)
The gods tell Māyādevī her son is about to die; she descends at midnight to the river
bank and weeps over the skeletal body. Now with her actual words: "It is I, your
mother, O son, / Who for ten months / Carried you in my womb like a diamond" (17.34) and
his answer: "…although I am an ordinary person, I shall not die… Before long you shall
behold the awakening of a buddha" (17.36). Staging: night shift, Māyā as translucent
`devi` in her rose robe descending (Act IX god-descent recipe), goddess attendants,
`motes`; she circumambulates three times and ascends (17.37). Witness beat — the player
watches; place it after the second austerity-spot interaction so the act has a
night-time heart. Audio: drop the ambient out and play the soft lament sting
(`sfxFile`) as she weeps; a gentle chime as she ascends overjoyed.

**8.3 ☆ The gods' offer, refused — P2** (18.26–27, line ~6374)
White side conversation with one of the ascetic NPCs, or one extra narration page:
gods offered to feed him through his pores; he refused because it would make his fast
a lie. First-person prose, verbatim.

### Act IX — The Seat of Awakening

**9.1 ★ The golden bowl thrown away — P2** (18.35–18.44, line ~6434)
Extend the Sujātā beat: after the meal, he bathes (gods pour scents), a nāga girl
(`devi`, earth-goddess rise from the riverbank) offers a jewelled throne, and he throws
the golden bowl into the river "without any feelings of attachment" — bowl prop arcs
into the water (projectile lerp), a white halo mote sinks, and Indra's garuḍa theft
stays as one narration line. Player grace note: **holding out your own bowl (R)** during
the offering beat earns `sideReward()` — a private gesture of participation (no NPC
acknowledges it; the player is unseen here), finally using the R verb.

**9.2 ★ Buy the grass from Svastika — P2** (19.68–19.71, lines ~6776–84)
Already narrated, trivially staged: Svastika (`layman`) at the roadside with grass
bundles (thin green boxes); the walking Siddhārtha pauses; the request verse is now
extracted (19.71); the seat under the tree gains a grass tuft. Gold marker on Svastika
moves the walk along.

**9.3 ☆ The son who would not fight — P3** (21.14–21.20, 21.43–44; lines ~7177, ~7321)
During the assault, one `demon` (ornate, kneeling apart, white marker): Sārthavāha, who
warned his father and stands with the devoted sons on Māra's right. His warning verses
are now extracted. Texture inside an already-strong scene.

**9.4 ☆ The daughters' apology — P3** (24.79–24.86, lines ~9492–9530)
Post-awakening tableau: Rati, Arati, and Tṛṣṇā approach, fail, and ask forgiveness;
his answer on confession ("it is an advancement in the training of the noble Dharma to
understand a fault to be a fault…", 24.86 prose). Three figures approach, bow, withdraw.

**9.5 ★ Trapuṣa and Bhallika, and the four bowls — P1** (24.95–24.127, lines
~9568–9749)
The first lay disciples and the origin of the alms bowl, staged after `act9d` (or as the
cold open of Act X in magadha): a halted caravan (2 carriages + horses), frightened
merchants, the milk-tree goddess revealing herself ("Do not fear!"), the offering of
honey and gruel, and the Four Great Kings (ornate devas) descending with bowls — gold
refused, jewels refused, four stone bowls accepted and pressed into one (`makeBowl`
props, merge `burst`). Mission shape: the player overhears the stuck merchants (white
eavesdrop markers: "the wheels have sunk to their axles — there must be a threat
ahead"), then the gold beat at the goddess, then witnesses the bowls. Nearly all prose,
verbatim. If staged as Act X's cold open, a scene card ("Trapuṣa and Bhallika") covers
the magadha → deerpark switch afterwards.

### Act X — Turning the Wheel

**10.1 ★ The mendicant on the road — P1** (26.9–26.16, lines ~10278–10326; **verses
recovered**)
An ājīvika ascetic intercepts the Buddha's walk across the deerpark approach: "Venerable
Gautama, your senses are calm, and your skin is bright…" (26.10 prose), and the Buddha's
replies in verse — "I am a worthy one of the world; / I am the unsurpassed teacher…"
(26.12), "I am on my way to Vārāṇasī… I shall beat the great drum of nectar" (26.15).
The ascetic heads south as the Buddha goes north (26.16). Player: gold beat on the
meeting point during the existing walk. One narration page may add the ferryman
(26.18–19): no fare, so he flies across, and Bimbisāra waives the fee for monks forever.

**10.2 ★ The broken pact — P1** (26.20–26.25, lines ~10344–10360)
Before the Buddha reaches the five, the player can approach them: overheard white-marker
scheming, verbatim — "here comes that mendicant Gautama, that lazy, gluttonous one who
has given up on his ascetic practices… he is not to be emulated" (26.20). Then, as he
nears, "they felt like birds caught in a cage with a fire burning below" (26.21): the
existing stand-and-bow choreography gains the involuntary service beats — one takes his
robe, one prepares the seat, one brings water (26.22). Then the existing "do not address
the Thus-Gone One as 'venerable'" narration lands with its proper sting, followed by the
wheel-turning as today. The scheming conversation is the act's soul: keep it a *side*
discovery (white) so attentive players are rewarded, with a nudge hint on approach.

### Act XI — The Entrustment

**11.1 ☆ Epilogue texture — P3** (ch. 27)
One or two new `QA_MAHAYANA` entries from the epilogue's prose (the entrustment to
Maitreya and Ānanda, the merit of hearing this sutra). No staging.

### Act XII — The Great Passing (own session, DN 16 file — prose throughout, no verse problem)

- **★ Find Ānanda — P1** (DN 16 file lines ~1393–1440): Ānanda has slipped away to weep
  "leaning against the door-jamb" — the marker over the couch pauses; a nudge hints
  someone is missing; the player finds Ānanda apart by a hut (white marker turned gold
  for this beat), then the Buddha sends for him and praises him. A find mission with the
  game's most tender payoff; quiet ambient plus the lament sting while he weeps.
- **★ Subhadda, the last disciple — P1** (~1509–1557): an `ascetic` approaches the
  grove; Ānanda turns him away three times (the player witnesses/mediates via choices);
  the Buddha overhears — "Enough, Ānanda, do not obstruct Subhadda" — teaches him, and
  the robe-swap (Act X recipe) makes the final personal disciple.
- **☆ The Mallas pay homage — P2** (~1464–1485): lay families (`layman`/`laywoman`) file
  in, organised by Ānanda family by family; white conversations of grief. The act
  currently has no laity at all.
- **☆ Sal flowers out of season — P2** (~1282): re-tinted `petals` over the couch plus
  one narration line.
- **☆ Cunda's meal — P3** (~1044–1078): one narration page (the illness struck after
  Cunda's meal; the Buddha insists the meal was of great fruit); staging would need Pāvā.

---

## Implementation order

Each numbered scene is one PR-sized change. The engine tweaks (marker kind, nudge
text keys, `sideReward`, Devadatta gold→white fix) go first, then:

1. **8.1 two teachers** + 8.3 (fills the biggest story gap; introduces sit-to-learn)
2. **3.1 Asita** (bow-to-greet; the strongest single scene)
3. **10.1 + 10.2** (transforms Act X; the broken pact is the model side-discovery)
4. **8.2 Māyādevī** (the recovered verses at their best)
5. **9.5 Trapuṣa and Bhallika**
6. **7.1 + 7.2** (robes and farewell)
7. **6.1 charioteer verses**, **5.2 Gopā's verses** (recovered-verse payoffs)
8. **4.1 find-the-prince**, **2.1 dream**, **4.3 elephant**, **9.1 + 9.2**
9. Remaining ☆ items in any order
10. **Act XII pass** as its own session with the DN 16 file open

## Rules for the implementing agent

- Verify every quote against the raw file at the cited milestone before committing;
  strip only bracketed markers and footnote digits. Never fabricate or embellish
  scripture; condensations must be tight, honest, and within the guide's rules.
- New narration goes in new `NARRATION` keys (`act8teachers`, `act3asita`, …) — never
  reshuffle existing arrays; `acts.js` slices some by index (`act3.slice(0,2)`, `act9c`
  pins the earth goddess to index 4).
- New non-scripture lines (mission prompts, hints) go in `SCRIPT_EN`/`SCRIPT_ES` and
  `src/i18n.js`; leave Spanish values empty for the translation agent rather than
  machine-translating.
- Gold markers only on beats that advance the act; side quests must never gate
  `nextAct()`; every act must still complete end-to-end (test with `__startAct(n)`,
  see `docs/testing.md`).
- Poses via `posetest.html` only; new positions as named `W.spots` in `src/world.js`.
- Hints: any mission whose objective is not visible from the player's spawn point needs
  a scene-specific nudge; the generic golden-bubble nudge stays as the fallback.

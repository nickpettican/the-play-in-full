// All game text. Quotes marked with `src` are verbatim from the named translation:
// Lalitavistara quotes from "The Play in Full" (84000, Toh 95); others from the named sutta/sutra.
// TO EXTEND: append {q, a, src} objects to QA_PALI / QA_MAHAYANA, or add entries
// to a bodhisattva's `qa` array in BODHISATTVAS. Nothing else needs changing.

import { LANG } from './i18n.js';

export const GAME_TITLE = 'The Play in Full';

const ACT_TITLES_EN = [
  ['PRELUDE', "In Jeta's Grove"],
  ['ACT I', 'The Heaven of Joy'],
  ['ACT II', 'Entering the Womb'],
  ['ACT III', 'The Birth'],
  ['ACT IV', 'Skill in the Arts'],
  ['ACT V', 'Gopā'],
  ['ACT VI', 'The Four Sights'],
  ['ACT VII', 'Leaving Home'],
  ['ACT VIII', 'Austerities'],
  ['ACT IX', 'The Seat of Awakening'],
  ['ACT X', 'Turning the Wheel'],
  ['ACT XI', 'The Entrustment'],
  ['ACT XII', 'The Great Passing'],
];
const ACT_TITLES_ES = [
  ['PRELUDIO', 'En la Arboleda de Jeta'],
  ['ACTO I', 'El Cielo del Gozo'],
  ['ACTO II', 'La Entrada en el Vientre'],
  ['ACTO III', 'El Nacimiento'],
  ['ACTO IV', 'Destreza en las Artes'],
  ['ACTO V', 'Gopā'],
  ['ACTO VI', 'Las Cuatro Visiones'],
  ['ACTO VII', 'La Partida del Hogar'],
  ['ACTO VIII', 'Las Austeridades'],
  ['ACTO IX', 'El Asiento del Despertar'],
  ['ACTO X', 'El Giro de la Rueda'],
  ['ACTO XI', 'El Encargo'],
  ['ACTO XII', 'El Gran Tránsito'],
];
export const actTitle = (i) => (LANG === 'es' ? ACT_TITLES_ES : ACT_TITLES_EN)[i];

const LV = 'The Play in Full (Lalitavistara)';

// ---------- narration per act (verbatim Lalitavistara unless noted) ----------
export const NARRATION = {
  act0: [
    { q: 'Thus did I hear at one time. The Blessed One was staying in Śrāvastī, in Jeta’s Grove, Anāthapiṇḍada’s Park, along with a great saṅgha of twelve thousand monks.', src: LV },
    { q: 'Yet the great wealth and renown he enjoyed were like drops of water rolling off the petals of a lotus flower. The Blessed One remained detached and untainted by it all.', src: LV },
    { q: 'Out of compassion for these gods, and indeed for the entire world including the gods, the Blessed One remained silent, thereby offering his consent.', src: LV },
  ],
  act1: [
    { q: 'Hearing that, the gods of the Heaven of Joy wept and embraced the feet of the Bodhisattva. They said, “Virtuous One, without you, this Heaven of Joy will lose its splendor.”', src: LV },
    { q: 'He then took the crown from his own head and placed it on the head of the bodhisattva Maitreya, saying, “You, virtuous one, shall awaken to perfect and complete buddhahood after me.”', src: LV },
    { q: 'Monks, as he started to move, the Bodhisattva’s body began to shine with a brilliant and dazzling light that surpassed any other celestial light. This unprecedented light illuminated all the vast and enormous realms of the great trichiliocosm.', src: LV },
  ],
  act2: [
    { q: 'Monks, the cold season had passed and it was the third month of spring. It was the finest season, when the moon enters the constellation Viśākhā. The leaves of trees unfurled and the most exquisite flowers blossomed.', src: LV },
    { q: 'On the fifteenth day, during the full moon, while his future mother was observing the poṣadha precepts, the Bodhisattva moved, fully conscious and aware, from the fine realm of the Heaven of Joy to the womb of his mother.', src: LV },
    { q: 'He entered through his mother’s right side in the form of a baby elephant, white in color with six tusks.', src: LV },
  ],
  act3: [
    { q: 'However, at this moment the Bodhisattva’s magnificence and power caused the fig tree itself to bow down and pay homage to him. Māyādevī stretched out her right arm, like a flash of lightning appearing in the middle of the sky, and grasped a branch of the tree.', src: LV },
    { q: 'As soon as he was born, the Bodhisattva stepped onto the ground. Wherever his feet touched the ground, a large lotus immediately sprung from the earth.', src: LV },
    { q: 'Unsupported, he took seven steps toward the east and declared, “I will be the cause of all virtuous practices.”', src: LV },
    { q: '“I am the Supreme Being on this earth. This is my last birth, where I shall uproot birth, old age, sickness, and death!”', src: LV },
    { q: '“Great King, an uḍumbara flower sometimes, though rarely, blooms in the world. Great King, in the same way, rarely, once in many millions of years, a blessed buddha is born in the world. And this great prince will certainly awaken to unexcelled, perfect, and complete buddhahood.”', src: LV },
  ],
  act4: [
    { q: 'As soon as the Bodhisattva arrived in school, the schoolmaster, who was called Viśvāmitra, was unable to withstand the Bodhisattva’s splendor and radiance, and prostrated to him face-down on the ground.', src: LV },
    { q: 'Finally the bow was placed before the Bodhisattva. He picked it up and, sitting on his seat in the cross-legged position, he held it with his left hand and strung it with a single fingertip of his right hand.', src: LV },
    { q: 'Monks, the Bodhisattva now picked up an arrow, drew the bow, and released the arrow. His shot was so powerful that the arrow went right through the targets set up by Ānanda, Devadatta, Sundarananda, and Daṇḍapāṇi.', src: LV },
    { q: 'Then, while still on his chariot, the prince extended one foot to the ground, and with his big toe he took hold of the elephant and hurled it a mile outside the city, over seven walls and seven moats. A deep pit formed where the elephant landed.', src: LV },
    { q: 'Accordingly five hundred Śākya boys in unison proposed an unprecedented problem, and still the Bodhisattva calculated it without any consternation. In this way all the Śākya boys met their match while the Bodhisattva remained undefeated.', src: LV },
  ],
  act5: [
    { q: 'Then the daughter of Daṇḍapāṇi Śākya, the Śākya girl named Gopā, surrounded and escorted by an entourage of female servants, came into the assembly hall where the Bodhisattva was seated. She approached the Bodhisattva and stood to one side, staring at him with unblinking eyes.', src: LV },
    { q: 'He then took off his ring, which was worth several hundreds of thousands of silver coins, and gave it to her.', src: LV },
    { q: 'When that became clear, the Śākya Daṇḍapāṇi decided to give away his daughter, the Śākya girl Gopā, to the Bodhisattva. King Śuddhodana also formally requested her hand in marriage for the Bodhisattva.', src: LV },
  ],
  // one narration per sight, in order: old age, sickness, death, the mendicant
  act6: [
    { q: 'He was a decrepit old man, so skinny that the veins on his body protruded. His teeth had fallen out and he was covered in wrinkles everywhere. His hair was gray and he was hunched over like the rafters in a gable roof. Weak and broken, he had to use a stick to keep himself from falling.', src: LV },
    { q: 'His body was weak, and he was suffering greatly. There was no one to take care of him or assist him, and he was breathing only with the greatest difficulty.', src: LV },
    { q: 'The corpse was lying on a stretcher, covered by a cotton cloth. It was surrounded by a group of relatives who wailed, cried, and lamented.', src: LV },
    { q: 'The Bodhisattva saw the mendicant and noticed that he was peaceful. He was self-controlled and restrained. He had pure conduct, and his eyes didn’t wander but looked down ahead at a distance of six feet.', src: LV },
  ],
  act7: [
    { q: '“Friends, tonight the Bodhisattva will leave his home. You must help him leave by carrying the hooves of his fine horse with your hands.”', src: LV },
    { q: '“Enough, Chanda! These sense pleasures are impermanent and unstable. They do not endure and are subject to change. Like the rapids of a mountain torrent, they quickly pass and are turbulent. Like dewdrops, they do not last.”', src: LV },
    { q: 'So he told his servant, “Chanda, don’t badger me now. Instead, without any further delay, bring me my horse Kaṇṭhaka, well adorned.”', src: LV },
    { q: 'The Bodhisattva then thought to himself, “With my hair this long, I cannot be a monk.” So he took his sword, cut off his hair, and then cast it into the air. The gods in the Heaven of the Thirty-Three collected the hair for worship.', src: LV },
    { q: '“Friends, Prince Siddhārtha has left his home! Friends, Prince Siddhārtha has become a monk! He will awaken to unexcelled, perfect, and complete buddhahood and will turn the wheel of the Dharma.”', src: LV },
  ],
  act8: [
    { q: 'Monks, as I now began living on just a single juniper berry, never taking a second, my body became extremely weak and emaciated.', src: LV },
    { q: 'Just like a well during the end of summer, where the reflection of the stars has sunk and is hard to notice, my eyeballs had sunk into my head and become barely visible. My legs resembled the legs of a goat or a camel, and so it was for my armpits, belly, chest, and so forth. Monks, when at that point I tried touching my belly with my hand, I actually ended up touching my spine. I was so hunched over that I fell whenever I tried to stand.', src: LV },
    { q: 'The Bodhisattva remained sitting cross-legged for six years. He simply sat the way he was, without forsaking his activity. When the sun was shining, he did not seek shade. When the shade fell on him, he did not move into the sun.', src: LV },
    { q: '“This path does not lead to awakening. This path is incapable of eradicating the continuation of birth, old age, and death in the future. But there must be another path to awakening.”', src: LV },
  ],
  act9a: [
    { q: '“With these acts and methods I have not been able to manifest any true knowledge that would be higher than manmade teachings. This path does not lead to awakening. But there must be another path to awakening that can eradicate the future suffering of birth, old age, and death.”', src: LV },
    { q: 'Monks, as soon as Sujātā heard these words of the gods, she quickly gathered the milk of a thousand cows. Seven times she skimmed the cream from the milk, until she obtained a thick, strength-giving cream. She then poured this cream into a new clay pot, mixed it with the freshest rice, and placed it on a brand-new stove.', src: LV },
    { q: 'The Bodhisattva then had this thought: “Sujātā has offered this food, and if I eat it now, there is no doubt that I shall truly attain perfect and completely unexcelled awakening.” Then the Bodhisattva had his meal.', src: LV },
  ],
  act9b: [
    { q: 'Monks, when the Bodhisattva bathed in the Nairañjanā River and enjoyed a meal, his physical strength came back to him. With a triumphant gait, he now began the walk toward the great Bodhi tree.', src: LV },
    { q: '“Where did the previous thus-gone ones sit when they attained unsurpassed, genuine and perfect awakening? They sat on a bed of grass!”', src: LV },
    { q: 'In this way he sat down on the grass seat and crossed his legs facing toward the east.', src: LV },
  ],
  act9c: [
    { q: 'It was a terrifying army, so brave in battle that it would make anyone’s hair stand on end. Such an army had never been seen before, or even heard of, in the realms of gods and humans.', src: LV },
    { q: 'However, as soon as the demons released the weapons, the weapons turned into garlands and canopies of flowers, and a cooling rain of flower petals fell on the ground. The flower garlands hung as adornments on the Bodhi tree.', src: LV },
    { q: 'The Bodhisattva replied, “Evil one, the earth here is my witness.”', src: LV },
    { q: 'Not far from where the Bodhisattva was sitting, she broke through the earth’s surface and revealed her upper body, adorned with all sorts of jewels. She bowed toward the Bodhisattva, joined her palms, and said to him, “You are right. Great Being, you are right. It is just as you say. We bear witness to this.”', src: LV },
  ],
  act9d: [
    { q: '“How miserable is this world! It is anguished by birth, old age, sickness, death, departure, and rebirth, but it does not know how to remove itself from this massive heap of pure anguish, marked foremost by old age, sickness, and death.”', src: LV },
    { q: 'Monks, through considering and ruminating over these factors, which had never before been heard, there dawned in the Bodhisattva wisdom, vision, knowledge, intelligence, prudence, and insight, and a light began to shine.', src: LV },
    { q: 'Monks, indeed, the very moment that the Bodhisattva attained omniscience, all beings throughout all the worlds in the ten directions instantly became ecstatic. All the worlds were flooded with bright light, including even the dark spaces between them that were riddled with evil.', src: LV },
    { q: 'Monks, the Thus-Gone One abided on the seat of awakening for the first seven days, reflecting, “Here I have brought an end to the suffering of birth, old age, and death, which has been happening since time immemorial.”', src: LV },
  ],
  act10: [
    { q: 'Monks, I have actualized immortality and the path that leads to immortality. Monks, I am the awakened one, the omniscient one, the all-seeing one. I have become tranquil and have exhausted all faults.', src: LV },
    { q: 'Monks, the Thus-Gone One teaches the Dharma by showing the middle way that does not fall into either of the two extremes. The Dharma that he teaches is one of correct view, intention, speech, action, livelihood, effort, mindfulness, and concentration.', src: LV },
    { q: 'Monks, there are also four truths of the noble ones. What are these four? Suffering, the origin of suffering, the cessation of suffering, and the path that leads to the cessation of suffering.', src: LV },
    { q: 'What is suffering? It is the pain that accompanies birth, growing old, falling sick, and dying. It also includes the suffering of meeting the unpleasant and parting from the pleasant. Not finding what is being sought is also suffering. In short the five perpetuating aggregates are suffering.', src: LV },
    { q: 'What is the origin of suffering? It is the craving that perpetuates existence, which is attended upon by the passion for enjoyment, and which finds pleasures here and there. That is the origin of suffering.', src: LV },
    { q: 'What is the cessation of suffering? It is the complete and dispassionate cessation of craving that perpetuates existence, which is attended upon by the passion for enjoyment, and which finds pleasures here and there. This is the cessation of suffering.', src: LV },
    { q: 'What is the path that leads to the cessation of suffering? It is exclusively the eightfold path of the noble ones. This is the path that starts with correct view and ends with correct concentration.', src: LV },
    { q: 'However, monks, once I had recited the four truths of the noble ones three times, I developed the wisdom that sees their twelve aspects. At that point my mind was free and my insight was now free and pure. Monks, at that point I declared that I had awakened to unsurpassable, perfect and complete buddhahood.', src: LV },
    { q: 'Monks, as soon as the Thus-Gone One had uttered these words, every extremist symbol and banner that the five companions were wearing disappeared in an instant. Instead they each now found themselves dressed in the three robes of a mendicant with an alms bowl and their head shaven. This truly was their “going forth”; this very ordination became the essence of monkhood.', src: LV },
  ],
  act11: [
    { q: '“Friends, the unsurpassable and perfect awakening that I have accomplished through limitless billions of eons, I now place in your hands. I entrust you with a supreme entrustment. Now you should keep this teaching with you and teach it elaborately to others.”', src: LV },
    { q: '“Friends, in short, even if the lifespan of the Thus-Gone One were to last for an eon, and even if he were to praise this Dharma teaching uninterruptedly day and night, he would not be able to end his praise of this Dharma teaching, and his inspired speech would still continue.”', src: LV },
    { q: 'When the Blessed One had spoken, all the bodhisattvas, the great beings, headed by Maitreya; the great listeners headed by Mahākāśyapa; and the entire world with its gods, humans, demigods, and gandharvas rejoiced at the Blessed One’s teaching.', src: LV },
  ],
  // The Lalitavistara ends at the first teaching; the passing is told in the Mahāparinibbāna Sutta.
  act12: [
    { q: 'I too, Ānanda, am now old and full of years; my journey is drawing to its close. I am turning eighty years of age, and just as a worn-out cart is kept going with the help of repairs, so too the body of the Thus-Gone One is kept going by repairs.', src: 'Mahāparinibbāna Sutta (DN 16)' },
    { q: 'Therefore, Ānanda, be islands unto yourselves, refuges unto yourselves, seeking no external refuge; with the Dhamma as your island, the Dhamma as your refuge.', src: 'Mahāparinibbāna Sutta (DN 16)' },
    { q: 'Do not weep. Have I not already told you that all things that are pleasant and delightful are changeable, subject to separation? How could it be, Ānanda, that what is born, come into being, compounded, and subject to decay should not decay?', src: 'Mahāparinibbāna Sutta (DN 16)' },
    { q: 'Now, monks, I declare to you: all conditioned things are of a nature to decay. Strive on untiringly.', src: 'Mahāparinibbāna Sutta (DN 16)' },
  ],
};

// ---------- NPC question banks ----------
// 90% of monastics draw from QA_PALI, 10% from QA_MAHAYANA; bodhisattvas always Mahayana.
export const QA_PALI = [
  { q: 'Venerable one, what is the heart of the teaching?',
    a: 'To avoid all evil, to cultivate the good, and to purify one’s mind — this is the teaching of the buddhas.',
    src: 'Dhammapada 183' },
  { q: 'How should I regard my own mind?',
    a: 'Mind precedes all things; mind is their chief, and they are made by mind. If one speaks or acts with a pure mind, happiness follows like a shadow that never departs.',
    src: 'Dhammapada 1–2' },
  { q: 'What should be done about hatred?',
    a: 'Hatred is never appeased by hatred in this world. By love alone is hatred appeased. This is a law eternal.',
    src: 'Dhammapada 5' },
  { q: 'How wide should loving-kindness reach?',
    a: 'As a mother would protect her only child at the risk of her own life, even so let one cultivate a boundless heart towards all beings.',
    src: 'Metta Sutta (Snp 1.8)' },
  { q: 'How do I know what to believe?',
    a: 'Do not go by reports, by tradition, or by hearsay. When you know for yourselves that these things are wholesome and blameless, and lead to welfare and happiness, then you should live in accordance with them.',
    src: 'Kālāma Sutta (AN 3.65)' },
  { q: 'Why does pain wound us so deeply?',
    a: 'When touched by a painful feeling, the uninstructed person sorrows and laments, feeling two arrows: one of the body and one of the mind. The instructed noble disciple, touched by the same pain, feels only one.',
    src: 'Sallatha Sutta (SN 36.6)' },
  { q: 'How does one practise mindfulness of breathing?',
    a: 'Breathing in long, one knows, “I breathe in long.” Breathing out long, one knows, “I breathe out long.” Ever mindful one breathes in, mindful one breathes out.',
    src: 'Ānāpānasati Sutta (MN 118)' },
  { q: 'Is anything worth clinging to?',
    a: 'All conditioned things are impermanent — when one sees this with wisdom, one turns away from suffering. This is the path to purification.',
    src: 'Dhammapada 277' },
  { q: 'Who is the greatest of conquerors?',
    a: 'Though one should conquer a thousand times a thousand men in battle, the one who conquers himself is the greatest of conquerors.',
    src: 'Dhammapada 103' },
  { q: 'Where should I take refuge?',
    a: 'Be islands unto yourselves, refuges unto yourselves, seeking no external refuge; with the Dhamma as your island, the Dhamma as your refuge.',
    src: 'Mahāparinibbāna Sutta (DN 16)' },
];

export const QA_MAHAYANA = [
  { q: 'What is the nature of form?',
    a: 'Form is emptiness; emptiness is form. Form is not other than emptiness; emptiness is not other than form. The same is true of feelings, perceptions, formations, and consciousness.',
    src: 'Heart Sūtra' },
  { q: 'How should conditioned things be seen?',
    a: 'As a star, a lamp, a flaw of vision, an illusion, a dewdrop, a bubble, a dream, a flash of lightning, a cloud — thus should one view all that is conditioned.',
    src: 'Diamond Sūtra' },
  { q: 'What is the vow of a bodhisattva?',
    a: 'However many beings there are, I shall lead them all to nirvāṇa. Yet when innumerable beings have thus been liberated, in truth no being at all has been liberated. Why? No one is a bodhisattva who holds to the idea of a self.',
    src: 'Diamond Sūtra' },
  { q: 'Why would an awakened being feel sorrow?',
    a: 'Because all beings are sick, therefore I am sick. The sickness of a bodhisattva arises from great compassion.',
    src: 'Vimalakīrti Nirdeśa' },
  { q: 'Why do the buddhas appear in the world?',
    a: 'The buddhas appear in the world for one great purpose alone: to open for all beings the door to the knowledge and vision of the awakened ones.',
    src: 'Lotus Sūtra' },
  { q: 'What paints this world?',
    a: 'The mind is like a skilled painter who paints the various aggregates. In all the worlds there is nothing it does not create.',
    src: 'Avataṃsaka Sūtra' },
  { q: 'How fleeting is this life?',
    a: 'The three worlds are fleeting like autumn clouds. The birth and death of beings is like watching a dance. A being’s life is like lightning in the sky; it rushes past like a waterfall down a steep mountain.',
    src: 'The Play in Full (Lalitavistara)' },
  { q: 'Are things truly as they appear?',
    a: 'All phenomena are like a dream, an illusion, a mirage, a reflection of the moon in water. Knowing this, the wise generate compassion for those who grasp them as real.',
    src: 'Prajñāpāramitā Sūtras' },
];

// What the gods of the Heaven of Joy actually say — verbatim from the Lalitavistara.
export const QA_DEVA = [
  { q: 'What did the gods say when the Bodhisattva prepared to leave this heaven?',
    a: '“Virtuous One, without you, this Heaven of Joy will lose its splendor.”',
    src: LV },
  { q: 'How was his final teaching here announced?',
    a: '“Come, gather here. Come listen to the Bodhisattva’s final teaching on the Dharma, a recollection of the Dharma entitled ‘The Application of Passing.’”',
    src: LV },
  { q: 'What news did the gods carry down to Jambudvīpa?',
    a: '“Noble ones, give up this buddha realm. In twelve years’ time, the Bodhisattva will enter the womb of his mother.”',
    src: LV },
  { q: 'In what form should he enter his mother’s womb?',
    a: 'Some replied, “As a human in the form of a young brahmin.” But other gods suggested, “In the form of Śakra, or Brahmā, or a great king, or Vaiśravaṇa, or a gandharva, or a kinnara, or a mahoraga, or Maheśvara, or the moon god, or the sun god, or a garuḍa.”',
    src: LV },
  { q: 'What is it like to hear the Bodhisattva teach?',
    a: 'Each one of them thought, “The Bodhisattva is speaking directly to me; to me alone he extends a friendly welcome.”',
    src: LV },
  { q: 'What did Śakra tell the gods on the night of the great departure?',
    a: '“Friends, tonight the Bodhisattva will leave his home. So you should delight in making offerings to him.” Then Śakra, lord of the gods, himself said, “I will open the gates and show him the path.”',
    src: LV },
  { q: 'What did he ask the gods to look upon?',
    a: '“Friends, look upon the body of the Bodhisattva, adorned as it is with the signs of a hundred merits.”',
    src: LV },
  { q: 'How fleeting is even a god’s life?',
    a: 'The three worlds are fleeting like autumn clouds. The birth and death of beings is like watching a dance. A being’s life is like lightning in the sky; it rushes past like a waterfall down a steep mountain.',
    src: LV },
  { q: 'What did the Awakened One answer when Brahmā begged him to teach?',
    a: '“O Brahmā, the gates of nectar are opened.”',
    src: LV },
];

// The forest ascetics of the austerity years — not yet Buddhists. They praise
// mortification of the body; these are character lines, not scripture (no src).
export const QA_ASCETIC = [
  { q: 'Why do you practise such hardships?',
    a: 'The body is the snare of desire. Only by scorching it with hunger, sun, and stillness can the spirit be freed. Ease is the enemy of liberation.',
    src: null },
  { q: 'Is there no gentler way?',
    a: 'A blade is not sharpened on soft cloth. Old deeds cling to the flesh, and pain burns them away as fire burns chaff. The more the body suffers, the lighter the self becomes.',
    src: null },
  { q: 'What do you live on?',
    a: 'A single berry. A sip of river water. Some among us take nothing at all for days. Hunger is the great teacher; the well-fed learn nothing.',
    src: null },
  { q: 'How long will you sit like this?',
    a: 'Until the last craving is starved out of me. Sun and frost, thorn and fast — that is the only road. There is no awakening for the unburnt.',
    src: null },
];

// Impermanence bank — used by the sangha in the Mahāparinirvāṇa act.
export const QA_IMPERMANENCE = [
  { q: 'How should we hold what we love?',
    a: 'All things pleasant and delightful are changeable, subject to separation. How could it be that what is born, come into being, compounded, and subject to decay should not decay?',
    src: 'Mahāparinibbāna Sutta (DN 16)' },
  { q: 'What will the Teacher leave us?',
    a: 'The Dhamma and the discipline that I have taught you — that will be your teacher when I am gone.',
    src: 'Mahāparinibbāna Sutta (DN 16)' },
  { q: 'Is there any consolation tonight?',
    a: 'Impermanent indeed are conditioned things; their nature is to arise and pass away. Having arisen, they cease; their stilling is happiness.',
    src: 'verse at the parinibbāna (DN 16)' },
  { q: 'What should we contemplate often?',
    a: 'I am of the nature to age, to sicken, to die; all that is mine, beloved and pleasing, will become otherwise, will become separated from me.',
    src: 'Upajjhaṭṭhana Sutta (AN 5.57)' },
  { q: 'Can mindfulness of death bear fruit?',
    a: 'Mindfulness of death, when developed and cultivated, is of great fruit and benefit; it merges in the deathless, ends in the deathless.',
    src: 'Maraṇassati Sutta (AN 8.73)' },
];

// ---------- the great disciples (Q&A from what they actually said in the suttas) ----------
// halo: 'white' marks the arhats; Ānanda has none — he awakened only after the parinirvāṇa.
export const DISCIPLES = [
  { name: 'Śāriputra', halo: 'white', robe: 0xb8722a, qa: [
    { q: 'Venerable Śāriputra, how vast are the four truths?',
      a: 'Just as the footprint of any creature that walks can be placed within an elephant’s footprint, so all wholesome states are included within the four noble truths.',
      src: 'Mahāhatthipadopama Sutta (MN 28)' } ] },
  { name: 'Mahāmaudgalyāyana', halo: 'white', robe: 0xa35a2a, qa: [
    { q: 'Venerable Maudgalyāyana, what is the noble silence?',
      a: 'The second absorption, where thought and examination are stilled and the mind is unified — this is called the noble silence. The Blessed One admonished me not to neglect it.',
      src: 'Kolita Sutta (SN 21.1)' } ] },
  { name: 'Mahākāśyapa', halo: 'white', robe: 0x8a5a30, qa: [
    { q: 'Venerable Kāśyapa, why do you keep to the forest?',
      a: 'Content with any robe, any almsfood, any lodging, I see a pleasant abiding here and now — and I keep these practices out of compassion for those who come after, that they may follow the example.',
      src: 'after the Kassapa Saṃyutta (SN 16.5)' } ] },
  { name: 'Rāhula', halo: 'white', robe: 0xcc8433, qa: [
    { q: 'Venerable Rāhula, what did your father teach you?',
      a: 'As a mirror is for reflection, so a deed of body, speech, or mind should be done only after repeated reflection: will this harm myself, or others, or both?',
      src: 'Ambalaṭṭhikārāhulovāda Sutta (MN 61)' } ] },
  { name: 'Upāli', halo: 'white', robe: 0xb8722a, qa: [
    { q: 'Venerable Upāli, how do we recognise the true teaching?',
      a: 'Whatever leads to dispassion and not to passion, to being unfettered and not to being fettered, to shedding and not to accumulating — of that you may be certain: this is the Dhamma, this is the discipline.',
      src: 'Saṃkhitta Sutta (AN 7.83)' } ] },
  { name: 'Subhūti', halo: 'white', robe: 0xc98a3a, qa: [
    { q: 'Venerable Subhūti, how does one abide in emptiness?',
      a: 'One who abides without grasping at any mark, who gives rise to a mind that dwells nowhere — such a one abides in the perfection of wisdom. Thus have I heard the Blessed One teach, and thus I try to dwell.',
      src: 'after the Diamond Sūtra' } ] },
  { name: 'Ānanda', halo: null, robe: 0xd89a44, qa: [
    { q: 'Venerable Ānanda, what sustains the holy life?',
      a: 'I once said to the Blessed One that good friendship is half the holy life. He corrected me: say not so, Ānanda — good friendship is the whole of the holy life.',
      src: 'Upaḍḍha Sutta (SN 45.2)' },
    { q: 'Venerable Ānanda, how do you remember every word?',
      a: 'I have heard these teachings in the Blessed One’s presence and received them face to face. What is heard with a settled heart is not lost. Thus have I heard — so each of them begins.',
      src: 'after the frame of the sūtras' } ] },
  { name: 'Nanda', halo: 'white', robe: 0xc27a2e, qa: [
    { q: 'Venerable Nanda, how did you find contentment?',
      a: 'The Blessed One taught me to guard the doors of the senses, to know moderation in eating, and to be devoted to wakefulness. So guarded, discontent fell away of itself.',
      src: 'after the Nanda Sutta (AN 8.9)' } ] },
];

// ---------- the eight great bodhisattvas ----------
export const BODHISATTVAS = [
  { name: 'Mañjuśrī', hue: 0xe8a33d, qa: [
    { q: 'Noble Mañjuśrī, what is the perfection of wisdom?',
      a: 'Not grasping any phenomenon whatsoever, neither its arising nor its ceasing — that is the practice of the perfection of wisdom. Wisdom cuts through, as a sword through silence.',
      src: 'Prajñāpāramitā Sūtras' } ] },
  { name: 'Avalokiteśvara', hue: 0xf2f2f2, qa: [
    { q: 'Noble Avalokiteśvara, what did you see when you looked deeply?',
      a: 'Practising deeply the perfection of wisdom, I saw that the five aggregates are empty of inherent existence, and was freed from all suffering and distress.',
      src: 'Heart Sūtra' } ] },
  { name: 'Vajrapāṇi', hue: 0x3f6fd8, qa: [
    { q: 'Noble Vajrapāṇi, what protects the Dharma?',
      a: 'Unshakeable resolve protects it. As the vajra is unbreakable, so is the mind of awakening once truly aroused; no fear or obstacle can split it.',
      src: 'after the Tathāgataguhya teachings' } ] },
  { name: 'Maitreya', hue: 0xf0c95c, qa: [
    { q: 'Noble Maitreya, you who will come after — what will you teach?',
      a: 'The same Dharma, for it does not age: loving-kindness as the ground, the path in eight branches, and the deathless as its fruit. I received the crown from his own hands in the Heaven of Joy.',
      src: 'The Play in Full (Lalitavistara)' } ] },
  { name: 'Samantabhadra', hue: 0x5cb87a, qa: [
    { q: 'Noble Samantabhadra, what is the practice that never ends?',
      a: 'To honour all buddhas, to rejoice in the merit of others, to request the turning of the wheel, and to dedicate every deed to the awakening of all beings — these vows exhaust neither space nor time.',
      src: 'Avataṃsaka Sūtra, Vows of Samantabhadra' } ] },
  { name: 'Kṣitigarbha', hue: 0x9a6b3f, qa: [
    { q: 'Noble Kṣitigarbha, how far does your vow reach?',
      a: 'Until the hells themselves are emptied I shall not become a buddha; only when all beings are delivered will I myself realise awakening.',
      src: 'Kṣitigarbha Sūtra (vow)' } ] },
  { name: 'Ākāśagarbha', hue: 0x7a5cd0, qa: [
    { q: 'Noble Ākāśagarbha, what treasury do you hold?',
      a: 'A treasury vast as space itself: merit and wisdom without measure, given freely, never diminished — for what is measureless cannot be spent.',
      src: 'Ākāśagarbha Sūtra' } ] },
  { name: 'Sarvanīvaraṇaviṣkambhin', hue: 0xd85c8a, qa: [
    { q: 'Noble one, how are the hindrances removed?',
      a: 'Longing, ill will, dullness, restlessness, and doubt — see each one arise, and see that it too is empty of self. What is seen through clearly cannot obstruct.',
      src: 'after the Prajñāpāramitā teachings' } ] },
];

// ---------- scripted (non-verbatim) lines ----------
const SCRIPT_EN = {
  buddhaPrompt: { q: 'The Blessed One sits in stillness beneath the tree. His gaze rests upon you, unhurried as still water.', who: 'narrator' },
  buddhaAsk: 'Blessed One, would you tell of the Play in Full — the twelve deeds of your unfolding?',
  buddhaCard: 'Then listen well. It begins before this birth, in the Heaven of Joy…',
  focusReward: 'Your mind is settled and clear. A quiet warmth gathers around you.',
  sightAsk: 'What is this, that we are seeing?',
};
const SCRIPT_ES = {
  buddhaPrompt: { q: 'El Bienaventurado permanece inmóvil bajo el árbol. Su mirada se posa en ti, serena como el agua quieta.', who: 'narrator' },
  buddhaAsk: 'Bienaventurado, ¿nos contarías la Obra Completa, las doce hazañas de tu despliegue?',
  buddhaCard: 'Escucha bien, entonces. Comienza antes de este nacimiento, en el Cielo del Gozo…',
  focusReward: 'Tu mente está serena y clara. Un calor apacible se reúne a tu alrededor.',
  sightAsk: '¿Qué es esto que estamos viendo?',
};
export const script = (k) => (LANG === 'es' ? SCRIPT_ES : SCRIPT_EN)[k];
export const SCRIPT = SCRIPT_EN; // kept for older imports

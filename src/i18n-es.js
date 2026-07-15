// Spanish translations of translatable game text, keyed by the exact English
// string. Looked up at display time via tr() in i18n.js; an EMPTY entry falls
// back to English, so this file can be filled in gradually.
//
// FOR THE TRANSLATOR AGENT:
// - Fill in the '' values only. Do not change, reword, or remove any key.
// - NEVER add verbatim scripture here (NARRATION quotes, QA answers with a
//   `src` attribution): quote fidelity forbids machine translation — that
//   content deliberately stays in the 84000 English translation.
// - The keys below are safe: proper names, speaker labels, the player's own
//   questions, and character lines that carry no `src` attribution.
// - Keep typographic quotes (“ ” ‘ ’) and diacritics (Śākya, Ānanda) intact.
// - UI strings live in i18n.js (STR.es); scripted lines in content.js (SCRIPT_ES);
//   act titles in content.js (ACT_TITLES_ES). Empty entries there (nudge,
//   nudgeTouch) also await translation.

export const ES_CONTENT = {
  // ---- names and speaker labels ----
  "A monk": '',
  "A nun": '',
  "A god": '',
  "A god of the Heaven of Joy": '',
  "A mourner": '',
  "A rejoicing god": '',
  "A Śākya spectator": '',
  "A villager": '',
  "A wedding guest": '',
  "An ascetic": '',
  "An attendant": '',
  "Narrator": '',
  "narrator": '',
  "Ānanda": '',
  "The Blessed One": '',
  "The Bodhisattva": '',
  "The Bodhisattva, to the gods": '',
  "The gods": '',
  "The gods whisper": '',
  "The newborn": '',
  "The sage Asita": '',
  "You": '',
  "Devadatta, muttering": '',
  "Great Top-Knotted Brahmā, to Śakra": '',
  "Great Top-Knotted Brahmā, to the Blessed One": '',

  // ---- player questions (QA banks, disciples, bodhisattvas) ----
  "Venerable one, what is the heart of the teaching?": '',
  "How should I regard my own mind?": '',
  "What should be done about hatred?": '',
  "How wide should loving-kindness reach?": '',
  "How do I know what to believe?": '',
  "Why does pain wound us so deeply?": '',
  "How does one practise mindfulness of breathing?": '',
  "Is anything worth clinging to?": '',
  "Who is the greatest of conquerors?": '',
  "Where should I take refuge?": '',
  "What is the nature of form?": '',
  "How should conditioned things be seen?": '',
  "What is the vow of a bodhisattva?": '',
  "Why would an awakened being feel sorrow?": '',
  "Why do the buddhas appear in the world?": '',
  "What paints this world?": '',
  "How fleeting is this life?": '',
  "Are things truly as they appear?": '',
  "What did the gods say when the Bodhisattva prepared to leave this heaven?": '',
  "How was his final teaching here announced?": '',
  "What news did the gods carry down to Jambudvīpa?": '',
  "In what form should he enter his mother’s womb?": '',
  "What is it like to hear the Bodhisattva teach?": '',
  "What did Śakra tell the gods on the night of the great departure?": '',
  "What did he ask the gods to look upon?": '',
  "How fleeting is even a god’s life?": '',
  "What did the Awakened One answer when Brahmā begged him to teach?": '',
  "Why do you practise such hardships?": '',
  "Is there no gentler way?": '',
  "What do you live on?": '',
  "How long will you sit like this?": '',
  "How should we hold what we love?": '',
  "What will the Teacher leave us?": '',
  "Is there any consolation tonight?": '',
  "What should we contemplate often?": '',
  "Can mindfulness of death bear fruit?": '',
  "Venerable Śāriputra, how vast are the four truths?": '',
  "Venerable Maudgalyāyana, what is the noble silence?": '',
  "Venerable Kāśyapa, why do you keep to the forest?": '',
  "Venerable Rāhula, what did your father teach you?": '',
  "Venerable Upāli, how do we recognise the true teaching?": '',
  "Venerable Subhūti, how does one abide in emptiness?": '',
  "Venerable Ānanda, what sustains the holy life?": '',
  "Venerable Ānanda, how do you remember every word?": '',
  "Venerable Nanda, how did you find contentment?": '',
  "Noble Mañjuśrī, what is the perfection of wisdom?": '',
  "Noble Avalokiteśvara, what did you see when you looked deeply?": '',
  "Noble Vajrapāṇi, what protects the Dharma?": '',
  "Noble Maitreya, you who will come after — what will you teach?": '',
  "Noble Samantabhadra, what is the practice that never ends?": '',
  "Noble Kṣitigarbha, how far does your vow reach?": '',
  "Noble Ākāśagarbha, what treasury do you hold?": '',
  "Noble one, how are the hindrances removed?": '',

  // ---- ascetic character lines (not scripture) ----
  "The body is the snare of desire. Only by scorching it with hunger, sun, and stillness can the spirit be freed. Ease is the enemy of liberation.": '',
  "A blade is not sharpened on soft cloth. Old deeds cling to the flesh, and pain burns them away as fire burns chaff. The more the body suffers, the lighter the self becomes.": '',
  "A single berry. A sip of river water. Some among us take nothing at all for days. Hunger is the great teacher; the well-fed learn nothing.": '',
  "Until the last craving is starved out of me. Sun and frost, thorn and fast — that is the only road. There is no awakening for the unburnt.": '',

  // ---- scripted character lines (not scripture) ----
  "“The drums split for him before his arrow has left the string. All my life I have matched him stroke for stroke, and still the crowd sees only Siddhārtha.”": '',
  "“I struck my targets. So did Ānanda, and Sundarananda, and Daṇḍapāṇi. Then his one arrow passed through all of them as if they were air. Envy is a hot coal — and I cannot seem to put it down.”": '',
};

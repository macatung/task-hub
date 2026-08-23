export interface DhammapadaVerse {
  verse_number: number;
  chapter_vi: string;
  chapter_en?: string;
  chapter_pali: string;
  pali: string;
  vietnamese: string;
  english?: string;
  insight: string;
}

export const DHAMMAPADA_VERSES: DhammapadaVerse[] = [
  {
    verse_number: 1,
    chapter_vi: 'The Twin Verses',
    chapter_en: 'The Twin Verses',
    chapter_pali: 'Yamakavagga',
    pali: 'Manopubbaṅgamā dhammā, manosseṭṭhā manomayā;\nManasā ce paduṭṭhena, bhāsati vā karoti vā;\nTato naṃ dukkhamanveti, cakkaṃva vahato padaṃ.',
    vietnamese: 'Mind precedes all mental states,\nMind is their master, mind makes them;\nIf with an impure mind one speaks or acts,\nSuffering follows along,\nAs the wheel follows the hoof of the draft ox.',
    english: 'Mind precedes all mental states,\nMind is their master, mind makes them;\nIf with an impure mind one speaks or acts,\nSuffering follows along,\nAs the wheel follows the hoof of the draft ox.',
    insight: 'The mind is the forerunner of all experiences. Guard the mind from defilements to transcend suffering and karma.',
  },
  {
    verse_number: 2,
    chapter_vi: 'The Twin Verses',
    chapter_en: 'The Twin Verses',
    chapter_pali: 'Yamakavagga',
    pali: 'Manopubbaṅgamā dhammā, manosseṭṭhā manomayā;\nManasā ce pasannena, bhāsati vā karoti vā;\nTato naṃ sukhamanveti, chāyāva anapāyinī.',
    vietnamese: 'Mind precedes all mental states,\nMind is their master, mind makes them;\nIf with a pure mind one speaks or acts,\nHappiness follows along,\nLike a shadow that never departs.',
    english: 'Mind precedes all mental states,\nMind is their master, mind makes them;\nIf with a pure mind one speaks or acts,\nHappiness follows along,\nLike a shadow that never departs.',
    insight: 'Every pure thought plants seeds of abiding peace, joy, and serene clarity.',
  },
  {
    verse_number: 5,
    chapter_vi: 'The Twin Verses',
    chapter_en: 'The Twin Verses',
    chapter_pali: 'Yamakavagga',
    pali: 'Na hi verena verāni, sammantīdha kudācanaṃ;\nAverena ca sammanti, esa dhammo sanantano.',
    vietnamese: 'Hatred is never appeased by hatred in this world;\nBy non-hatred alone is hatred appeased.\nThis is an eternal law.',
    english: 'Hatred is never appeased by hatred in this world;\nBy non-hatred alone is hatred appeased.\nThis is an eternal law.',
    insight: 'Loving-kindness (Mettā) is the sole medicine that extinguishes resentment and creates harmony.',
  },
  {
    verse_number: 21,
    chapter_vi: 'Heedfulness',
    chapter_en: 'Heedfulness',
    chapter_pali: 'Appamādavagga',
    pali: 'Appamādo amatapadaṃ, pamādo maccuno padaṃ;\nAppamattā na mīyanti, ye pamattā yathā matā.',
    vietnamese: 'Heedfulness is the path to the Deathless;\nHeedlessness is the path to death.\nThe heedful do not die;\nThe heedless are as if already dead.',
    english: 'Heedfulness is the path to the Deathless;\nHeedlessness is the path to death.\nThe heedful do not die;\nThe heedless are as if already dead.',
    insight: 'Mindful alertness in every moment is the direct gateway to peace and awakening.',
  },
  {
    verse_number: 103,
    chapter_vi: 'The Thousands',
    chapter_en: 'The Thousands',
    chapter_pali: 'Sahassavagga',
    pali: 'Yo sahassaṃ sahassena, saṅgāme mānuse jine;\nEkañca jeyyamattānaṃ, sa ve saṅgāmajuttamo.',
    vietnamese: 'Though one may conquer a thousand times a thousand men in battle,\nYet one who conquers oneself\nIs the greatest conqueror of all.',
    english: 'Though one may conquer a thousand times a thousand men in battle,\nYet one who conquers oneself\nIs the greatest conqueror of all.',
    insight: 'The supreme victory is self-mastery—taming and directing one’s own mind with wisdom.',
  },
  {
    verse_number: 183,
    chapter_vi: 'The Buddha',
    chapter_en: 'The Buddha',
    chapter_pali: 'Buddhavagga',
    pali: 'Sabbapāpassa akaraṇaṃ, kusalassa upasampadā;\nSacittapariyodapanaṃ, etaṃ buddhāna sāsanaṃ.',
    vietnamese: 'To avoid all evil,\nTo cultivate all good,\nTo purify one’s own mind—\nThis is the teaching of all Buddhas.',
    english: 'To avoid all evil,\nTo cultivate all good,\nTo purify one’s own mind—\nThis is the teaching of all Buddhas.',
    insight: 'The core essence of wisdom: Cease unwholesome deeds, cultivate goodness, and purify the mind.',
  },
  {
    verse_number: 277,
    chapter_vi: 'The Path',
    chapter_en: 'The Path',
    chapter_pali: 'Maggavagga',
    pali: 'Sabbe saṅkhārā aniccāti, yadā paññāya passati;\nAtha nibbindatī dukkhe, esa maggo visuddhiyā.',
    vietnamese: 'All conditioned things are impermanent;\nWhen one sees this with discernment,\nOne turns away from suffering.\nThis is the path to purification.',
    english: 'All conditioned things are impermanent;\nWhen one sees this with discernment,\nOne turns away from suffering.\nThis is the path to purification.',
    insight: 'Observing the arising and passing of all phenomena frees the heart from attachment and brings tranquility amidst change.',
  },
];

export interface HealthReminder {
  id: string;
  type: 'water' | 'eye' | 'stretch' | 'breathe';
  title: string;
  message: string;
  icon: string;
}

export const HEALTH_REMINDERS: HealthReminder[] = [
  {
    id: 'breathe-1',
    type: 'breathe',
    title: 'Mindful Breathing 🧘',
    message: 'Pause for a mindful moment. Inhale deeply feeling calm, exhale gently with a serene smile.',
    icon: '🌸',
  },
  {
    id: 'water-1',
    type: 'water',
    title: 'Hydrate the Body 💧',
    message: 'Take a mindful sip of warm water. Feel the refreshing flow nourishing every cell.',
    icon: '💧',
  },
  {
    id: 'eye-1',
    type: 'eye',
    title: 'Eye Relaxation Break 👀',
    message: 'Look 20 feet away for 20 seconds, or close your eyes gently to give them restorative rest.',
    icon: '🌿',
  },
  {
    id: 'stretch-1',
    type: 'stretch',
    title: 'Spine & Shoulder Relief 🧘‍♂️',
    message: 'Stretch your arms gently, roll your neck, and align your spine to restore smooth energy flow.',
    icon: '⚡',
  },
];

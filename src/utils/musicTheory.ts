// Music theory utility functions

// Define the order of sharps in key signatures
const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];

// Define the order of flats in key signatures
const FLAT_ORDER = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];

// Map of key signatures to the number of accidentals (positive for sharps, negative for flats)
export const KEY_SIGNATURES: { [key: string]: number } = {
  'C': 0,       // No sharps or flats
  'G': 1,       // 1 sharp (F#)
  'D': 2,       // 2 sharps (F#, C#)
  'A': 3,       // 3 sharps (F#, C#, G#)
  'E': 4,       // 4 sharps (F#, C#, G#, D#)
  'B': 5,       // 5 sharps (F#, C#, G#, D#, A#)
  'F#': 6,      // 6 sharps (F#, C#, G#, D#, A#, E#)
  'C#': 7,      // 7 sharps (F#, C#, G#, D#, A#, E#, B#)
  'F': -1,      // 1 flat (Bb)
  'Bb': -2,     // 2 flats (Bb, Eb)
  'Eb': -3,     // 3 flats (Bb, Eb, Ab)
  'Ab': -4,     // 4 flats (Bb, Eb, Ab, Db)
  'Db': -5,     // 5 flats (Bb, Eb, Ab, Db, Gb)
  'Gb': -6,     // 6 flats (Bb, Eb, Ab, Db, Gb, Cb)
  'Cb': -7,     // 7 flats (Bb, Eb, Ab, Db, Gb, Cb, Fb)
  // Minor keys
  'Am': 0,      // No sharps or flats (relative minor of C)
  'Em': 1,      // 1 sharp (F#) (relative minor of G)
  'Bm': 2,      // 2 sharps (F#, C#) (relative minor of D)
  'F#m': 3,     // 3 sharps (F#, C#, G#) (relative minor of A)
  'C#m': 4,     // 4 sharps (F#, C#, G#, D#) (relative minor of E)
  'G#m': 5,     // 5 sharps (F#, C#, G#, D#, A#) (relative minor of B)
  'D#m': 6,     // 6 sharps (F#, C#, G#, D#, A#, E#) (relative minor of F#)
  'A#m': 7,     // 7 sharps (F#, C#, G#, D#, A#, E#, B#) (relative minor of C#)
  'Dm': -1,     // 1 flat (Bb) (relative minor of F)
  'Gm': -2,     // 2 flats (Bb, Eb) (relative minor of Bb)
  'Cm': -3,     // 3 flats (Bb, Eb, Ab) (relative minor of Eb)
  'Fm': -4,     // 4 flats (Bb, Eb, Ab, Db) (relative minor of Ab)
  'Bbm': -5,    // 5 flats (Bb, Eb, Ab, Db, Gb) (relative minor of Db)
  'Ebm': -6,    // 6 flats (Bb, Eb, Ab, Db, Gb, Cb) (relative minor of Gb)
  'Abm': -7     // 7 flats (Bb, Eb, Ab, Db, Gb, Cb, Fb) (relative minor of Cb)
};

/**
 * Applies accidentals based on key signature to avoid showing redundant accidentals in the score
 * 
 * @param note The note name with optional accidental and octave (e.g., 'C#4')
 * @param key The key signature (e.g., 'G', 'Bb', 'F#m')
 * @returns The note with accidentals adjusted according to the key signature
 */
export function applyAccidentals(note: string, key: string): { noteWithoutAccidental: string, accidental: string | null } {
  if (!note || !key) {
    return { noteWithoutAccidental: note, accidental: null };
  }

  // Parse the note - improved regex to better handle both sharp and flat notations
  const noteMatch = note.match(/^([A-G])(#|b)?(\d+)$/);
  if (!noteMatch) {
    console.warn(`Invalid note format in applyAccidentals: ${note}`);
    return { noteWithoutAccidental: note, accidental: null };
  }

  const [_, noteLetter, noteAccidental, octave] = noteMatch;
  
  // Get the key signature accidentals count (positive for sharps, negative for flats)
  const keyAccidentals = KEY_SIGNATURES[key] || 0;
  
  // Determine if the note would have an accidental in the key signature
  let hasKeyAccidental = false;
  let keyAccidentalType = '';

  if (keyAccidentals > 0) {
    // Key has sharps
    hasKeyAccidental = SHARP_ORDER.slice(0, keyAccidentals).includes(noteLetter);
    keyAccidentalType = '#';
  } else if (keyAccidentals < 0) {
    // Key has flats
    hasKeyAccidental = FLAT_ORDER.slice(0, Math.abs(keyAccidentals)).includes(noteLetter);
    keyAccidentalType = 'b';
  }
  
  // Handle cases based on key signature and note accidental
  if (noteAccidental === undefined) {
    // Natural note
    if (hasKeyAccidental) {
      // The note would have an accidental in this key, but it's explicitly natural
      // so we need to show a natural sign
      return { noteWithoutAccidental: `${noteLetter}${octave}`, accidental: 'n' };
    }
    // No accidental in the key signature, no explicit accidental
    return { noteWithoutAccidental: `${noteLetter}${octave}`, accidental: null };
  } else if (noteAccidental === keyAccidentalType && hasKeyAccidental) {
    // The note has an accidental that matches the key signature - no need to show it
    return { noteWithoutAccidental: `${noteLetter}${octave}`, accidental: null };
  } else {
    // The note has an accidental that doesn't match the key signature - show it
    return { noteWithoutAccidental: `${noteLetter}${octave}`, accidental: noteAccidental };
  }
} 
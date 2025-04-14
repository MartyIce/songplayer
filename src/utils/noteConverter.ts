// Map of notes to their numeric values (C0 = 0, C#0 = 1, etc.)
const NOTE_VALUES: { [key: string]: number } = {
  'C': 0, 'C#': 1, 'Db': 1,
  'D': 2, 'D#': 3, 'Eb': 3,
  'E': 4,
  'F': 5, 'F#': 6, 'Gb': 6,
  'G': 7, 'G#': 8, 'Ab': 8,
  'A': 9, 'A#': 10, 'Bb': 10,
  'B': 11
};

interface StringFretNote {
  string: number;
  fret: number;
  time: number;
  duration: number;
  color?: string;
}

interface RestNote {
  time: number;
  duration: number;
  rest: boolean;
  color?: string;
}

// Parse a note string (e.g., "C#4") into its components
function parseNote(noteStr: string): { note: string; octave: number } {
  const match = noteStr.match(/^([A-G][#b]?)(\d+)$/);
  if (!match) throw new Error(`Invalid note format: ${noteStr}`);
  return { note: match[1], octave: parseInt(match[2]) };
}

// Convert a note to its MIDI number (C0 = 0, C4 = 60)
function noteToMidi(noteStr: string): number {
  const { note, octave } = parseNote(noteStr);
  return NOTE_VALUES[note] + (octave * 12);
}

// Find the best string and fret combination for a note
function findBestPosition(midiNote: number, tuning: string[]): { string: number; fret: number } {
  let bestString = 1;
  let bestFret = 0;
  let bestScore = Infinity;

  // Standard guitar tuning from low to high (E2 to E4)
  // These are the actual MIDI numbers for each string
  const tuningMidi = [40, 45, 50, 55, 59, 64]; // E2, A2, D3, G3, B3, E4
  const stringNames = ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'];
  
  // Try each string
  tuningMidi.forEach((openString, index) => {
    const stringNumber = 6 - index; // Convert to string numbers (6 to 1, from low to high)
    const fret = midiNote - openString;
    
    // Check if this position is playable (fret >= 0 and reasonable)
    if (fret >= 0 && fret <= 15) {
      // Calculate how far this position is from the target note
      const resultingMidi = openString + fret;
      const distance = Math.abs(resultingMidi - midiNote);
      
      // If this position gives us the exact note we want (including octave)
      if (distance === 0) {
        // Calculate a score for this position
        // Lower score is better
        let score = fret * 1000; // Very heavily penalize higher frets
        
        // Boxing preference: strongly prefer frets 0-4
        if (fret <= 4) {
          score -= 10000; // Huge bonus for being in the preferred box
          // Additional bonus for lower frets within the box
          score -= (4 - fret) * 1000;
        }
        
        // Small preference for middle strings to avoid jumping between extremes
        const distanceFromMiddle = Math.abs(3.5 - stringNumber);
        score += distanceFromMiddle * 25;
        
        // Update if this is the best position so far
        if (score < bestScore) {
          bestScore = score;
          bestString = stringNumber;
          bestFret = fret;
        }
      }
    }
  });

  // If we didn't find an exact match, something went wrong
  if (bestScore === Infinity) {
    throw new Error(`Cannot find playable position for note: ${midiNote}`);
  }

  return { string: bestString, fret: bestFret };
}

export function convertNoteToStringFret(
  noteData: { note?: string; time: number; duration: number; color?: string; rest?: boolean },
  tuning: string[]
): StringFretNote | RestNote {
  // If it's a rest note, return it as is
  if (noteData.rest) {
    return {
      time: noteData.time,
      duration: noteData.duration,
      rest: true,
      ...(noteData.color && { color: noteData.color })
    };
  }

  // Otherwise convert the pitch note to string/fret
  if (!noteData.note) {
    throw new Error('Note data must have either a note or rest property');
  }

  const midiNote = noteToMidi(noteData.note);
  const position = findBestPosition(midiNote, tuning);

  return {
    string: position.string,
    fret: position.fret,
    time: noteData.time,
    duration: noteData.duration,
    ...(noteData.color && { color: noteData.color })
  };
}

export function convertSongToStringFret(song: any): any {
  const { tuning, notes, ...restOfSong } = song;
  
  const convertedNotes = notes.map((note: any) => 
    convertNoteToStringFret(note, tuning)
  );

  return {
    ...restOfSong,
    notes: convertedNotes
  };
} 
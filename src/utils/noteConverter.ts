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
  color: string;
}

// Parse a note string (e.g., "C#4") into its components
function parseNote(noteStr: string): { note: string; octave: number } {
  const match = noteStr.match(/^([A-G][#b]?)(\d+)$/);
  if (!match) throw new Error(`Invalid note format: ${noteStr}`);
  return { note: match[1], octave: parseInt(match[2]) };
}

// Convert a note to its MIDI number (C0 = 12, C4 = 60)
function noteToMidi(noteStr: string): number {
  const { note, octave } = parseNote(noteStr);
  return NOTE_VALUES[note] + (octave + 1) * 12;
}

// Find the best string and fret combination for a note
function findBestPosition(midiNote: number, tuning: string[]): { string: number; fret: number } {
  let bestString = 1;
  let bestFret = 0;
  let minFret = Infinity;

  // Convert tuning notes to MIDI numbers
  const tuningMidi = tuning.map(noteToMidi);

  // Try each string
  tuningMidi.forEach((openString, index) => {
    const stringNumber = 6 - index; // Convert array index to string number (6 to 1)
    const fret = midiNote - openString;
    
    // Check if this position is playable (fret >= 0 and reasonable)
    if (fret >= 0 && fret <= 12) { // Limit to first 12 frets for reasonable positions
      if (fret < minFret) {
        minFret = fret;
        bestString = stringNumber;
        bestFret = fret;
      }
    }
  });

  if (minFret === Infinity) {
    throw new Error(`Cannot find playable position for note: ${midiNote}`);
  }

  return { string: bestString, fret: bestFret };
}

export function convertNoteToStringFret(
  noteData: { note: string; time: number; duration: number; color: string },
  tuning: string[]
): StringFretNote {
  const midiNote = noteToMidi(noteData.note);
  const position = findBestPosition(midiNote, tuning);

  return {
    string: position.string,
    fret: position.fret,
    time: noteData.time,
    duration: noteData.duration,
    color: noteData.color
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
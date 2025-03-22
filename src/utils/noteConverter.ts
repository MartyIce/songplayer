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
  
  // Debug output
  console.log('\n=== Debug Info ===');
  console.log('Target note MIDI:', midiNote);
  console.log('String tunings MIDI:', tuningMidi);
  stringNames.forEach((note, i) => {
    console.log(`String ${6-i}: ${note} = MIDI ${tuningMidi[i]}`);
  });
  console.log('================\n');

  // Try each string
  tuningMidi.forEach((openString, index) => {
    const stringNumber = 6 - index; // Convert to string numbers (6 to 1, from low to high)
    const fret = midiNote - openString;
    
    console.log(`\nTrying string ${stringNumber} (${stringNames[index]})`);
    console.log(`Open string MIDI: ${openString}`);
    console.log(`Required fret: ${fret}`);
    
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
        
        console.log(`Valid position found: string ${stringNumber}, fret ${fret}`);
        console.log(`Score: ${score}`);
        
        // Update if this is the best position so far
        if (score < bestScore) {
          bestScore = score;
          bestString = stringNumber;
          bestFret = fret;
          console.log(`New best position: string ${bestString}, fret ${bestFret} (score: ${score})`);
        }
      }
    }
  });

  // If we didn't find an exact match, something went wrong
  if (bestScore === Infinity) {
    throw new Error(`Cannot find playable position for note: ${midiNote}`);
  }

  console.log(`\nFinal selected position: string ${bestString}, fret ${bestFret} (score: ${bestScore})`);
  return { string: bestString, fret: bestFret };
}

// Test function to verify the algorithm
function testNoteConversion(noteStr: string) {
  console.log(`\nTesting note: ${noteStr}`);
  const midiNote = noteToMidi(noteStr);
  console.log(`MIDI number: ${midiNote}`);
  const position = findBestPosition(midiNote, ['E2', 'A2', 'D3', 'G3', 'B3', 'E4']);
  console.log(`Result: string ${position.string}, fret ${position.fret}`);
  return position;
}

// Run test cases
console.log('\n=== Running Test Cases ===');
const e4Result = testNoteConversion('E4');
const c5Result = testNoteConversion('C5');
console.log('\n=== Test Results ===');
console.log('E4:', e4Result);
console.log('C5:', c5Result);

export function convertNoteToStringFret(
  noteData: { note: string; time: number; duration: number; color?: string },
  tuning: string[]
): StringFretNote {
  console.log('Converting note:', noteData.note);
  const midiNote = noteToMidi(noteData.note);
  console.log(`Note ${noteData.note} converted to MIDI: ${midiNote}`);
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
import React, { useEffect } from 'react';
import { StringFretNote } from '../types/SongTypes';
import { convertNoteToStringFret } from '../utils/noteConverter';

// This is the same function as in VexStaffDisplay.tsx
function getPitchFromTab(note: StringFretNote): string {
  // If origNoteDesc is provided, use it directly without recalculating the octave
  if (note.origNoteDesc) {
    return note.origNoteDesc;
  }
  
  // Original implementation for cases where origNoteDesc is not available
  const baseNote = ['E5', 'B4', 'G4', 'D4', 'A3', 'E3'][note.string - 1];
  const noteName = baseNote.slice(0, -1);
  const octave = parseInt(baseNote.slice(-1));
  
  // Calculate semitones from base note
  const semitones = note.fret;
  
  // Basic pitch calculation
  // Include both sharp and flat note names
  const sharpNotes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const flatNotes = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
  
  const baseIndex = sharpNotes.indexOf(noteName);
  const newIndex = (baseIndex + semitones) % 12;
  const octaveIncrease = Math.floor((baseIndex + semitones) / 12);
  
  // Prefer flat notation for common flat keys
  // This is a simple approximation - ideally would check the song's key signature
  const useFlats = [1, 3, 6, 8, 10].includes(newIndex); // Db, Eb, Gb, Ab, Bb
  const notes = useFlats ? flatNotes : sharpNotes;
  
  return `${notes[newIndex]}${octave + octaveIncrease}`;
}

const TestPitchFromTab: React.FC = () => {
  useEffect(() => {
    // Define a standard tuning
    const tuning = ['E4', 'B3', 'G3', 'D3', 'A2', 'E2'];
    
    // Test cases - original pitch notes that will be converted to StringFretNote
    const testCases = [
      { note: 'C#4', time: 0, duration: 1 },
      { note: 'Db4', time: 0, duration: 1 },
      { note: 'Bb3', time: 0, duration: 1 },
      { note: 'A#3', time: 0, duration: 1 },
      { note: 'F#3', time: 0, duration: 1 },
      { note: 'Gb3', time: 0, duration: 1 }
    ];
    
    // Convert each test case to StringFretNote and check if the origNoteDesc is preserved
    testCases.forEach(testCase => {
      // Convert to string/fret note
      const stringFretNote = convertNoteToStringFret(testCase, tuning) as StringFretNote;
      
      // Get the pitch based on the string/fret
      const calculatedPitch = getPitchFromTab(stringFretNote);
      
      // Original without origNoteDesc - would use the algorithm in getPitchFromTab
      const stringFretNoteWithoutDesc = { ...stringFretNote, origNoteDesc: undefined };
      const calculatedPitchWithoutDesc = getPitchFromTab(stringFretNoteWithoutDesc);
      
      console.log(`Original note: ${testCase.note}`);
      console.log(`Converted to string ${stringFretNote.string}, fret ${stringFretNote.fret}`);
      console.log(`origNoteDesc: ${stringFretNote.origNoteDesc}`);
      console.log(`Calculated pitch with origNoteDesc: ${calculatedPitch}`);
      console.log(`Calculated pitch without origNoteDesc: ${calculatedPitchWithoutDesc}`);
      console.log('---');
    });
  }, []);
  
  return (
    <div>
      <h2>Testing getPitchFromTab with origNoteDesc</h2>
      <p>Check the console for results</p>
    </div>
  );
};

export default TestPitchFromTab; 
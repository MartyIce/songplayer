import React, { useEffect, useState } from 'react';
import { Note, StringFretNote } from '../types/SongTypes';

// Copy the essential functions from VexStaffDisplay.tsx for debugging

interface GroupedNote {
  time: number;
  duration: number;
  notes: string[];
  active: boolean;
  isRest?: boolean;
  voiceCount?: number;
  measure?: number;
}

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

function getMeasureNumber(time: number, beatsPerMeasure: number): number {
  return Math.floor(time / beatsPerMeasure);
}

function isNoteActive(noteTime: number, noteDuration: number, currentTime: number): boolean {
  const TIMING_TOLERANCE = 0.05; // 50ms tolerance
  return noteTime <= currentTime && 
         noteTime + noteDuration > currentTime - TIMING_TOLERANCE;
}

function groupNotesByTime(visibleNotes: Note[], currentTime: number, timeSignature: [number, number]): GroupedNote[] {
  const groupedNotes: GroupedNote[] = [];
  const restGroups: { [key: string]: Note[] } = {}; // Track simultaneous rests
  const beatsPerMeasure = timeSignature[0];
  
  // First pass: Group regular notes and collect rests
  visibleNotes.forEach(note => {
    if ('rest' in note) {
      // Group rests by time, using exact time value to maintain measure position
      const timeKey = note.time.toString();
      if (!restGroups[timeKey]) {
        restGroups[timeKey] = [];
      }
      restGroups[timeKey].push(note);
      return;
    }

    let pitch: string = '';
    if ('note' in note) {
      pitch = note.note;
    } else if ('string' in note) {
      pitch = getPitchFromTab(note);
    } else {
      return;
    }
    
    if (!pitch) return;
    
    const active = isNoteActive(note.time, note.duration, currentTime);
    const existingGroup = groupedNotes.find(g => 
      Math.abs(g.time - note.time) < 0.001 && g.duration === note.duration && !g.isRest
    );
    
    if (existingGroup) {
      existingGroup.notes.push(pitch);
      if (active) existingGroup.active = true;
    } else {
      groupedNotes.push({
        time: note.time,
        duration: note.duration,
        notes: [pitch],
        active,
        measure: getMeasureNumber(note.time, beatsPerMeasure)
      });
    }
  });
  
  // Second pass: Add rest groups at their exact positions
  Object.entries(restGroups).forEach(([timeStr, rests]) => {
    const time = parseFloat(timeStr);
    if (rests.length > 0) {
      groupedNotes.push({
        time: time,
        duration: rests[0].duration,
        notes: [],
        active: false,
        isRest: true,
        voiceCount: rests.length,
        measure: getMeasureNumber(time, beatsPerMeasure)
      });
    }
  });
  
  // Sort all groups by measure and time within measure
  groupedNotes.sort((a, b) => {
    const measureDiff = (a.measure || 0) - (b.measure || 0);
    if (measureDiff !== 0) return measureDiff;
    
    const timeDiff = a.time - b.time;
    if (timeDiff !== 0) return timeDiff;
    
    // If times are equal, put rests before notes
    if (a.isRest && !b.isRest) return -1;
    if (!a.isRest && b.isRest) return 1;
    
    return 0;
  });
  
  return groupedNotes;
}

// Create VexFlow key strings for debugging
function createVexflowKeys(groupedNotes: GroupedNote[]): string[][] {
  return groupedNotes.map((group) => {
    if (group.isRest) {
      return ["rest"];
    }
    
    if (!group.notes.length) {
      return ["empty"];
    }
    
    return group.notes.map(note => {
      const noteName = note.slice(0, -1);
      const octave = note.slice(-1);
      
      // For VexFlow, we need to separate the accidental from the note
      // VexFlow requires just the base note letter in the key string
      let baseNoteName;
      if (noteName.includes('#') || (noteName.includes('b') && noteName !== 'B')) {
        baseNoteName = noteName.charAt(0).toLowerCase();
      } else {
        baseNoteName = noteName.toLowerCase();
      }
      
      return `${baseNoteName}/${octave}`;
    });
  });
}

// Debug accidentals
function debugAccidentals(groupedNotes: GroupedNote[]): string[][] {
  return groupedNotes.map((group) => {
    if (group.isRest) {
      return ["rest"];
    }
    
    if (!group.notes.length) {
      return ["empty"];
    }
    
    return group.notes.map(note => {
      const noteName = note.slice(0, -1);
      
      if (noteName.includes('#')) {
        return '#';
      } else if (noteName.includes('b') && noteName !== 'B') {
        return 'b';
      } else {
        return '';
      }
    });
  });
}

interface StaffDebuggerProps {
  testSong?: any;
}

const StaffDebugger: React.FC<StaffDebuggerProps> = ({ testSong }) => {
  const [debugData, setDebugData] = useState<any>({});
  
  useEffect(() => {
    const loadSong = async () => {
      let songData;
      
      if (testSong) {
        songData = testSong;
      } else {
        // Load the test song
        try {
          const response = await fetch(`${process.env.PUBLIC_URL}/songs/test-song.json`);
          if (!response.ok) {
            throw new Error(`Failed to load song: ${response.statusText}`);
          }
          songData = await response.json();
        } catch (err) {
          console.error('Error loading test song:', err);
          return;
        }
      }
      
      // Process the first few notes
      const firstNotes = songData.notes.slice(0, 8);
      const timeSignature = songData.timeSignature || [4, 4];
      const currentTime = 0; // Just debugging, not playing
      
      // Group the notes
      const groupedNotes = groupNotesByTime(firstNotes, currentTime, timeSignature);
      const vexflowKeys = createVexflowKeys(groupedNotes);
      const accidentals = debugAccidentals(groupedNotes);
      
      // Create debug data
      const noteDetails = firstNotes.map((note: any, index: number) => {
        return {
          original: 'note' in note ? note.note : (note.rest ? 'rest' : `string ${note.string}, fret ${note.fret}`),
          time: note.time,
          duration: note.duration,
          measure: note.measure || getMeasureNumber(note.time, timeSignature[0]),
        };
      });
      
      const groupDetails = groupedNotes.map((group, index) => {
        return {
          notes: group.notes.join(', '),
          time: group.time,
          duration: group.duration,
          measure: group.measure,
          vexflowKeys: vexflowKeys[index].join(', '),
          accidentals: accidentals[index].join(', ')
        };
      });
      
      setDebugData({
        songInfo: {
          title: songData.title,
          timeSignature,
        },
        notes: noteDetails,
        groupedNotes: groupDetails
      });
    };
    
    loadSong();
  }, [testSong]);
  
  return (
    <div style={{ margin: '20px', padding: '20px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
      <h2>Staff Rendering Debugger</h2>
      
      {debugData.songInfo && (
        <div>
          <h3>Song Info</h3>
          <p>Title: {debugData.songInfo.title}</p>
          <p>Time Signature: {debugData.songInfo.timeSignature.join('/')}</p>
        </div>
      )}
      
      {debugData.notes && (
        <div>
          <h3>Original Notes</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#e0e0e0' }}>
                <th style={{ padding: '8px', border: '1px solid #ccc' }}>Note</th>
                <th style={{ padding: '8px', border: '1px solid #ccc' }}>Time</th>
                <th style={{ padding: '8px', border: '1px solid #ccc' }}>Duration</th>
                <th style={{ padding: '8px', border: '1px solid #ccc' }}>Measure</th>
              </tr>
            </thead>
            <tbody>
              {debugData.notes.map((note: any, index: number) => (
                <tr key={index}>
                  <td style={{ padding: '8px', border: '1px solid #ccc' }}>{note.original}</td>
                  <td style={{ padding: '8px', border: '1px solid #ccc' }}>{note.time}</td>
                  <td style={{ padding: '8px', border: '1px solid #ccc' }}>{note.duration}</td>
                  <td style={{ padding: '8px', border: '1px solid #ccc' }}>{note.measure}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {debugData.groupedNotes && (
        <div>
          <h3>Grouped Notes (for VexFlow)</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#e0e0e0' }}>
                <th style={{ padding: '8px', border: '1px solid #ccc' }}>Notes</th>
                <th style={{ padding: '8px', border: '1px solid #ccc' }}>Time</th>
                <th style={{ padding: '8px', border: '1px solid #ccc' }}>Duration</th>
                <th style={{ padding: '8px', border: '1px solid #ccc' }}>Measure</th>
                <th style={{ padding: '8px', border: '1px solid #ccc' }}>VexFlow Keys</th>
                <th style={{ padding: '8px', border: '1px solid #ccc' }}>Accidentals</th>
              </tr>
            </thead>
            <tbody>
              {debugData.groupedNotes.map((group: any, index: number) => (
                <tr key={index}>
                  <td style={{ padding: '8px', border: '1px solid #ccc' }}>{group.notes}</td>
                  <td style={{ padding: '8px', border: '1px solid #ccc' }}>{group.time}</td>
                  <td style={{ padding: '8px', border: '1px solid #ccc' }}>{group.duration}</td>
                  <td style={{ padding: '8px', border: '1px solid #ccc' }}>{group.measure}</td>
                  <td style={{ padding: '8px', border: '1px solid #ccc' }}>{group.vexflowKeys}</td>
                  <td style={{ padding: '8px', border: '1px solid #ccc' }}>{group.accidentals}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default StaffDebugger; 
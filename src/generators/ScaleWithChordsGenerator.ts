import { SongData, StringFretNote, ChordData } from '../types/SongTypes';

export class ScaleWithChordsGenerator {
  private static readonly CHROMATIC_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  
  private static readonly MAJOR_SCALE_INTERVALS = [0, 2, 4, 5, 7, 9, 11]; // W-W-H-W-W-W-H
  private static readonly MINOR_SCALE_INTERVALS = [0, 2, 3, 5, 7, 8, 10]; // W-H-W-W-H-W-W
  
  private static readonly MAJOR_CHORD_PROGRESSION = [1, 4, 5, 1]; // I-IV-V-I
  private static readonly MINOR_CHORD_PROGRESSION = [1, 4, 5, 1]; // i-iv-v-i

  // Guitar tuning: [E2, A2, D3, G3, B3, E4] as MIDI numbers
  private static readonly GUITAR_TUNING_MIDI = [40, 45, 50, 55, 59, 64];
  
  // Define fret box positions for different keys
  private static readonly FRET_BOXES: { [key: string]: { startFret: number; endFret: number } } = {
    'C': { startFret: 0, endFret: 4 },
    'C#': { startFret: 1, endFret: 5 },
    'D': { startFret: 2, endFret: 6 },
    'D#': { startFret: 3, endFret: 7 },
    'E': { startFret: 0, endFret: 4 }, // Use open position
    'F': { startFret: 1, endFret: 5 },
    'F#': { startFret: 2, endFret: 6 },
    'G': { startFret: 3, endFret: 7 },
    'G#': { startFret: 4, endFret: 8 },
    'A': { startFret: 0, endFret: 4 }, // Use open position
    'A#': { startFret: 1, endFret: 5 },
    'B': { startFret: 2, endFret: 6 }
  };

  /**
   * Convert a note interval to MIDI number
   */
  private getNoteMidi(rootKey: string, interval: number, octave: number = 4): number {
    const rootIndex = ScaleWithChordsGenerator.CHROMATIC_NOTES.indexOf(rootKey);
    if (rootIndex === -1) {
      throw new Error(`Invalid root key: ${rootKey}`);
    }
    
    const noteIndex = (rootIndex + interval) % 12;
    return noteIndex + (octave * 12);
  }

  /**
   * Find the best string and fret for a MIDI note within a fret box
   */
  private findStringFretInBox(midiNote: number, fretBox: { startFret: number; endFret: number }): { string: number; fret: number } | null {
    let bestPosition: { string: number; fret: number } | null = null;
    let bestScore = Infinity;

    // Try each string (6 to 1, from low E to high E)
    ScaleWithChordsGenerator.GUITAR_TUNING_MIDI.forEach((openStringMidi, index) => {
      const stringNumber = 6 - index; // Convert to guitar string numbers (6=low E, 1=high E)
      const fret = midiNote - openStringMidi;
      
      // Check if this position is within our fret box
      if (fret >= fretBox.startFret && fret <= fretBox.endFret) {
        // Calculate score - prefer lower frets and middle strings
        let score = fret * 10; // Prefer lower frets
        
        // Prefer middle strings (strings 3, 4) for better playability
        const stringPreference = Math.abs(3.5 - stringNumber);
        score += stringPreference * 5;
        
        if (score < bestScore) {
          bestScore = score;
          bestPosition = { string: stringNumber, fret };
        }
      }
    });

    return bestPosition;
  }

  /**
   * Generate a scale pattern with chord progression
   */
  public build(rootKey: string, mode: 'major' | 'minor'): SongData {
    const intervals = mode === 'major' 
      ? ScaleWithChordsGenerator.MAJOR_SCALE_INTERVALS 
      : ScaleWithChordsGenerator.MINOR_SCALE_INTERVALS;
    
    const chordProgression = mode === 'major' 
      ? ScaleWithChordsGenerator.MAJOR_CHORD_PROGRESSION 
      : ScaleWithChordsGenerator.MINOR_CHORD_PROGRESSION;

    const notes: StringFretNote[] = [];
    const chords: ChordData[] = [];
    
    const fretBox = ScaleWithChordsGenerator.FRET_BOXES[rootKey] || { startFret: 0, endFret: 4 };
    
    let currentTime = 0;
    const noteDuration = 0.5; // Half beat per note
    const beatsPerMeasure = 4;
    const totalBars = 2;
    const totalBeats = totalBars * beatsPerMeasure; // 8 beats total
    
    // Create a pattern that fills exactly 2 bars (8 beats = 16 half-beat notes)
    const notePattern: number[] = [];
    
    // First bar: ascending scale (7 notes) + octave note (1 note) = 8 notes = 4 beats
    intervals.forEach(interval => {
      notePattern.push(interval);
    });
    notePattern.push(12); // Octave higher
    
    // Second bar: descending scale (7 notes) + root note (1 note) = 8 notes = 4 beats
    for (let i = intervals.length - 1; i >= 0; i--) {
      notePattern.push(intervals[i]);
    }
    notePattern.push(0); // Final root note
    
    // Generate notes from pattern (should be exactly 16 half-beat notes = 8 beats)
    notePattern.forEach((interval) => {
      // Try different octaves to find one that fits in our fret box
      let position: { string: number; fret: number } | null = null;
      
      // Try octaves 3, 4, and 5 to find the best fit
      for (let octave = 3; octave <= 5 && !position; octave++) {
        const adjustedInterval = interval % 12; // Handle octave intervals
        const noteOctave = octave + Math.floor(interval / 12);
        const midiNote = this.getNoteMidi(rootKey, adjustedInterval, noteOctave);
        position = this.findStringFretInBox(midiNote, fretBox);
      }
      
      // If we still can't find a position, use a fallback
      if (!position) {
        const fallbackFret = Math.min(fretBox.endFret, Math.max(fretBox.startFret, (interval % 5)));
        position = { string: 3, fret: fallbackFret };
      }
      
      notes.push({
        string: position.string,
        fret: position.fret,
        time: currentTime,
        duration: noteDuration
      });
      currentTime += noteDuration;
    });
    
    // Generate chord progression for exactly 2 bars
    const chordsForTwoBars = [chordProgression[0], chordProgression[1]]; // I-IV for 2 bars
    chordsForTwoBars.forEach((scaleDegree, index) => {
      const chordName = this.getChordName(rootKey, scaleDegree, mode);
      const measure = index + 1;
      
      chords.push({
        chord: chordName,
        measure,
        time: (measure - 1) * beatsPerMeasure
      });
    });

    return {
      title: `${rootKey} ${mode.charAt(0).toUpperCase() + mode.slice(1)} Scale`,
      artist: 'Generated',
      bpm: 120,
      timeSignature: [4, 4] as [number, number],
      key: rootKey,
      notes,
      chords
    };
  }

  /**
   * Get chord name for a scale degree in a given key and mode
   */
  private getChordName(rootKey: string, scaleDegree: number, mode: 'major' | 'minor'): string {
    const intervals = mode === 'major' 
      ? ScaleWithChordsGenerator.MAJOR_SCALE_INTERVALS 
      : ScaleWithChordsGenerator.MINOR_SCALE_INTERVALS;
    
    const chordRootInterval = intervals[scaleDegree - 1];
    const chordRoot = this.getNoteForInterval(rootKey, chordRootInterval);
    
    if (mode === 'major') {
      // Major scale chord qualities: I, ii, iii, IV, V, vi, vii°
      const chordQualities = ['', 'm', 'm', '', '', 'm', 'dim'];
      return chordRoot + chordQualities[scaleDegree - 1];
    } else {
      // Natural minor scale chord qualities: i, ii°, III, iv, v, VI, VII
      const chordQualities = ['m', 'dim', '', 'm', 'm', '', ''];
      return chordRoot + chordQualities[scaleDegree - 1];
    }
  }

  /**
   * Get note name for a given key and interval
   */
  private getNoteForInterval(rootKey: string, interval: number): string {
    const rootIndex = ScaleWithChordsGenerator.CHROMATIC_NOTES.indexOf(rootKey);
    if (rootIndex === -1) {
      throw new Error(`Invalid root key: ${rootKey}`);
    }
    
    const noteIndex = (rootIndex + interval) % 12;
    return ScaleWithChordsGenerator.CHROMATIC_NOTES[noteIndex];
  }

  /**
   * Mix up the notes in a song while keeping it musically pleasing
   */
  public mixup(songData: SongData): SongData {
    if (!songData.key) {
      console.warn('Song has no key, using C as default');
      songData.key = 'C';
    }

    const isMinor = songData.title.includes('Minor');
    const intervals = isMinor 
      ? ScaleWithChordsGenerator.MINOR_SCALE_INTERVALS 
      : ScaleWithChordsGenerator.MAJOR_SCALE_INTERVALS;
    
    const rootKey = songData.key;
    const fretBox = ScaleWithChordsGenerator.FRET_BOXES[rootKey] || { startFret: 0, endFret: 4 };
    
    const notes: StringFretNote[] = [];
    let currentTime = 0;
    const noteDuration = 0.5;
    const totalBeats = 8; // 2 bars
    
    // Create a pool of intervals for the scale
    const notePool: number[] = [];
    
    // Add scale intervals multiple times for variety
    intervals.forEach(interval => {
      notePool.push(interval);      // Root octave
      notePool.push(interval + 12); // Next octave
    });
    
    // Add some repeated root notes for stability
    notePool.push(0, 0, 0); // Multiple root notes
    
    // Create musical phrases (groups of 2-4 notes)
    const phrases: number[][] = [];
    const shuffledPool = [...notePool].sort(() => Math.random() - 0.5);
    
    // Group notes into musical phrases
    for (let i = 0; i < shuffledPool.length; i += 3) {
      const phrase = shuffledPool.slice(i, i + 3);
      if (phrase.length > 0) {
        phrases.push(phrase);
      }
    }
    
    // Shuffle phrases but keep internal phrase structure
    phrases.sort(() => Math.random() - 0.5);
    
    // Create the note pattern for exactly 2 bars (16 notes)
    const notePattern: number[] = [];
    
    // Start with root note for stability
    notePattern.push(0);
    
    // Fill with phrase-based patterns
    let phraseIndex = 0;
    let noteInPhrase = 0;
    
    while (notePattern.length < 15) { // 15 more notes needed (total 16)
      if (phraseIndex >= phrases.length) {
        phraseIndex = 0; // Wrap around
      }
      
      const currentPhrase = phrases[phraseIndex];
      if (noteInPhrase >= currentPhrase.length) {
        phraseIndex++;
        noteInPhrase = 0;
        continue;
      }
      
      notePattern.push(currentPhrase[noteInPhrase]);
      noteInPhrase++;
      
      // Occasionally add a connecting note for smoother transitions
      if (notePattern.length < 15 && Math.random() < 0.3) {
        // Add a note that's close to the last note for smooth transitions
        const lastInterval = notePattern[notePattern.length - 1];
        const connectingNotes = intervals.filter(interval => 
          Math.abs(interval - (lastInterval % 12)) <= 4
        );
        if (connectingNotes.length > 0) {
          const connectingNote = connectingNotes[Math.floor(Math.random() * connectingNotes.length)];
          notePattern.push(connectingNote);
        }
      }
    }
    
    // End with root note for resolution
    notePattern.push(0);
    
    // Ensure we have exactly 16 notes
    while (notePattern.length < 16) {
      notePattern.push(0);
    }
    if (notePattern.length > 16) {
      notePattern.splice(16);
    }
    
    // Generate notes from the mixed-up pattern
    notePattern.forEach((interval) => {
      // Try different octaves to find one that fits in our fret box
      let position: { string: number; fret: number } | null = null;
      
      // Try octaves 3, 4, and 5 to find the best fit
      for (let octave = 3; octave <= 5 && !position; octave++) {
        const adjustedInterval = interval % 12; // Handle octave intervals
        const noteOctave = octave + Math.floor(interval / 12);
        const midiNote = this.getNoteMidi(rootKey, adjustedInterval, noteOctave);
        position = this.findStringFretInBox(midiNote, fretBox);
      }
      
      // If we still can't find a position, use a fallback
      if (!position) {
        const fallbackFret = Math.min(fretBox.endFret, Math.max(fretBox.startFret, (interval % 5)));
        position = { string: 3, fret: fallbackFret };
      }
      
      notes.push({
        string: position.string,
        fret: position.fret,
        time: currentTime,
        duration: noteDuration
      });
      currentTime += noteDuration;
    });
    
    // Return a new song with mixed-up notes but same metadata and chords
    return {
      ...songData,
      title: songData.title + ' (Mixed)',
      notes,
      // Keep the same chords for harmonic consistency
    };
  }
} 
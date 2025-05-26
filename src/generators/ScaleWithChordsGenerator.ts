import { SongData, PitchNote, ChordData } from '../types/SongTypes';

export class ScaleWithChordsGenerator {
  private static readonly CHROMATIC_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  
  private static readonly MAJOR_SCALE_INTERVALS = [0, 2, 4, 5, 7, 9, 11]; // W-W-H-W-W-W-H
  private static readonly MINOR_SCALE_INTERVALS = [0, 2, 3, 5, 7, 8, 10]; // W-H-W-W-H-W-W
  
  private static readonly MAJOR_CHORD_PROGRESSION = [1, 4, 5, 1]; // I-IV-V-I
  private static readonly MINOR_CHORD_PROGRESSION = [1, 4, 5, 1]; // i-iv-v-i

  /**
   * Get the note name for a given key and interval
   */
  private getNoteForInterval(rootKey: string, interval: number, octave: number = 4): string {
    const rootIndex = ScaleWithChordsGenerator.CHROMATIC_NOTES.indexOf(rootKey);
    if (rootIndex === -1) {
      throw new Error(`Invalid root key: ${rootKey}`);
    }
    
    const noteIndex = (rootIndex + interval) % 12;
    return ScaleWithChordsGenerator.CHROMATIC_NOTES[noteIndex] + octave;
  }

  /**
   * Get chord name for a scale degree in a given key and mode
   */
  private getChordName(rootKey: string, scaleDegree: number, mode: 'major' | 'minor'): string {
    const intervals = mode === 'major' 
      ? ScaleWithChordsGenerator.MAJOR_SCALE_INTERVALS 
      : ScaleWithChordsGenerator.MINOR_SCALE_INTERVALS;
    
    const chordRootInterval = intervals[scaleDegree - 1];
    const chordRoot = this.getNoteForInterval(rootKey, chordRootInterval, 0).replace(/\d+/, '');
    
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
   * Generate a scale pattern with chord progression
   */
  public build(rootKey: string, mode: 'major' | 'minor'): SongData {
    const intervals = mode === 'major' 
      ? ScaleWithChordsGenerator.MAJOR_SCALE_INTERVALS 
      : ScaleWithChordsGenerator.MINOR_SCALE_INTERVALS;
    
    const chordProgression = mode === 'major' 
      ? ScaleWithChordsGenerator.MAJOR_CHORD_PROGRESSION 
      : ScaleWithChordsGenerator.MINOR_CHORD_PROGRESSION;

    const notes: PitchNote[] = [];
    const chords: ChordData[] = [];
    
    let currentTime = 0;
    const noteDuration = 0.5; // Half beat per note
    const beatsPerMeasure = 4;
    const totalBars = 2;
    const totalBeats = totalBars * beatsPerMeasure; // 8 beats total
    const totalDuration = totalBeats; // 8 beats
    
    // Create a pattern that fills exactly 2 bars (8 beats = 16 half-beat notes)
    const notePattern: number[] = [];
    
    // First bar: ascending scale (8 notes = 4 beats)
    intervals.forEach(interval => {
      notePattern.push(interval);
    });
    // Add octave note to complete first bar
    notePattern.push(0 + 12); // Octave higher
    
    // Second bar: descending scale (7 notes = 3.5 beats) + root note (0.5 beat) = 4 beats
    for (let i = intervals.length - 1; i >= 0; i--) {
      notePattern.push(intervals[i]);
    }
    // Add final root note to complete second bar
    notePattern.push(0);
    
    // Generate notes from pattern (should be exactly 16 half-beat notes = 8 beats)
    notePattern.forEach((interval, index) => {
      // Determine octave based on interval
      let octave = 4;
      if (interval >= 12) {
        octave = 5;
        interval = interval - 12;
      }
      
      const note = this.getNoteForInterval(rootKey, interval, octave);
      notes.push({
        note,
        time: currentTime,
        duration: noteDuration
      });
      currentTime += noteDuration;
    });
    
    // If we somehow don't have exactly 8 beats, fill remaining time
    while (currentTime < totalDuration) {
      const rootNote = this.getNoteForInterval(rootKey, 0, 4);
      notes.push({
        note: rootNote,
        time: currentTime,
        duration: noteDuration
      });
      currentTime += noteDuration;
    }
    
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
      tuning: ['E4', 'B3', 'G3', 'D3', 'A2', 'E2'], // Standard guitar tuning
      notes,
      chords
    };
  }
} 
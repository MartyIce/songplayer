import { SongData, StringFretNote, ChordData, Note } from '../types/SongTypes';

interface NoteFinderLoggingConfig {
  attempt: boolean;
  valid: boolean;
  invalid: boolean;
  string: boolean;
  position: boolean;
  scoring: boolean;
  mapping: boolean;
  caching: boolean;
  general: boolean;
}

interface ConditionalLoggingConfig {
  enabled: boolean;
  conditions: {
    startFret?: number;
    endFret?: number;
    fretRange?: [number, number];
    containsString?: number;
    containsStrings?: number[];
    avgFretAbove?: number;
    avgFretBelow?: number;
    positionIndex?: number;
    songTitle?: string;
  };
  enableAllCategories: boolean;
  enabledCategories?: (keyof NoteFinderLoggingConfig)[];
}

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

  // Default fret span for guitar positions
  private static readonly DEFAULT_FRET_SPAN = 4;

  // Position management for consistent navigation
  private cachedPositions: Map<string, StringFretNote[][]> = new Map();
  private currentPositionIndex: Map<string, number> = new Map();

  // Logging configuration - can be controlled via environment variables or direct modification
  private static readonly LOGGING_CONFIG: NoteFinderLoggingConfig = {
    attempt: process.env.REACT_APP_LOG_ATTEMPT === 'true' || false,
    valid: process.env.REACT_APP_LOG_VALID === 'true' || false,
    invalid: process.env.REACT_APP_LOG_INVALID === 'true' || false,
    string: process.env.REACT_APP_LOG_STRING === 'true' || false,
    position: process.env.REACT_APP_LOG_POSITION === 'true' || true, // Keep position logs by default
    scoring: process.env.REACT_APP_LOG_SCORING === 'true' || false,
    mapping: process.env.REACT_APP_LOG_MAPPING === 'true' || false,
    caching: process.env.REACT_APP_LOG_CACHING === 'true' || true, // Keep caching logs by default
    general: process.env.REACT_APP_LOG_GENERAL === 'true' || true, // Keep general logs by default
  };

  // Conditional logging configuration
  private static readonly CONDITIONAL_LOGGING_CONFIG: ConditionalLoggingConfig = {
    enabled: process.env.REACT_APP_CONDITIONAL_LOG_ENABLED === 'true' || false,
    conditions: {
      startFret: process.env.REACT_APP_CONDITIONAL_LOG_START_FRET ? parseInt(process.env.REACT_APP_CONDITIONAL_LOG_START_FRET) : undefined,
      endFret: process.env.REACT_APP_CONDITIONAL_LOG_END_FRET ? parseInt(process.env.REACT_APP_CONDITIONAL_LOG_END_FRET) : undefined,
      fretRange: process.env.REACT_APP_CONDITIONAL_LOG_FRET_RANGE ? 
        JSON.parse(process.env.REACT_APP_CONDITIONAL_LOG_FRET_RANGE) as [number, number] : undefined,
      containsString: process.env.REACT_APP_CONDITIONAL_LOG_CONTAINS_STRING ? 
        parseInt(process.env.REACT_APP_CONDITIONAL_LOG_CONTAINS_STRING) : undefined,
      containsStrings: process.env.REACT_APP_CONDITIONAL_LOG_CONTAINS_STRINGS ? 
        JSON.parse(process.env.REACT_APP_CONDITIONAL_LOG_CONTAINS_STRINGS) as number[] : undefined,
      avgFretAbove: process.env.REACT_APP_CONDITIONAL_LOG_AVG_FRET_ABOVE ? 
        parseFloat(process.env.REACT_APP_CONDITIONAL_LOG_AVG_FRET_ABOVE) : undefined,
      avgFretBelow: process.env.REACT_APP_CONDITIONAL_LOG_AVG_FRET_BELOW ? 
        parseFloat(process.env.REACT_APP_CONDITIONAL_LOG_AVG_FRET_BELOW) : undefined,
      positionIndex: process.env.REACT_APP_CONDITIONAL_LOG_POSITION_INDEX ? 
        parseInt(process.env.REACT_APP_CONDITIONAL_LOG_POSITION_INDEX) : undefined,
      songTitle: process.env.REACT_APP_CONDITIONAL_LOG_SONG_TITLE || undefined,
    },
    enableAllCategories: process.env.REACT_APP_CONDITIONAL_LOG_ENABLE_ALL === 'true' || true,
    enabledCategories: process.env.REACT_APP_CONDITIONAL_LOG_CATEGORIES ? 
      JSON.parse(process.env.REACT_APP_CONDITIONAL_LOG_CATEGORIES) as (keyof NoteFinderLoggingConfig)[] : undefined,
  };

  // Current context for conditional logging
  private static currentLoggingContext: {
    fretBox?: { startFret: number; endFret: number };
    position?: StringFretNote[];
    positionIndex?: number;
    songTitle?: string;
  } = {};

  /**
   * Set the current logging context for conditional logging
   */
  private static setLoggingContext(context: {
    fretBox?: { startFret: number; endFret: number };
    position?: StringFretNote[];
    positionIndex?: number;
    songTitle?: string;
  }): void {
    ScaleWithChordsGenerator.currentLoggingContext = { ...ScaleWithChordsGenerator.currentLoggingContext, ...context };
  }

  /**
   * Check if conditional logging conditions are met
   */
  private static shouldEnableConditionalLogging(): boolean {
    if (!ScaleWithChordsGenerator.CONDITIONAL_LOGGING_CONFIG.enabled) {
      return false;
    }

    const conditions = ScaleWithChordsGenerator.CONDITIONAL_LOGGING_CONFIG.conditions;
    const context = ScaleWithChordsGenerator.currentLoggingContext;

    // Check fret box conditions
    if (context.fretBox) {
      if (conditions.startFret !== undefined && context.fretBox.startFret !== conditions.startFret) {
        return false;
      }
      if (conditions.endFret !== undefined && context.fretBox.endFret !== conditions.endFret) {
        return false;
      }
      if (conditions.fretRange !== undefined) {
        const [minFret, maxFret] = conditions.fretRange;
        if (context.fretBox.startFret < minFret || context.fretBox.endFret > maxFret) {
          return false;
        }
      }
    }

    // Check position conditions
    if (context.position) {
      const strings = context.position.map(note => note.string);
      const frets = context.position.map(note => note.fret);
      const avgFret = frets.reduce((sum, fret) => sum + fret, 0) / frets.length;

      if (conditions.containsString !== undefined && !strings.includes(conditions.containsString)) {
        return false;
      }
      if (conditions.containsStrings !== undefined && 
          !conditions.containsStrings.every(str => strings.includes(str))) {
        return false;
      }
      if (conditions.avgFretAbove !== undefined && avgFret <= conditions.avgFretAbove) {
        return false;
      }
      if (conditions.avgFretBelow !== undefined && avgFret >= conditions.avgFretBelow) {
        return false;
      }
    }

    // Check position index
    if (conditions.positionIndex !== undefined && context.positionIndex !== conditions.positionIndex) {
      return false;
    }

    // Check song title
    if (conditions.songTitle !== undefined && 
        (!context.songTitle || !context.songTitle.includes(conditions.songTitle))) {
      return false;
    }

    return true;
  }

  /**
   * Conditional logging method
   */
  private static log(category: keyof NoteFinderLoggingConfig, message: string): void {
    const conditionalLoggingEnabled = ScaleWithChordsGenerator.shouldEnableConditionalLogging();
    
    let shouldLog = false;

    if (conditionalLoggingEnabled) {
      // Conditional logging is active and conditions are met
      if (ScaleWithChordsGenerator.CONDITIONAL_LOGGING_CONFIG.enableAllCategories) {
        shouldLog = true;
      } else if (ScaleWithChordsGenerator.CONDITIONAL_LOGGING_CONFIG.enabledCategories) {
        shouldLog = ScaleWithChordsGenerator.CONDITIONAL_LOGGING_CONFIG.enabledCategories.includes(category);
      }
    } else {
      // Normal logging rules apply
      shouldLog = ScaleWithChordsGenerator.LOGGING_CONFIG[category];
    }

    if (shouldLog) {
      const prefix = conditionalLoggingEnabled ? '[CONDITIONAL] ' : '';
      console.log(prefix + message);
    }
  }

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

    // Clear cached positions since we're creating new note positions
    const songKey = this.getSongKey(songData);
    this.clearCachedPositions(songKey);

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

  /**
   * Clear cached positions for a specific song
   */
  private clearCachedPositions(songKey: string): void {
    this.cachedPositions.delete(songKey);
    this.currentPositionIndex.delete(songKey);
    ScaleWithChordsGenerator.log('caching', `Cleared cached positions for: ${songKey}`);
  }

  /**
   * Move notes up the neck (higher fret numbers) while maintaining same pitches - legacy method
   */
  public moveUpNeckLegacy(songData: SongData, fretSpan: number = ScaleWithChordsGenerator.DEFAULT_FRET_SPAN): SongData {
    const stringFretNotes = this.filterStringFretNotes(songData.notes);
    const newNotes = this.findAlternativePositions(stringFretNotes, 'up', fretSpan);
    
    return {
      ...songData,
      title: songData.title.replace(' (Mixed)', '').replace(' (Up)', '').replace(' (Down)', '') + ' (Up)',
      notes: newNotes
    };
  }

  /**
   * Move notes down the neck (lower fret numbers) while maintaining same pitches - legacy method
   */
  public moveDownNeckLegacy(songData: SongData, fretSpan: number = ScaleWithChordsGenerator.DEFAULT_FRET_SPAN): SongData {
    const stringFretNotes = this.filterStringFretNotes(songData.notes);
    const newNotes = this.findAlternativePositions(stringFretNotes, 'down', fretSpan);
    
    return {
      ...songData,
      title: songData.title.replace(' (Mixed)', '').replace(' (Up)', '').replace(' (Down)', '') + ' (Down)',
      notes: newNotes
    };
  }

  /**
   * Filter notes to only include StringFretNote types
   */
  private filterStringFretNotes(notes: Note[]): StringFretNote[] {
    return notes.filter((note): note is StringFretNote => 
      'string' in note && 'fret' in note
    );
  }

  /**
   * Find alternative fingering positions for the same notes
   */
  private findAlternativePositions(notes: StringFretNote[], direction: 'up' | 'down', fretSpan: number): StringFretNote[] {
    ScaleWithChordsGenerator.log('general', `\n=== NECK MOVEMENT: ${direction.toUpperCase()} (fretSpan: ${fretSpan}) ===`);
    
    if (notes.length === 0) {
      ScaleWithChordsGenerator.log('general', 'No notes to process');
      return notes;
    }

    // Convert current positions to MIDI notes
    const midiNotes = notes.map(note => {
      const openStringMidi = ScaleWithChordsGenerator.GUITAR_TUNING_MIDI[6 - note.string];
      const midi = openStringMidi + note.fret;
      ScaleWithChordsGenerator.log('mapping', `Note: String ${note.string}, Fret ${note.fret} → MIDI ${midi}`);
      return {
        ...note,
        midi
      };
    });

    // Find current fret range to determine starting search area
    const currentFrets = notes.map(note => note.fret);
    const currentMinFret = Math.min(...currentFrets);
    const currentMaxFret = Math.max(...currentFrets);
    const currentSpan = currentMaxFret - currentMinFret;
    
    ScaleWithChordsGenerator.log('general', `Current position: frets ${currentMinFret}-${currentMaxFret} (span: ${currentSpan})`);

    // Generate diverse potential positions that better utilize all strings
    const potentialPositions = this.generateDiversePositions(notes, fretSpan);
    ScaleWithChordsGenerator.log('general', `Generated ${potentialPositions.length} potential positions: ${JSON.stringify(potentialPositions)}`);
    
    // Filter positions based on direction preference
    const filteredPositions = potentialPositions.filter(pos => {
      if (direction === 'up') {
        // Prefer positions higher up the neck (higher fret numbers)
        return pos.startFret > currentMinFret;
      } else if (direction === 'down') {
        // Prefer positions lower on the neck (lower fret numbers)
        return pos.endFret < currentMaxFret || pos.startFret < currentMinFret;
      } else {
        // For 'any' direction, don't filter - include all positions
        return true;
      }
    });

    ScaleWithChordsGenerator.log('general', `Filtered to ${filteredPositions.length} positions for direction '${direction}': ${JSON.stringify(filteredPositions)}`);

    // Use all positions if filtered list is empty
    const searchPositions = filteredPositions.length > 0 ? filteredPositions : potentialPositions;
    ScaleWithChordsGenerator.log('general', `Searching ${searchPositions.length} positions: ${JSON.stringify(searchPositions)}`);

    // Try each position and find the best fit
    let bestPosition: StringFretNote[] | null = null;
    let bestScore = Infinity;
    let attemptCount = 0;

    for (const fretBox of searchPositions) {
      attemptCount++;
      
      // Set fret box context for conditional logging
      ScaleWithChordsGenerator.setLoggingContext({ fretBox });
      
      ScaleWithChordsGenerator.log('attempt', `\n--- Attempt ${attemptCount}: Testing fret box ${fretBox.startFret}-${fretBox.endFret} ---`);
      
      const positionMappings = this.mapNotesToPosition(midiNotes, fretBox);
      
      if (positionMappings.length > 0) {
        // Use the best mapping (first one, since they're sorted by strategy score)
        const bestMapping = positionMappings[0];
        const { notes: positionNotes, octaveShifts } = bestMapping;
        
        // Set position context for conditional logging
        ScaleWithChordsGenerator.setLoggingContext({ position: positionNotes });
        
        ScaleWithChordsGenerator.log('valid', `✓ Successfully mapped all notes using ${bestMapping.strategy} strategy`);
        
        if (this.validatePosition(positionNotes, fretBox)) {
          ScaleWithChordsGenerator.log('valid', '✓ Position validation passed');
          
          const score = this.scorePosition(positionNotes, direction, currentMinFret, octaveShifts);
          ScaleWithChordsGenerator.log('scoring', `Score: ${score.toFixed(2)} (lower is better)`);
          
          // Log the mapped notes
          positionNotes.forEach((note: StringFretNote, index: number) => {
            const originalNote = notes[index];
            const octaveShift = octaveShifts[index];
            ScaleWithChordsGenerator.log('mapping', `  Note ${index + 1}: ${originalNote.string}:${originalNote.fret} → ${note.string}:${note.fret} (${octaveShift} octave shift)`);
          });
          
          if (score < bestScore) {
            ScaleWithChordsGenerator.log('scoring', `🏆 NEW BEST POSITION! (previous best: ${bestScore.toFixed(2)})`);
            bestScore = score;
            bestPosition = positionNotes;
          } else {
            ScaleWithChordsGenerator.log('scoring', `Not better than current best (${bestScore.toFixed(2)})`);
          }
        } else {
          ScaleWithChordsGenerator.log('invalid', '✗ Position validation failed');
        }
      } else {
        ScaleWithChordsGenerator.log('invalid', '✗ Failed to map notes to this position');
      }
    }

    // Return the best position found, or original notes if none found
    if (bestPosition) {
      ScaleWithChordsGenerator.log('general', `\n🎯 FINAL RESULT: Found better position with score ${bestScore.toFixed(2)}`);
      ScaleWithChordsGenerator.log('mapping', 'Original → New mapping:');
      bestPosition.forEach((note, index) => {
        const originalNote = notes[index];
        ScaleWithChordsGenerator.log('mapping', `  ${originalNote.string}:${originalNote.fret} → ${note.string}:${note.fret}`);
      });
      return bestPosition;
    } else {
      ScaleWithChordsGenerator.log('general', '\n❌ No better position found, keeping original');
      return notes;
    }
  }

  /**
   * Generate diverse positions that better utilize all strings, including higher strings
   */
  private generateDiversePositions(notes: StringFretNote[], fretSpan: number): Array<{ startFret: number; endFret: number }> {
    const positions: Array<{ startFret: number; endFret: number }> = [];
    const maxFret = 15;
    
    // Convert notes to MIDI for analysis
    const midiNotes = notes.map(note => {
      const openStringMidi = ScaleWithChordsGenerator.GUITAR_TUNING_MIDI[6 - note.string];
      return openStringMidi + note.fret;
    });
    
    const minMidi = Math.min(...midiNotes);
    const maxMidi = Math.max(...midiNotes);
    const midiRange = maxMidi - minMidi;
    
    // Strategy 1: Traditional fret box positions (respecting fretSpan)
    for (let startFret = 0; startFret <= maxFret - fretSpan; startFret++) {
      positions.push({
        startFret,
        endFret: startFret + fretSpan
      });
    }
    
    // Strategy 2: Higher string focused positions (still respecting fretSpan)
    // Generate positions that encourage higher string usage but stay within span limit
    for (let baseFret = 0; baseFret <= maxFret - fretSpan; baseFret += 2) {
      positions.push({
        startFret: baseFret,
        endFret: baseFret + fretSpan
      });
    }
    
    // Strategy 3: Slightly wider spans (but only if fretSpan allows it)
    // Only add these if the user has set a reasonable fret span (6 or more)
    if (fretSpan >= 6) {
      const widerSpan = Math.min(fretSpan + 1, 8); // Max 8 fret span even for wider positions
      for (let startFret = 0; startFret <= maxFret - widerSpan; startFret += 3) {
        positions.push({
          startFret,
          endFret: startFret + widerSpan
        });
      }
    }
    
    // Strategy 4: High fret positions (for higher string usage)
    // Generate positions in higher fret areas that still respect the span
    for (let startFret = 5; startFret <= maxFret - fretSpan; startFret += 2) {
      positions.push({
        startFret,
        endFret: startFret + fretSpan
      });
    }
    
    // Strategy 5: Mid-neck positions
    for (let startFret = 3; startFret <= 9 && startFret + fretSpan <= maxFret; startFret += 2) {
      positions.push({
        startFret,
        endFret: startFret + fretSpan
      });
    }
    
    // Remove duplicates and sort by start fret
    const uniquePositions = positions.filter((pos, index, arr) => 
      arr.findIndex(p => p.startFret === pos.startFret && p.endFret === pos.endFret) === index
    );
    
    uniquePositions.sort((a, b) => a.startFret - b.startFret);
    
    ScaleWithChordsGenerator.log('general', `Generated ${uniquePositions.length} diverse positions (respecting fretSpan: ${fretSpan})`);
    
    return uniquePositions;
  }

  /**
   * Map MIDI notes to specific fret box position, trying octave variations if needed.
   * Returns ALL possible mappings for this fret box, sorted by preference.
   * Ensures musical integrity by applying octave shifts consistently to ALL notes.
   */
  private mapNotesToPosition(
    midiNotes: Array<StringFretNote & { midi: number }>, 
    fretBox: { startFret: number; endFret: number }
  ): Array<{ notes: StringFretNote[]; octaveShifts: number[]; strategy: string; score: number }> {
    ScaleWithChordsGenerator.log('mapping', `    Mapping ${midiNotes.length} notes to fret box ${fretBox.startFret}-${fretBox.endFret}:`);
    
    const allMappings: Array<{ notes: StringFretNote[]; octaveShifts: number[]; strategy: string; score: number }> = [];

    // Strategy 1: Try to map all notes without any octave shifts (preferred)
    ScaleWithChordsGenerator.log('mapping', `      Strategy 1: Trying original octaves (no shifts)...`);
    const originalResult = this.tryMapAllNotesWithOctaveShift(midiNotes, fretBox, 0);
    if (originalResult) {
      const strategyScore = this.calculateStrategyScore(originalResult.octaveShifts, 'original');
      allMappings.push({
        ...originalResult,
        strategy: 'original',
        score: strategyScore
      });
      ScaleWithChordsGenerator.log('mapping', `      ✓ SUCCESS: Original octaves (score: ${strategyScore.toFixed(2)})`);
    } else {
      ScaleWithChordsGenerator.log('mapping', `      ✗ Failed to map all notes without octave shifts`);
    }

    // Strategy 2: Try systematic octave shifts applied to ALL notes
    // Prioritize higher octaves first to encourage higher string usage
    const octaveOffsets = [12, -12, 24, -24, 36, -36];
    
    for (const octaveOffset of octaveOffsets) {
      const octaveShift = octaveOffset / 12;
      const octaveLabel = octaveOffset > 0 ? `+${octaveShift} octave${Math.abs(octaveShift) > 1 ? 's' : ''}` :
                         `${octaveShift} octave${Math.abs(octaveShift) > 1 ? 's' : ''}`;
      
      ScaleWithChordsGenerator.log('mapping', `      Strategy 2: Trying ${octaveLabel} shift for ALL notes...`);
      
      const result = this.tryMapAllNotesWithOctaveShift(midiNotes, fretBox, octaveOffset);
      if (result) {
        const strategyScore = this.calculateStrategyScore(result.octaveShifts, 'consistent');
        allMappings.push({
          ...result,
          strategy: `consistent_${octaveLabel}`,
          score: strategyScore
        });
        ScaleWithChordsGenerator.log('mapping', `      ✓ SUCCESS: Consistent ${octaveLabel} shift (score: ${strategyScore.toFixed(2)})`);
      } else {
        ScaleWithChordsGenerator.log('mapping', `      ✗ Failed with ${octaveLabel} shift`);
      }
    }

    // Strategy 3: As a last resort, try mixed octave shifts but prefer minimal and consistent shifts
    ScaleWithChordsGenerator.log('mapping', `      Strategy 3: Trying mixed octave shifts (last resort)...`);
    const mixedResult = this.tryMapNotesWithMixedOctaveShifts(midiNotes, fretBox);
    if (mixedResult) {
      const strategyScore = this.calculateStrategyScore(mixedResult.octaveShifts, 'mixed');
      allMappings.push({
        ...mixedResult,
        strategy: 'mixed',
        score: strategyScore
      });
      ScaleWithChordsGenerator.log('mapping', `      ✓ SUCCESS: Mixed octave shifts (score: ${strategyScore.toFixed(2)})`);
    } else {
      ScaleWithChordsGenerator.log('mapping', `      ✗ Failed with mixed octave shifts`);
    }

    // Sort by strategy score (lower is better)
    allMappings.sort((a, b) => a.score - b.score);
    
    if (allMappings.length > 0) {
      ScaleWithChordsGenerator.log('mapping', `    ✓ Found ${allMappings.length} valid mapping(s) for this fret box`);
      allMappings.forEach((mapping, index) => {
        ScaleWithChordsGenerator.log('mapping', `      ${index + 1}. ${mapping.strategy} (score: ${mapping.score.toFixed(2)})`);
      });
    } else {
      ScaleWithChordsGenerator.log('invalid', `    ✗ FAILED: Could not map all notes to this fret box with any octave combination`);
    }
    
    return allMappings;
  }

  /**
   * Calculate a strategy-specific score for octave shift approaches
   */
  private calculateStrategyScore(octaveShifts: number[], strategy: string): number {
    const totalShifts = octaveShifts.reduce((sum, shift) => sum + shift, 0);
    const uniqueShifts = new Set(octaveShifts);
    const shiftVariety = uniqueShifts.size;
    
    let score = 0;
    
    // Base scoring by strategy type
    switch (strategy) {
      case 'original':
        score = 0; // Best possible - no octave shifts
        break;
      case 'consistent':
        score = 10 + (totalShifts * 2); // Good - consistent shifts
        break;
      case 'mixed':
        score = 50 + (totalShifts * 5) + (shiftVariety * 15); // Poor - mixed shifts
        break;
    }
    
    return score;
  }

  /**
   * Try to map all notes with a consistent octave shift applied to ALL notes
   */
  private tryMapAllNotesWithOctaveShift(
    midiNotes: Array<StringFretNote & { midi: number }>, 
    fretBox: { startFret: number; endFret: number },
    octaveOffset: number
  ): { notes: StringFretNote[]; octaveShifts: number[] } | null {
    const mappedNotes: StringFretNote[] = [];
    const octaveShift = Math.abs(octaveOffset) / 12;
    
    for (const note of midiNotes) {
      const shiftedMidi = note.midi + octaveOffset;
      ScaleWithChordsGenerator.log('mapping', `        Note MIDI ${note.midi} → ${shiftedMidi} (${octaveShift} octave shift)`);
      
      const position = this.findBestStringFretForMidi(shiftedMidi, fretBox);
      if (!position) {
        ScaleWithChordsGenerator.log('mapping', `        ✗ Failed to map MIDI ${shiftedMidi}`);
        return null; // If any note fails, this octave shift doesn't work
      }
      
      ScaleWithChordsGenerator.log('mapping', `        ✓ MIDI ${shiftedMidi} → String ${position.string}, Fret ${position.fret}`);
      mappedNotes.push({
        ...note,
        string: position.string,
        fret: position.fret
      });
    }

    // All notes successfully mapped with consistent octave shift
    const octaveShifts = new Array(midiNotes.length).fill(octaveShift);
    return { notes: mappedNotes, octaveShifts };
  }

  /**
   * Try to map notes with mixed octave shifts as a last resort.
   * Still tries to minimize and prefer consistent shifts where possible.
   */
  private tryMapNotesWithMixedOctaveShifts(
    midiNotes: Array<StringFretNote & { midi: number }>, 
    fretBox: { startFret: number; endFret: number }
  ): { notes: StringFretNote[]; octaveShifts: number[] } | null {
    const mappedNotes: StringFretNote[] = [];
    const octaveShifts: number[] = [];
    
    ScaleWithChordsGenerator.log('mapping', `        Attempting mixed octave shifts (preserving musical relationships where possible)...`);

    for (const note of midiNotes) {
      ScaleWithChordsGenerator.log('mapping', `        Finding position for MIDI ${note.midi}...`);
      const position = this.findBestStringFretForMidiWithOctaves(note.midi, fretBox);
      
      if (!position) {
        ScaleWithChordsGenerator.log('invalid', `        ✗ No valid position found for MIDI ${note.midi} (including octave variations)`);
        return null; // Can't map this note to this position
      }
      
      const octaveShift = Math.abs(position.actualMidi - note.midi) / 12;
      octaveShifts.push(octaveShift);
      
      ScaleWithChordsGenerator.log('mapping', `        ✓ MIDI ${note.midi} → String ${position.string}, Fret ${position.fret} (using MIDI ${position.actualMidi}, ${octaveShift} octave shift)`);
      mappedNotes.push({
        ...note,
        string: position.string,
        fret: position.fret
      });
    }

    // Check if the mixed shifts are reasonable (prefer positions with fewer mixed shifts)
    const uniqueShifts = new Set(octaveShifts);
    const shiftVariety = uniqueShifts.size;
    
    ScaleWithChordsGenerator.log('mapping', `        Mixed shifts result: ${shiftVariety} different octave shifts used`);
    if (shiftVariety > 2) {
      ScaleWithChordsGenerator.log('mapping', `        ⚠️  Warning: High octave shift variety (${shiftVariety}) may affect musical integrity`);
    }

    return { notes: mappedNotes, octaveShifts };
  }

  /**
   * Validate that a position fits within the fret box constraints
   */
  private validatePosition(
    notes: StringFretNote[], 
    fretBox: { startFret: number; endFret: number }
  ): boolean {
    const frets = notes.map(note => note.fret);
    const minFret = Math.min(...frets);
    const maxFret = Math.max(...frets);
    
    return minFret >= fretBox.startFret && maxFret <= fretBox.endFret;
  }

  /**
   * Score a position based on direction preference and playability
   */
  private scorePosition(
    notes: StringFretNote[], 
    direction: 'up' | 'down' | 'any', 
    currentMinFret: number,
    octaveShifts: number[]
  ): number {
    const frets = notes.map(note => note.fret);
    const strings = notes.map(note => note.string);
    const avgFret = frets.reduce((sum, fret) => sum + fret, 0) / frets.length;
    const avgString = strings.reduce((sum, string) => sum + string, 0) / strings.length;
    
    let score = 0;
    ScaleWithChordsGenerator.log('scoring', `      Scoring position: avgFret=${avgFret.toFixed(2)}, avgString=${avgString.toFixed(2)}, currentMinFret=${currentMinFret}, direction=${direction}`);
    
    // Direction preference
    if (direction === 'up') {
      // Prefer higher fret positions
      const directionScore = Math.max(0, currentMinFret - avgFret) * 10;
      ScaleWithChordsGenerator.log('scoring', `        Direction (up) score: ${directionScore.toFixed(2)} (prefer higher frets)`);
      score += directionScore;
    } else if (direction === 'down') {
      // Prefer lower fret positions
      const directionScore = Math.max(0, avgFret - currentMinFret) * 10;
      ScaleWithChordsGenerator.log('scoring', `        Direction (down) score: ${directionScore.toFixed(2)} (prefer lower frets)`);
      score += directionScore;
    } else {
      // For 'any' direction, no directional preference
      ScaleWithChordsGenerator.log('scoring', `        Direction (any) score: 0 (no directional preference)`);
    }
    
    // Playability factors - moderate preference for lower frets, but not too strong
    const playabilityScore = avgFret * 0.5; // Reduced weight to allow higher fret positions
    ScaleWithChordsGenerator.log('scoring', `        Playability score: ${playabilityScore.toFixed(2)} (moderate preference for lower frets)`);
    score += playabilityScore;
    
    // String distribution preference (avoid clustering on one string)
    const uniqueStrings = new Set(strings).size;
    const distributionScore = (6 - uniqueStrings) * 3; // Reduced penalty to allow more creative fingerings
    ScaleWithChordsGenerator.log('scoring', `        String distribution score: ${distributionScore.toFixed(2)} (${uniqueStrings} unique strings)`);
    score += distributionScore;
    
    // String variety bonus - reward positions that use different string combinations
    const stringVarietyBonus = uniqueStrings * -2; // Bonus for using more strings
    ScaleWithChordsGenerator.log('scoring', `        String variety bonus: ${stringVarietyBonus.toFixed(2)} (reward for string diversity)`);
    score += stringVarietyBonus;
    
    // Higher string utilization bonus - reward positions that use strings 1-3
    const highStringCount = strings.filter(s => s <= 3).length;
    const highStringBonus = highStringCount * -1; // Small bonus for using higher strings
    ScaleWithChordsGenerator.log('scoring', `        High string bonus: ${highStringBonus.toFixed(2)} (${highStringCount} notes on strings 1-3)`);
    score += highStringBonus;
    
    // Very high string utilization bonus - strong reward for using strings 1-2
    const veryHighStringCount = strings.filter(s => s <= 2).length;
    const veryHighStringBonus = veryHighStringCount * -4; // Strong bonus for strings 1-2
    ScaleWithChordsGenerator.log('scoring', `        Very high string bonus: ${veryHighStringBonus.toFixed(2)} (${veryHighStringCount} notes on strings 1-2)`);
    score += veryHighStringBonus;
    
    // String 1 (high E) super bonus
    const string1Count = strings.filter(s => s === 1).length;
    const string1Bonus = string1Count * -3; // Super bonus for high E string
    ScaleWithChordsGenerator.log('scoring', `        String 1 super bonus: ${string1Bonus.toFixed(2)} (${string1Count} notes on string 1)`);
    score += string1Bonus;
    
    // Fret span consideration - moderate penalty for very wide spans, but allow reasonable stretches
    const fretSpan = Math.max(...frets) - Math.min(...frets);
    const spanPenalty = Math.max(0, fretSpan - 5) * 1; // Only penalize spans wider than 5 frets
    ScaleWithChordsGenerator.log('scoring', `        Fret span penalty: ${spanPenalty.toFixed(2)} (span: ${fretSpan} frets)`);
    score += spanPenalty;
    
    // Octave shift preference - reward consistent shifts, penalize mixed shifts
    const totalOctaveShifts = octaveShifts.reduce((sum, shift) => sum + shift, 0);
    const uniqueOctaveShifts = new Set(octaveShifts);
    const octaveShiftVariety = uniqueOctaveShifts.size;
    
    // Base penalty for any octave shifts (prefer original octaves when possible)
    const baseOctaveShiftPenalty = totalOctaveShifts * 2;
    
    // Strong penalty for mixed octave shifts (breaks musical integrity)
    const mixedOctaveShiftPenalty = octaveShiftVariety > 1 ? (octaveShiftVariety - 1) * 15 : 0;
    
    // Bonus for consistent octave shifts (all notes shifted by same amount)
    const consistentOctaveBonus = octaveShiftVariety === 1 && totalOctaveShifts > 0 ? -3 : 0;
    
    const octaveShiftScore = baseOctaveShiftPenalty + mixedOctaveShiftPenalty + consistentOctaveBonus;
    
    ScaleWithChordsGenerator.log('scoring', `        Octave shift analysis: total=${totalOctaveShifts.toFixed(1)}, variety=${octaveShiftVariety}, shifts=[${octaveShifts.join(', ')}]`);
    ScaleWithChordsGenerator.log('scoring', `        Octave shift score: ${octaveShiftScore.toFixed(2)} (base penalty: ${baseOctaveShiftPenalty.toFixed(2)}, mixed penalty: ${mixedOctaveShiftPenalty.toFixed(2)}, consistent bonus: ${consistentOctaveBonus.toFixed(2)})`);
    score += octaveShiftScore;
    
    // Position uniqueness bonus - reward positions that are significantly different
    const positionUniqueness = this.calculatePositionUniqueness(notes);
    const uniquenessBonus = positionUniqueness * -2; // Bonus for unique positions
    ScaleWithChordsGenerator.log('scoring', `        Uniqueness bonus: ${uniquenessBonus.toFixed(2)} (position uniqueness)`);
    score += uniquenessBonus;
    
    ScaleWithChordsGenerator.log('scoring', `        Total score: ${score.toFixed(2)}`);
    return score;
  }

  /**
   * Calculate how unique a position is based on string and fret usage patterns
   */
  private calculatePositionUniqueness(notes: StringFretNote[]): number {
    const strings = notes.map(note => note.string);
    const frets = notes.map(note => note.fret);
    
    // Uniqueness factors:
    // 1. String spread (using strings far apart)
    const stringSpread = Math.max(...strings) - Math.min(...strings);
    
    // 2. Fret pattern variety (not all notes on same fret)
    const uniqueFrets = new Set(frets).size;
    
    // 3. High string usage (using strings 1-2)
    const veryHighStringUsage = strings.filter(s => s <= 2).length;
    
    // 4. Mixed position usage (combination of low and high frets)
    const lowFrets = frets.filter(f => f <= 3).length;
    const highFrets = frets.filter(f => f >= 7).length;
    const mixedUsage = Math.min(lowFrets, highFrets);
    
    const uniqueness = stringSpread + uniqueFrets + veryHighStringUsage + mixedUsage;
    
    return uniqueness;
  }

  /**
   * Move notes up the neck (higher fret numbers) while maintaining same pitches - returns all possible positions
   */
  public moveUpNeckAllPositions(songData: SongData, fretSpan: number = ScaleWithChordsGenerator.DEFAULT_FRET_SPAN): SongData[] {
    const stringFretNotes = this.filterStringFretNotes(songData.notes);
    const allPositions = this.findAllAlternativePositions(stringFretNotes, 'up', fretSpan);
    
    return allPositions.map((notes, index) => ({
      ...songData,
      title: songData.title.replace(' (Mixed)', '').replace(' (Up)', '').replace(' (Down)', '') + ` (Up ${index + 1})`,
      notes
    }));
  }

  /**
   * Move notes down the neck (lower fret numbers) while maintaining same pitches - returns all possible positions
   */
  public moveDownNeckAllPositions(songData: SongData, fretSpan: number = ScaleWithChordsGenerator.DEFAULT_FRET_SPAN): SongData[] {
    const stringFretNotes = this.filterStringFretNotes(songData.notes);
    const allPositions = this.findAllAlternativePositions(stringFretNotes, 'down', fretSpan);
    
    return allPositions.map((notes, index) => ({
      ...songData,
      title: songData.title.replace(' (Mixed)', '').replace(' (Up)', '').replace(' (Down)', '') + ` (Down ${index + 1})`,
      notes
    }));
  }

  /**
   * Get all possible alternative positions for the same notes
   */
  public getAllAlternativePositions(songData: SongData, fretSpan: number = ScaleWithChordsGenerator.DEFAULT_FRET_SPAN): SongData[] {
    const stringFretNotes = this.filterStringFretNotes(songData.notes);
    const allPositions = this.findAllAlternativePositions(stringFretNotes, 'any', fretSpan);
    
    return allPositions.map((notes, index) => ({
      ...songData,
      title: songData.title.replace(' (Mixed)', '').replace(' (Up)', '').replace(' (Down)', '') + ` (Alt ${index + 1})`,
      notes
    }));
  }

  /**
   * Find all alternative fingering positions for the same notes
   */
  private findAllAlternativePositions(notes: StringFretNote[], direction: 'up' | 'down' | 'any', fretSpan: number): StringFretNote[][] {
    ScaleWithChordsGenerator.log('general', `\n=== FINDING ALL POSITIONS: ${direction.toUpperCase()} (fretSpan: ${fretSpan}) ===`);
    
    if (notes.length === 0) {
      ScaleWithChordsGenerator.log('general', 'No notes to process');
      return [];
    }

    // Convert current positions to MIDI notes
    const midiNotes = notes.map(note => {
      const openStringMidi = ScaleWithChordsGenerator.GUITAR_TUNING_MIDI[6 - note.string];
      const midi = openStringMidi + note.fret;
      ScaleWithChordsGenerator.log('mapping', `Note: String ${note.string}, Fret ${note.fret} → MIDI ${midi}`);
      return {
        ...note,
        midi
      };
    });

    // Find current fret range to determine starting search area
    const currentFrets = notes.map(note => note.fret);
    const currentMinFret = Math.min(...currentFrets);
    const currentMaxFret = Math.max(...currentFrets);
    const currentSpan = currentMaxFret - currentMinFret;
    
    ScaleWithChordsGenerator.log('general', `Current position: frets ${currentMinFret}-${currentMaxFret} (span: ${currentSpan})`);

    // Generate diverse potential positions that better utilize all strings
    const potentialPositions = this.generateDiversePositions(notes, fretSpan);
    ScaleWithChordsGenerator.log('general', `Generated ${potentialPositions.length} potential positions: ${JSON.stringify(potentialPositions)}`);
    
    // Filter positions based on direction preference
    const filteredPositions = potentialPositions.filter(pos => {
      if (direction === 'up') {
        // Prefer positions higher up the neck (higher fret numbers)
        return pos.startFret > currentMinFret;
      } else if (direction === 'down') {
        // Prefer positions lower on the neck (lower fret numbers)
        return pos.endFret < currentMaxFret || pos.startFret < currentMinFret;
      } else {
        // For 'any' direction, don't filter - include all positions
        return true;
      }
    });

    ScaleWithChordsGenerator.log('general', `Filtered to ${filteredPositions.length} positions for direction '${direction}': ${JSON.stringify(filteredPositions)}`);

    // Use all positions if filtered list is empty
    const searchPositions = filteredPositions.length > 0 ? filteredPositions : potentialPositions;
    ScaleWithChordsGenerator.log('general', `Searching ${searchPositions.length} positions: ${JSON.stringify(searchPositions)}`);

    // Try each position and collect all valid ones
    const validPositions: Array<{ notes: StringFretNote[]; score: number; octaveShifts: number[]; fretBox: { startFret: number; endFret: number }; strategy: string }> = [];
    let attemptCount = 0;

    for (const fretBox of searchPositions) {
      attemptCount++;
      
      // Set fret box context for conditional logging
      ScaleWithChordsGenerator.setLoggingContext({ fretBox });
      
      ScaleWithChordsGenerator.log('attempt', `\n--- Attempt ${attemptCount}: Testing fret box ${fretBox.startFret}-${fretBox.endFret} ---`);
      
      const positionMappings = this.mapNotesToPosition(midiNotes, fretBox);
      
      if (positionMappings.length > 0) {
        // Use the best mapping (first one, since they're sorted by strategy score)
        const bestMapping = positionMappings[0];
        const { notes: positionNotes, octaveShifts } = bestMapping;
        
        // Set position context for conditional logging
        ScaleWithChordsGenerator.setLoggingContext({ position: positionNotes });
        
        ScaleWithChordsGenerator.log('valid', `✓ Successfully mapped all notes using ${bestMapping.strategy} strategy`);
        
        if (this.validatePosition(positionNotes, fretBox)) {
          ScaleWithChordsGenerator.log('valid', '✓ Position validation passed');
          
          const score = this.scorePosition(positionNotes, direction, currentMinFret, octaveShifts);
          ScaleWithChordsGenerator.log('scoring', `Score: ${score.toFixed(2)} (lower is better)`);
          
          // Log the mapped notes
          positionNotes.forEach((note: StringFretNote, index: number) => {
            const originalNote = notes[index];
            const octaveShift = octaveShifts[index];
            ScaleWithChordsGenerator.log('mapping', `  Note ${index + 1}: ${originalNote.string}:${originalNote.fret} → ${note.string}:${note.fret} (${octaveShift} octave shift)`);
          });
          
          // Add this valid position to our collection
          validPositions.push({
            notes: positionNotes,
            score,
            octaveShifts,
            fretBox,
            strategy: bestMapping.strategy
          });
        } else {
          ScaleWithChordsGenerator.log('invalid', '✗ Position validation failed');
        }
      } else {
        ScaleWithChordsGenerator.log('invalid', '✗ Failed to map notes to this position');
      }
    }

    // Sort by score (lower is better) and return just the notes
    validPositions.sort((a, b) => a.score - b.score);
    
    ScaleWithChordsGenerator.log('general', `\n🎯 FINAL RESULT: Found ${validPositions.length} valid positions`);
    validPositions.forEach((position, index) => {
      ScaleWithChordsGenerator.log('scoring', `Position ${index + 1}: Score ${position.score.toFixed(2)}, Octave shifts: ${position.octaveShifts.reduce((sum, shift) => sum + shift, 0)}`);
    });
    
    return validPositions.map(position => position.notes);
  }

  /**
   * Calculate and cache all possible positions for a song
   */
  public calculateAllPositions(songData: SongData, fretSpan: number = ScaleWithChordsGenerator.DEFAULT_FRET_SPAN): void {
    const songKey = this.getSongKey(songData);
    
    // Set logging context for conditional logging
    ScaleWithChordsGenerator.setLoggingContext({ songTitle: songData.title });
    
    // Check if positions are already cached for this song
    if (this.cachedPositions.has(songKey)) {
      ScaleWithChordsGenerator.log('caching', `Positions already cached for: ${songData.title}`);
      return;
    }
    
    const stringFretNotes = this.filterStringFretNotes(songData.notes);
    
    ScaleWithChordsGenerator.log('general', `\n=== CALCULATING ALL POSITIONS FOR: ${songData.title} ===`);
    
    // Find all valid positions
    const allPositions = this.findAllAlternativePositions(stringFretNotes, 'any', fretSpan);
    
    // Eliminate duplicate positions
    const uniquePositions = this.eliminateDuplicatePositions(allPositions);
    ScaleWithChordsGenerator.log('general', `Eliminated ${allPositions.length - uniquePositions.length} duplicate positions`);
    
    // Prioritize positions with diverse string usage
    const diversePositions = this.prioritizeDiverseStringUsage(uniquePositions);
    ScaleWithChordsGenerator.log('general', `Selected ${diversePositions.length} positions with diverse string usage`);
    
    // Sort positions by average fret number (lower frets first)
    diversePositions.sort((a, b) => {
      const avgA = a.reduce((sum, note) => sum + note.fret, 0) / a.length;
      const avgB = b.reduce((sum, note) => sum + note.fret, 0) / b.length;
      return avgA - avgB;
    });
    
    // Cache the positions
    this.cachedPositions.set(songKey, diversePositions);
    this.currentPositionIndex.set(songKey, 0); // Start at the first (lowest) position
    
    ScaleWithChordsGenerator.log('caching', `Cached ${diversePositions.length} unique positions for ${songData.title}`);
    diversePositions.forEach((position, index) => {
      // Set position index context for conditional logging
      ScaleWithChordsGenerator.setLoggingContext({ position, positionIndex: index });
      
      const avgFret = position.reduce((sum, note) => sum + note.fret, 0) / position.length;
      const fretRange = `${Math.min(...position.map(n => n.fret))}-${Math.max(...position.map(n => n.fret))}`;
      const strings = position.map(n => n.string);
      const stringUsage = strings.reduce((acc, str) => {
        acc[str] = (acc[str] || 0) + 1;
        return acc;
      }, {} as Record<number, number>);
      const stringUsageStr = Object.entries(stringUsage)
        .sort(([a], [b]) => parseInt(a) - parseInt(b))
        .map(([str, count]) => `S${str}:${count}`)
        .join(' ');
      ScaleWithChordsGenerator.log('caching', `  Position ${index + 1}: Avg fret ${avgFret.toFixed(1)}, Range ${fretRange}, Strings: ${stringUsageStr}`);
    });
  }

  /**
   * Get the current position for a song
   */
  public getCurrentPosition(songData: SongData): SongData {
    const songKey = this.getSongKey(songData);
    const positions = this.cachedPositions.get(songKey);
    const currentIndex = this.currentPositionIndex.get(songKey) || 0;
    
    if (!positions || positions.length === 0) {
      ScaleWithChordsGenerator.log('general', 'No cached positions found, calculating...');
      this.calculateAllPositions(songData);
      return this.getCurrentPosition(songData);
    }
    
    const currentNotes = positions[currentIndex];
    const totalPositions = positions.length;
    
    return {
      ...songData,
      title: this.getCleanTitle(songData.title) + ` (Pos ${currentIndex + 1}/${totalPositions})`,
      notes: currentNotes
    };
  }

  /**
   * Move to the next higher position (up the neck)
   */
  public moveUpNeck(songData: SongData): SongData {
    const songKey = this.getSongKey(songData);
    const positions = this.cachedPositions.get(songKey);
    
    if (!positions || positions.length === 0) {
      ScaleWithChordsGenerator.log('general', 'No cached positions found, calculating...');
      this.calculateAllPositions(songData);
      return this.moveUpNeck(songData);
    }
    
    const currentIndex = this.currentPositionIndex.get(songKey) || 0;
    const newIndex = Math.min(currentIndex + 1, positions.length - 1);
    
    this.currentPositionIndex.set(songKey, newIndex);
    
    ScaleWithChordsGenerator.log('general', `Moving up: ${currentIndex + 1} → ${newIndex + 1} (of ${positions.length})`);
    
    return this.getCurrentPosition(songData);
  }

  /**
   * Move to the next lower position (down the neck)
   */
  public moveDownNeck(songData: SongData): SongData {
    const songKey = this.getSongKey(songData);
    const positions = this.cachedPositions.get(songKey);
    
    if (!positions || positions.length === 0) {
      ScaleWithChordsGenerator.log('general', 'No cached positions found, calculating...');
      this.calculateAllPositions(songData);
      return this.moveDownNeck(songData);
    }
    
    const currentIndex = this.currentPositionIndex.get(songKey) || 0;
    const newIndex = Math.max(currentIndex - 1, 0);
    
    this.currentPositionIndex.set(songKey, newIndex);
    
    ScaleWithChordsGenerator.log('general', `Moving down: ${currentIndex + 1} → ${newIndex + 1} (of ${positions.length})`);
    
    return this.getCurrentPosition(songData);
  }

  /**
   * Get the number of available positions for a song
   */
  public getPositionCount(songData: SongData): number {
    const songKey = this.getSongKey(songData);
    const positions = this.cachedPositions.get(songKey);
    return positions ? positions.length : 0;
  }

  /**
   * Get the current position index (1-based)
   */
  public getCurrentPositionIndex(songData: SongData): number {
    const songKey = this.getSongKey(songData);
    const currentIndex = this.currentPositionIndex.get(songKey) || 0;
    return currentIndex + 1; // Return 1-based index
  }

  /**
   * Jump to a specific position (1-based index)
   */
  public jumpToPosition(songData: SongData, positionIndex: number): SongData {
    const songKey = this.getSongKey(songData);
    const positions = this.cachedPositions.get(songKey);
    
    if (!positions || positions.length === 0) {
      ScaleWithChordsGenerator.log('general', 'No cached positions found, calculating...');
      this.calculateAllPositions(songData);
      return this.jumpToPosition(songData, positionIndex);
    }
    
    const zeroBasedIndex = Math.max(0, Math.min(positionIndex - 1, positions.length - 1));
    this.currentPositionIndex.set(songKey, zeroBasedIndex);
    
    ScaleWithChordsGenerator.log('general', `Jumping to position ${zeroBasedIndex + 1} (of ${positions.length})`);
    
    return this.getCurrentPosition(songData);
  }

  /**
   * Generate a unique key for a song based on its original notes (before position changes)
   */
  private getSongKey(songData: SongData): string {
    // Use the clean title (without position indicators) as the base
    const cleanTitle = this.getCleanTitle(songData.title);
    
    // For generated songs, we can use just the clean title since they have unique names
    // For file-based songs, we might need more specificity, but the clean title should be sufficient
    return cleanTitle;
  }

  /**
   * Generate a unique key for the original song content (used for initial caching)
   */
  private getOriginalSongKey(songData: SongData): string {
    const cleanTitle = this.getCleanTitle(songData.title);
    const stringFretNotes = this.filterStringFretNotes(songData.notes);
    const noteSignature = stringFretNotes
      .map(note => `${note.string}:${note.fret}`)
      .join(',');
    return `${cleanTitle}_${noteSignature}`;
  }

  /**
   * Eliminate duplicate positions from a list of positions
   */
  private eliminateDuplicatePositions(positions: StringFretNote[][]): StringFretNote[][] {
    const uniquePositions: StringFretNote[][] = [];
    const seenPositions = new Set<string>();

    for (const position of positions) {
      // Create a normalized position key by sorting notes by string then fret
      const sortedPosition = [...position].sort((a, b) => {
        if (a.string !== b.string) return a.string - b.string;
        return a.fret - b.fret;
      });
      const positionKey = sortedPosition.map(note => `${note.string}:${note.fret}`).join(',');
      
      if (!seenPositions.has(positionKey)) {
        // Also check for very similar positions (within 1 fret difference on same strings)
        const isSimilarToExisting = uniquePositions.some(existingPosition => 
          this.arePositionsSimilar(position, existingPosition)
        );
        
        if (!isSimilarToExisting) {
          uniquePositions.push(position);
          seenPositions.add(positionKey);
        }
      }
    }

    return uniquePositions;
  }

  /**
   * Check if two positions are too similar (same strings, frets within 1 of each other)
   */
  private arePositionsSimilar(pos1: StringFretNote[], pos2: StringFretNote[]): boolean {
    if (pos1.length !== pos2.length) return false;
    
    // Sort both positions by time to compare in order
    const sorted1 = [...pos1].sort((a, b) => a.time - b.time);
    const sorted2 = [...pos2].sort((a, b) => a.time - b.time);
    
    // Check if all notes are on the same strings and within 1 fret
    for (let i = 0; i < sorted1.length; i++) {
      const note1 = sorted1[i];
      const note2 = sorted2[i];
      
      if (note1.string !== note2.string) return false;
      if (Math.abs(note1.fret - note2.fret) > 1) return false;
    }
    
    return true;
  }

  /**
   * Get clean title without position indicators
   */
  private getCleanTitle(title: string): string {
    return title
      .replace(/ \(Pos \d+\/\d+\)$/, '')
      .replace(/ \(Mixed\)$/, '')
      .replace(/ \(Up\)$/, '')
      .replace(/ \(Down\)$/, '')
      .replace(/ \(Up \d+\)$/, '')
      .replace(/ \(Down \d+\)$/, '')
      .replace(/ \(Alt \d+\)$/, '');
  }

  /**
   * Prioritize positions with diverse string usage
   */
  private prioritizeDiverseStringUsage(positions: StringFretNote[][]): StringFretNote[][] {
    // Group positions by their string usage patterns
    const stringUsageGroups = new Map<string, StringFretNote[][]>();
    
    for (const position of positions) {
      const strings = position.map((note: StringFretNote) => note.string).sort((a: number, b: number) => a - b);
      const stringPattern = strings.join(',');
      
      if (!stringUsageGroups.has(stringPattern)) {
        stringUsageGroups.set(stringPattern, []);
      }
      stringUsageGroups.get(stringPattern)!.push(position);
    }
    
    ScaleWithChordsGenerator.log('general', `Found ${stringUsageGroups.size} different string usage patterns:`);
    
    // Select the best position from each string usage group
    const diversePositions: StringFretNote[][] = [];
    
    for (const [pattern, groupPositions] of Array.from(stringUsageGroups.entries())) {
      // Calculate diversity score for each position in the group
      const scoredPositions = groupPositions.map((position: StringFretNote[]) => ({
        position,
        score: this.calculateStringDiversityScore(position)
      }));
      
      // Sort by diversity score (higher is better for diversity)
      scoredPositions.sort((a: { position: StringFretNote[]; score: number }, b: { position: StringFretNote[]; score: number }) => b.score - a.score);
      
      // Take the most diverse position from this group
      const bestPosition = scoredPositions[0].position;
      diversePositions.push(bestPosition);
      
      const strings = bestPosition.map((n: StringFretNote) => n.string);
      const stringUsage = strings.reduce((acc: Record<number, number>, str: number) => {
        acc[str] = (acc[str] || 0) + 1;
        return acc;
      }, {} as Record<number, number>);
      const stringUsageStr = Object.entries(stringUsage)
        .sort(([a], [b]) => parseInt(a) - parseInt(b))
        .map(([str, count]) => `S${str}:${count}`)
        .join(' ');
      
      ScaleWithChordsGenerator.log('general', `  Pattern ${pattern}: ${stringUsageStr} (score: ${scoredPositions[0].score.toFixed(2)})`);
    }
    
    return diversePositions;
  }

  /**
   * Calculate a diversity score for a position based on string usage
   */
  private calculateStringDiversityScore(position: StringFretNote[]): number {
    const strings = position.map((note: StringFretNote) => note.string);
    const frets = position.map((note: StringFretNote) => note.fret);
    
    let score = 0;
    
    // Bonus for using higher strings (1-2)
    const veryHighStringCount = strings.filter((s: number) => s <= 2).length;
    score += veryHighStringCount * 10;
    
    // Bonus for using high strings (1-3)
    const highStringCount = strings.filter((s: number) => s <= 3).length;
    score += highStringCount * 5;
    
    // Bonus for string variety
    const uniqueStrings = new Set(strings).size;
    score += uniqueStrings * 3;
    
    // Bonus for interesting fret patterns (not all on same fret)
    const uniqueFrets = new Set(frets).size;
    score += uniqueFrets * 2;
    
    // Bonus for using a wide range of strings
    const stringSpread = Math.max(...strings) - Math.min(...strings);
    score += stringSpread * 1;
    
    return score;
  }

  /**
   * Log the conditional logging configuration
   */
  private static logConfiguration(): void {
    if (ScaleWithChordsGenerator.CONDITIONAL_LOGGING_CONFIG.enabled) {
      console.log('🔍 CONDITIONAL LOGGING ENABLED');
      console.log('📋 Conditional Logging Configuration:', {
        enabled: ScaleWithChordsGenerator.CONDITIONAL_LOGGING_CONFIG.enabled,
        conditions: ScaleWithChordsGenerator.CONDITIONAL_LOGGING_CONFIG.conditions,
        enableAllCategories: ScaleWithChordsGenerator.CONDITIONAL_LOGGING_CONFIG.enableAllCategories,
        enabledCategories: ScaleWithChordsGenerator.CONDITIONAL_LOGGING_CONFIG.enabledCategories
      });
      
      // Show active conditions in a readable format
      const activeConditions: string[] = [];
      const conditions = ScaleWithChordsGenerator.CONDITIONAL_LOGGING_CONFIG.conditions;
      
      if (conditions.startFret !== undefined) activeConditions.push(`startFret=${conditions.startFret}`);
      if (conditions.endFret !== undefined) activeConditions.push(`endFret=${conditions.endFret}`);
      if (conditions.fretRange !== undefined) activeConditions.push(`fretRange=[${conditions.fretRange.join(',')}]`);
      if (conditions.containsString !== undefined) activeConditions.push(`containsString=${conditions.containsString}`);
      if (conditions.containsStrings !== undefined) activeConditions.push(`containsStrings=[${conditions.containsStrings.join(',')}]`);
      if (conditions.avgFretAbove !== undefined) activeConditions.push(`avgFretAbove=${conditions.avgFretAbove}`);
      if (conditions.avgFretBelow !== undefined) activeConditions.push(`avgFretBelow=${conditions.avgFretBelow}`);
      if (conditions.positionIndex !== undefined) activeConditions.push(`positionIndex=${conditions.positionIndex}`);
      if (conditions.songTitle !== undefined) activeConditions.push(`songTitle="${conditions.songTitle}"`);
      
      if (activeConditions.length > 0) {
        console.log('🎯 Active Conditions:', activeConditions.join(', '));
      } else {
        console.log('⚠️  No conditions set - conditional logging will never trigger!');
      }
      
      if (ScaleWithChordsGenerator.CONDITIONAL_LOGGING_CONFIG.enableAllCategories) {
        console.log('📢 Will enable ALL log categories when conditions match');
      } else if (ScaleWithChordsGenerator.CONDITIONAL_LOGGING_CONFIG.enabledCategories) {
        console.log('📢 Will enable these categories when conditions match:', ScaleWithChordsGenerator.CONDITIONAL_LOGGING_CONFIG.enabledCategories.join(', '));
      } else {
        console.log('⚠️  No categories configured - no logs will show even when conditions match!');
      }
    } else {
      console.log('🔍 Conditional logging is DISABLED');
    }
    
    // Also log the regular logging configuration
    const enabledCategories = Object.entries(ScaleWithChordsGenerator.LOGGING_CONFIG)
      .filter(([_, enabled]) => enabled)
      .map(([category, _]) => category);
    
    if (enabledCategories.length > 0) {
      console.log('📝 Regular logging enabled for:', enabledCategories.join(', '));
    } else {
      console.log('📝 All regular logging is DISABLED');
    }
  }

  // Initialize logging configuration display
  private static readonly _logConfigInit = ScaleWithChordsGenerator.logConfiguration();

  /**
   * Find the best string and fret for a MIDI note within a specific fret box,
   * trying octave variations if the exact note doesn't fit
   */
  private findBestStringFretForMidiWithOctaves(
    midiNote: number, 
    fretBox: { startFret: number; endFret: number }
  ): { string: number; fret: number; actualMidi: number } | null {
    ScaleWithChordsGenerator.log('string', `        Finding position for MIDI ${midiNote} in fret box ${fretBox.startFret}-${fretBox.endFret}:`);
    
    // Try octave variations: original, then ±1, ±2, ±3 octaves
    // Prioritize higher octaves first to encourage higher string usage
    const octaveOffsets = [0, 12, -12, 24, -24, 36, -36];
    
    for (const octaveOffset of octaveOffsets) {
      const testMidi = midiNote + octaveOffset;
      const octaveLabel = octaveOffset === 0 ? 'original' : 
                         octaveOffset > 0 ? `+${octaveOffset/12} octave${Math.abs(octaveOffset/12) > 1 ? 's' : ''}` :
                         `${octaveOffset/12} octave${Math.abs(octaveOffset/12) > 1 ? 's' : ''}`;
      
      ScaleWithChordsGenerator.log('string', `          Trying ${octaveLabel}: MIDI ${testMidi}`);
      
      const position = this.findBestStringFretForMidi(testMidi, fretBox);
      if (position) {
        ScaleWithChordsGenerator.log('valid', `          ✓ Found valid position with ${octaveLabel}`);
        return {
          ...position,
          actualMidi: testMidi
        };
      } else {
        ScaleWithChordsGenerator.log('invalid', `          ✗ No valid position with ${octaveLabel}`);
      }
    }
    
    ScaleWithChordsGenerator.log('invalid', `        → No valid position found with any octave variation`);
    return null;
  }

  /**
   * Find the best string and fret for a MIDI note within a specific fret box
   */
  private findBestStringFretForMidi(
    midiNote: number, 
    fretBox: { startFret: number; endFret: number }
  ): { string: number; fret: number } | null {
    let bestPosition: { string: number; fret: number } | null = null;
    let bestScore = Infinity;
    const candidates: Array<{ string: number; fret: number; score: number }> = [];

    ScaleWithChordsGenerator.log('string', `        Finding position for MIDI ${midiNote} in fret box ${fretBox.startFret}-${fretBox.endFret}:`);

    // Try each string (6 to 1, from low E to high E)
    ScaleWithChordsGenerator.GUITAR_TUNING_MIDI.forEach((openStringMidi, index) => {
      const stringNumber = 6 - index; // Convert to guitar string numbers (6=low E, 1=high E)
      const fret = midiNote - openStringMidi;
      
      ScaleWithChordsGenerator.log('string', `          String ${stringNumber} (open=${openStringMidi}): fret would be ${fret}`);
      
      // Check if this position is within our fret box
      if (fret >= fretBox.startFret && fret <= fretBox.endFret && fret >= 0) {
        // Calculate score - balanced preference that encourages string variety
        let score = fret * 1.5; // Moderate preference for lower frets
        
        // Improved string preference - encourage use of all strings
        // Give slight preference to middle strings, but don't heavily penalize others
        if (stringNumber >= 2 && stringNumber <= 5) {
          score -= 2; // Small bonus for middle strings (2-5)
        }
        
        // Encourage higher string usage for higher notes
        if (midiNote >= 60 && stringNumber <= 3) { // For notes C4 and above, prefer strings 1-3
          score -= 3; // Bonus for using higher strings for higher notes
        }
        
        // Encourage lower string usage for lower notes
        if (midiNote < 50 && stringNumber >= 4) { // For notes below D3, prefer strings 4-6
          score -= 2; // Bonus for using lower strings for lower notes
        }
        
        // Strong bonus for using the highest strings (1-2) to encourage their use
        if (stringNumber <= 2) {
          score -= 5; // Strong bonus for strings 1-2 (E4, B3)
        }
        
        // Additional bonus for string 1 (high E) for very high notes
        if (stringNumber === 1 && midiNote >= 64) { // E4 and above
          score -= 3; // Extra bonus for high E string with high notes
        }
        
        // Slight penalty for extreme frets, but allow them
        if (fret > 12) {
          score += 2; // Small penalty for very high frets
        }
        
        ScaleWithChordsGenerator.log('valid', `            ✓ Valid: String ${stringNumber}, Fret ${fret}, Score ${score.toFixed(2)}`);
        candidates.push({ string: stringNumber, fret, score });
        
        if (score < bestScore) {
          bestScore = score;
          bestPosition = { string: stringNumber, fret };
        }
      } else {
        const reason = fret < 0 ? 'negative fret' : 
                      fret < fretBox.startFret ? 'below fret box' : 
                      'above fret box';
        ScaleWithChordsGenerator.log('invalid', `            ✗ Invalid: ${reason}`);
      }
    });

    // Log results and return
    if (bestPosition) {
      ScaleWithChordsGenerator.log('string', `        → Best option found (score: ${bestScore.toFixed(2)})`);
      ScaleWithChordsGenerator.log('string', `        → All candidates: ${JSON.stringify(candidates)}`);
    } else {
      ScaleWithChordsGenerator.log('invalid', `        → No valid position found`);
    }

    return bestPosition;
  }
}
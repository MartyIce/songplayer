import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Factory, Voice, StaveNote, Formatter, Barline, Dot, Accidental } from 'vexflow';
import { Note, StringFretNote, ChordData } from '../types/SongTypes';
import { useZoom } from '../contexts/ZoomContext';
import './VexStaffDisplay.css';

interface VexStaffDisplayProps {
  notes: Note[];
  currentTime: number;
  timeSignature: [number, number];
  songKey?: string;
  loopEnabled?: boolean;
  loopStart?: number;
  loopEnd?: number;
  nightMode?: boolean;
  chords?: ChordData[];
  scale?: number;
}

interface GroupedNote {
  time: number;
  duration: number;
  notes: string[];
  active: boolean;
  isRest?: boolean;
  voiceCount?: number;
  measure?: number;
}

/*
DON'T DELETE THESE COMMENTS

Lines (from bottom to top): E5 - G4 - B4 - D5 - F5
Mnemonic: Every Good Boy Does Fine   
Spaces (from bottom to top): F4 - A4 - C5 - E5
Mnemonic: F A C E

Guitar:
E2 - A2 - D3 - G3 - B3 - E4.

When guitar music is written in standard notation, it is 
typically written a full octave higher than it sounds. This is done 
to avoid excessive ledger lines below the staff.   

Therefore, the low E string on a guitar is actually E2.

However, when you see a low E written on the treble clef for guitar, 
it represents the lowest string of the guitar, but it is written as an 
E3 in terms of where it appears on the staff (even though it sounds an 
octave lower at E2).
*/

// Constants
const TUNING = ['E5', 'B4', 'G4', 'D4', 'A3', 'E3']; // Standard guitar tuning (written pitch, high to low)
const BASE_SCROLL_SCALE = 60; // Base scaling factor to synchronize with tab view
const VISIBLE_WIDTH = 1000; // Visible width of the score display
const STAVE_LEFT_PADDING = 20; // Padding to the left of the stave
const CLEF_WIDTH = 90; // Width needed for clef and time signature
const BASE_MEASURE_WIDTH = 300; // Increased width per measure to ensure proper spacing

/**
 * Converts string/fret to pitch note
 */
function getPitchFromTab(note: StringFretNote): string {
  // If origNoteDesc is provided, use it directly without recalculating the octave
  if (note.origNoteDesc) {
    return note.origNoteDesc;
  }
  
  // Original implementation for cases where origNoteDesc is not available
  const baseNote = TUNING[note.string - 1];
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

/**
 * Converts duration in beats to VexFlow duration string
 */
function getVexflowDuration(duration: number): string {
  // Handle dotted notes
  if (duration === 3.0) return 'hd';     // dotted half note
  else if (duration === 1.5) return 'qd'; // dotted quarter note
  else if (duration === 0.75) return '8d'; // dotted eighth note
  // Handle regular notes
  else if (duration === 2.0) return 'h';  // half note
  else if (duration === 1.0) return 'q';  // quarter note
  else if (duration === 0.5) return '8';  // eighth note
  else if (duration === 0.25) return '16'; // sixteenth note
  else return 'q'; // default to quarter note
}

/**
 * Determines if a note is currently active based on its time and duration
 */
function isNoteActive(noteTime: number, noteDuration: number, currentTime: number): boolean {
  const TIMING_TOLERANCE = 0.05; // 50ms tolerance
  return noteTime <= currentTime && 
         noteTime + noteDuration > currentTime - TIMING_TOLERANCE;
}

/**
 * Function to get measure number for a given time
 */
function getMeasureNumber(time: number, beatsPerMeasure: number): number {
  return Math.floor(time / beatsPerMeasure);
}

/**
 * Groups notes that occur at the same time (chords)
 */
function groupNotesByTime(visibleNotes: Note[], currentTime: number, timeSignature: [number, number]): GroupedNote[] {
  const groupedNotes: GroupedNote[] = [];
  const restGroups: { [key: string]: Note[] } = {}; // Track simultaneous rests
  const beatsPerMeasure = timeSignature[0];
  
  // First pass: Group regular notes and collect rests
  visibleNotes.forEach((note, index) => {
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
      
      if (index < 3) {
        console.log(`Note ${index} added to existing group:`, existingGroup);
      }
    } else {
      const newGroup = {
        time: note.time,
        duration: note.duration,
        notes: [pitch],
        active,
        measure: getMeasureNumber(note.time, beatsPerMeasure)
      };
      groupedNotes.push(newGroup);
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
  
  // Sort notes within each non-rest group by pitch
  groupedNotes.forEach((group, groupIndex) => {
    if (!group.isRest && group.notes) {
      group.notes.sort((a, b) => {
        const aNoteName = a.slice(0, -1);
        const aOctave = parseInt(a.slice(-1));
        const bNoteName = b.slice(0, -1);
        const bOctave = parseInt(b.slice(-1));
        
        if (aOctave !== bOctave) {
          return bOctave - aOctave;
        }
        
        // Use a complete note array including both sharps and flats
        // to properly sort without converting flats to sharps
        const noteValues: {[key: string]: number} = {
          'C': 0, 'C#': 1, 'Db': 1,
          'D': 2, 'D#': 3, 'Eb': 3,
          'E': 4,
          'F': 5, 'F#': 6, 'Gb': 6,
          'G': 7, 'G#': 8, 'Ab': 8,
          'A': 9, 'A#': 10, 'Bb': 10,
          'B': 11
        };
        
        // Get numeric values for comparison
        const aValue = noteValues[aNoteName] !== undefined ? noteValues[aNoteName] : 0;
        const bValue = noteValues[bNoteName] !== undefined ? noteValues[bNoteName] : 0;
        
        return bValue - aValue;
      });
    }
  });
  
  return groupedNotes;
}

/**
 * Creates VexFlow stave notes from grouped notes
 */
function createVexflowNotes(groupedNotes: GroupedNote[]): StaveNote[] {
  return groupedNotes.map((group, groupIndex) => {
    if (group.isRest) {
      const voiceCount = group.voiceCount || 1;
      // Create vertically stacked rests for simultaneous rests
      const restPositions = ['b/4', 'd/4']; // Positions for stacked rests
      const note = new StaveNote({
        keys: restPositions.slice(0, Math.min(voiceCount, 2)), // Limit to 2 stacked rests
        duration: getVexflowDuration(group.duration) + 'r',
        autoStem: true
      }) as any;
      // Add dot for dotted rests
      if ([3.0, 1.5, 0.75].includes(group.duration)) {
        Dot.buildAndAttach([note]);
      }
      return note;
    }

    if (!group.notes.length) {
      return new StaveNote({
        keys: ['b/4'],
        duration: 'wr',
        autoStem: true
      });
    }

    // Process the note names to have the correct VexFlow format
    const originalNotes = [...group.notes]; // Keep original notes for accidental reference
    const keys = group.notes.map(note => {
      const noteName = note.slice(0, -1);
      const octave = note.slice(-1);
      
      // For VexFlow, we need to separate the accidental from the note
      // VexFlow requires just the base note letter in the key string
      // Accidentals are added separately using modifiers
      let baseNoteName;
      if (noteName.includes('#') || (noteName.includes('b') && noteName !== 'B')) {
        baseNoteName = noteName.charAt(0).toLowerCase();
      } else {
        baseNoteName = noteName.toLowerCase();
      }
      
      return `${baseNoteName}/${octave}`;
    });
    
    const duration = getVexflowDuration(group.duration);
    
    try {
      // Create the stave note
      const staveNote = new StaveNote({
        keys,
        duration,
        autoStem: true
      }) as any;
  
      // Add accidentals separately after creating the note
      let hasAccidentals = false;
      originalNotes.forEach((note, i) => {
        const noteName = note.slice(0, -1);
        
        // Check for accidentals (sharps and flats)
        if (noteName.includes('#')) {
          // Add sharp accidental with proper spacing
          const accidental = new Accidental('#');
          staveNote.addModifier(accidental, i);
          hasAccidentals = true;
        } else if (noteName.includes('b') && noteName !== 'B') {
          // Add flat accidental with proper spacing
          const accidental = new Accidental('b');
          staveNote.addModifier(accidental, i);
          hasAccidentals = true;
        }
      });
  
      // Add dot for dotted notes
      if ([3.0, 1.5, 0.75].includes(group.duration)) {
        Dot.buildAndAttach([staveNote]);
      }
  
      return staveNote;
    } catch (error) {
      console.error(`Error creating note for ${keys.join(', ')}:`, error);
      
      // Fallback to a safe note if there's an error
      return new StaveNote({
        keys: ['b/4'],
        duration,
        autoStem: true
      });
    }
  });
}

/**
 * Converts time to measure.beat format
 */
function getFormattedMeasureTime(time: number, beatsPerMeasure: number): string {
  const measure = Math.floor(time / beatsPerMeasure) + 1; // Adding 1 since measures are 1-based
  const beat = ((time % beatsPerMeasure) + 1).toFixed(2); // Format to 2 decimal places
  return `${measure}.${beat}`;
}

const VexStaffDisplay: React.FC<VexStaffDisplayProps> = ({ 
  notes, 
  currentTime, 
  timeSignature,
  loopEnabled = false,
  loopStart = 0,
  loopEnd = 0,
  nightMode = false,
  chords = [],
  scale = 1
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const factoryRef = useRef<Factory | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [activeNotePos, setActiveNotePos] = useState<number | null>(null);
  const [totalWidth, setTotalWidth] = useState(1000);
  const [totalDuration, setTotalDuration] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [scrollStartX, setScrollStartX] = useState(0);
  const [manualScrollMode, setManualScrollMode] = useState(false);
  const [scaleDivisor, setScaleDivisor] = useState(scale * 2.3); // using temporary slider, this seems a good value
  const { zoomLevel } = useZoom();
  
  // Apply zoom to scaling factors
  const SCROLL_SCALE = BASE_SCROLL_SCALE * zoomLevel;
  const MEASURE_WIDTH = BASE_MEASURE_WIDTH * zoomLevel;

  // Function to get X position for a note at a given time
  const getXPositionForTime = useCallback((time: number): number => {
    // Calculate position based on time and scroll scale to match tablature
    const clefWidth = CLEF_WIDTH; // Width for clef and time signature
    
    // For measure boundaries, calculate based on measure number to ensure even spacing
    const beatsPerMeasure = timeSignature[0];
    const isMeasureBoundary = time > 0 && Math.abs(time % beatsPerMeasure) < 0.001;
    
    if (isMeasureBoundary) {
      // For measure boundaries, use fixed width calculation
      const measureNumber = Math.floor(time / beatsPerMeasure);
      return Math.round(clefWidth + (measureNumber * MEASURE_WIDTH));
    } else {
      // For notes, use the normal time-based calculation
      // Ensure consistent positioning across the staff
      return Math.round(clefWidth + (time * SCROLL_SCALE));
    }
  }, [SCROLL_SCALE, MEASURE_WIDTH, timeSignature]);

  // Calculate target scroll position for centering
  const calculateTargetScrollLeft = useCallback((containerWidth: number): number => {
    if (scale !== 1) {
      // When scale is smaller, more content is visible at once
      // Scale factor of 2.3 was determined through testing
      const scaleDivisor = scale * 2.3;
      const scaleAdjustedPosition = (currentTime * SCROLL_SCALE) / scaleDivisor;
      const scaleAdjustedClefWidth = CLEF_WIDTH / scaleDivisor;
      
      // Center the current position, accounting for scale
      return scaleAdjustedPosition - (containerWidth / 2) + (scaleAdjustedClefWidth / 2);
    }

    // Original behavior when no scale adjustment needed
    const ret = (currentTime * SCROLL_SCALE) - (containerWidth / 2) + (CLEF_WIDTH / 2);
    return ret;
  }, [currentTime, SCROLL_SCALE, scale]);

  // Helper to get the X position for loop markers
  const getLoopMarkerPosition = useCallback((time: number): number => {
    return getXPositionForTime(time);
  }, [getXPositionForTime]);

  useEffect(() => {
    if (!containerRef.current) return;
    
    console.log("Rendering staff with notes:", notes.slice(0, 5));
    
    // Check if we have the test song with C4 and C#4
    const hasTestSongPattern = notes.length > 1 && 
      'note' in notes[0] && notes[0].note === 'C4' &&
      'note' in notes[1] && notes[1].note === 'C#4';
    
    if (hasTestSongPattern) {
      console.log("Detected test song pattern with C4 and C#4");
    }
    
    // Clear previous content
    containerRef.current.innerHTML = '';
    
    // Store ref value for cleanup
    const currentContainer = containerRef.current;
    
    const lastNoteTime = notes.length > 0 ? 
      Math.max(...notes.map(note => note.time + note.duration)) : 
      0;
    
    const currentBeatsPerMeasure = timeSignature[0];
    const totalMeasures = Math.ceil(lastNoteTime / currentBeatsPerMeasure);
    
    const calculatedWidth = Math.max(VISIBLE_WIDTH, totalMeasures * MEASURE_WIDTH);
    
    setTotalWidth(calculatedWidth);
    setTotalDuration(lastNoteTime);
    
    const factory = new Factory({
      renderer: {
        elementId: containerRef.current.id || 'vf-container',
        width: calculatedWidth,
        height: 180 * scale, // Scale the height
        background: nightMode ? '#1a1a1a' : '#ffffff'
      }
    });
    
    const context = factory.getContext();
    context.scale(scale, scale); // Apply scaling to the entire context

    const system = factory.System({
      x: STAVE_LEFT_PADDING,
      width: (calculatedWidth - (STAVE_LEFT_PADDING * 2)) / scale, // Adjust width for scale
      y: scale < 1 ? 20 : 40 // Reduce y-coordinate when scaled down to shift up
    });
    
    try {
      const stave = system.addStave({
        voices: []
      }).addClef('treble')
        .addTimeSignature(`${timeSignature[0]}/${timeSignature[1]}`);
      
      stave.setWidth(calculatedWidth - (STAVE_LEFT_PADDING * 2));
      
      // Set staff color based on night mode
      if (nightMode) {
        context.setStrokeStyle('#FFFFFF');
        context.setFillStyle('#FFFFFF');
      }
      
      // Group notes by time to handle chords
      const groupedNotes = groupNotesByTime(notes, currentTime, timeSignature);
      
      // Create VexFlow notes
      const vexNotes = createVexflowNotes(groupedNotes);
      
      // Verify vexNotes were created correctly
      if (vexNotes.length > 0) {
        console.log(`Created ${vexNotes.length} VexFlow notes`);
        console.log(`First 3 notes:`, vexNotes.slice(0, 3));
      }
      
      // Create a single voice for all notes
      const voice = new Voice({
        numBeats: currentBeatsPerMeasure * totalMeasures,
        beatValue: timeSignature[1]
      }).setStrict(false);
      
      voice.addTickables(vexNotes);
      
      // Format and draw
      const formatter = new Formatter();
      
      formatter.joinVoices([voice])
              .formatToStave([voice], stave);
      
      // Check formatter results
      console.log("Formatter applied:", formatter);
      
      stave.setBegBarType(Barline.type.SINGLE);
      stave.setEndBarType(Barline.type.END);
      
      // Draw stave and notes
      stave.draw();
      voice.draw(context, stave);
      
      // Get the tickables from the voice (these are the notes after formatting)
      const tickables = voice.getTickables();
      
      // Get info from first few tickables for debugging
      tickables.slice(0, 3).forEach((tickable, i) => {
        // Access properties safely using cast
        const tickableAny = tickable as any;
        if (tickableAny.tickContext) {
          console.log(`Tickable ${i}: x=${tickableAny.tickContext.getX()}, width=${tickable.width}`);
        }
      });

      // Map each note to its measure
      const notesByMeasure: { [key: number]: number[] } = {};
      
      // First, collect which notes are in which measures
      notes.forEach((note, index) => {
        let measureNum = 0;
        if ('measure' in note && typeof note.measure === 'number') {
          measureNum = note.measure;
        } else {
          measureNum = Math.floor(note.time / timeSignature[0]) + 1;
        }
        
        if (!notesByMeasure[measureNum]) {
          notesByMeasure[measureNum] = [];
        }
        notesByMeasure[measureNum].push(index);
      });
      
      console.log("Notes by measure:", notesByMeasure);
      
      // Find the last note in each measure
      const measureEndNotes: { [key: number]: number } = {};
      
      Object.keys(notesByMeasure).forEach(measureKey => {
        const measureNum = parseInt(measureKey);
        const noteIndices = notesByMeasure[measureNum];
        
        if (noteIndices && noteIndices.length > 0) {
          // Sort indices and get the last one
          const lastNoteIndex = Math.max(...noteIndices);
          measureEndNotes[measureNum] = lastNoteIndex;
        }
      });
      
      console.log("Last note indices by measure:", measureEndNotes);
      
      // Get X positions for barlines from tickables
      const barlinePositions: { [key: number]: number } = {};

      // Skip measure 1 since it starts after clef (no barline needed at the beginning)
      for (let measure = 1; measure < Object.keys(notesByMeasure).length; measure++) {
        const endNoteIndex = measureEndNotes[measure];
        
        // If we have a valid note index for this measure
        if (endNoteIndex !== undefined && endNoteIndex < tickables.length - 1) {
          // Get the last note of the current measure and the first note of the next measure
          const currentTickable = tickables[endNoteIndex + 1];
          const nextTickable = tickables[endNoteIndex + 2];
          
          // Access X positions using cast
          const currentTickableAny = currentTickable as any;
          const nextTickableAny = nextTickable as any;
          
          let currentX = 0;
          let nextX = 0;
          
          // Get X position of current tickable
          if (currentTickableAny.tickContext) {
            currentX = currentTickableAny.tickContext.getX();
          }
          
          // Get X position of next tickable (if available)
          if (nextTickableAny && nextTickableAny.tickContext) {
            nextX = nextTickableAny.tickContext.getX();
          } else {
            // If there's no next tickable, estimate a position
            // Use the current tickable width as a fallback
            nextX = currentX + (currentTickable.width || 0) + 40;
          }
          
          // Set barline position to halfway between the two tickables
          const barlineX = currentX + ((nextX - currentX) / 2);
          
          barlinePositions[measure] = barlineX; // Barline marks end of current measure
          
          console.log(`Barline for measure ${measure} positioned at ${barlineX} (between note ${endNoteIndex + 1} at ${currentX} and next note at ${nextX})`);
        }
      }
      
      // Draw barlines at the calculated positions
      Object.keys(barlinePositions).forEach(measureKey => {
        const measureNum = parseInt(measureKey);
        const position = barlinePositions[measureNum];
        
        // Draw the barline
        context.beginPath();
        context.moveTo(position, stave.getYForLine(0));
        context.lineTo(position, stave.getYForLine(4));
        context.setStrokeStyle(nightMode ? '#FFFFFF' : '#000000');
        context.setLineWidth(1.5);
        context.stroke();
        
        // Add measure number and chord
        const svg = containerRef.current?.querySelector('svg');
        if (svg) {
          const svgNS = "http://www.w3.org/2000/svg";
          const yOffset = stave.getYForLine(0) - 15;
          
          // Position text slightly after barline
          const textX = position + 8;
          
          // Add measure number
          const text = document.createElementNS(svgNS, "text");
          text.setAttributeNS(null, "x", textX.toString());
          text.setAttributeNS(null, "y", yOffset.toString());
          text.setAttributeNS(null, "font-family", "Arial");
          text.setAttributeNS(null, "font-size", "10px");
          text.setAttributeNS(null, "fill", nightMode ? '#FFFFFF' : 'rgba(0, 0, 0, 0.6)');
          text.setAttributeNS(null, "data-measure-number", "true");
          text.setAttributeNS(null, "text-anchor", "start");
          text.textContent = measureNum.toString();
          svg.appendChild(text);
          
          // Add chord for this measure if it exists
          const chord = chords.find(c => c.measure === measureNum);
          if (chord) {
            const chordText = document.createElementNS(svgNS, "text");
            chordText.setAttributeNS(null, "x", textX.toString());
            chordText.setAttributeNS(null, "y", (yOffset - 15).toString());
            chordText.setAttributeNS(null, "font-family", "Arial");
            chordText.setAttributeNS(null, "font-size", "12px");
            chordText.setAttributeNS(null, "fill", nightMode ? '#FFFFFF' : '#0066cc');
            chordText.setAttributeNS(null, "font-weight", "bold");
            chordText.setAttributeNS(null, "data-chord", "true");
            chordText.setAttributeNS(null, "text-anchor", "start");
            chordText.textContent = chord.chord;
            svg.appendChild(chordText);
          }
        }
      });
      
      // Add the first measure number and chord at the beginning
      const svg = containerRef.current?.querySelector('svg');
      if (svg) {
        const svgNS = "http://www.w3.org/2000/svg";
        const yOffset = stave.getYForLine(0) - 15;
        
        // Position just after clef and time signature
        const textX = CLEF_WIDTH + 8;
        
        // Add first measure number
        const text = document.createElementNS(svgNS, "text");
        text.setAttributeNS(null, "x", textX.toString());
        text.setAttributeNS(null, "y", yOffset.toString());
        text.setAttributeNS(null, "font-family", "Arial");
        text.setAttributeNS(null, "font-size", "10px");
        text.setAttributeNS(null, "fill", nightMode ? '#FFFFFF' : 'rgba(0, 0, 0, 0.6)');
        text.setAttributeNS(null, "data-measure-number", "true");
        text.setAttributeNS(null, "text-anchor", "start");
        text.textContent = "1";
        svg.appendChild(text);
        
        // Add first chord if it exists
        const firstChord = chords.find(c => c.measure === 1);
        if (firstChord) {
          const chordText = document.createElementNS(svgNS, "text");
          chordText.setAttributeNS(null, "x", textX.toString());
          chordText.setAttributeNS(null, "y", (yOffset - 15).toString());
          chordText.setAttributeNS(null, "font-family", "Arial");
          chordText.setAttributeNS(null, "font-size", "12px");
          chordText.setAttributeNS(null, "fill", nightMode ? '#FFFFFF' : '#0066cc');
          chordText.setAttributeNS(null, "font-weight", "bold");
          chordText.setAttributeNS(null, "data-chord", "true");
          chordText.setAttributeNS(null, "text-anchor", "start");
          chordText.textContent = firstChord.chord;
          svg.appendChild(chordText);
        }
      }
      
      // Color active notes
      if (containerRef.current) {
        const svg = containerRef.current.querySelector('svg');
        if (svg) {
          // Reset all notes to default coloring
          const allNotes = svg.querySelectorAll('.vf-stavenote, .vf-notehead');
          allNotes.forEach(note => {
            note.removeAttribute('data-active');
            note.setAttribute('fill', nightMode ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)');
            note.setAttribute('stroke', nightMode ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)');
          });
          
          // Find and color active notes
          const staveNoteElements = svg.querySelectorAll('.vf-stavenote');
          staveNoteElements.forEach((el, index) => {
            const group = groupedNotes[index];
            if (group && isNoteActive(group.time, group.duration, currentTime)) {
              el.setAttribute('fill', 'blue');
              el.setAttribute('stroke', 'blue');
              el.setAttribute('data-active', 'true');
              
              const paths = el.querySelectorAll('path');
              paths.forEach(path => {
                path.setAttribute('fill', 'blue');
                path.setAttribute('stroke', 'blue');
              });
              
              const noteheads = el.querySelectorAll('.vf-notehead');
              noteheads.forEach(notehead => {
                notehead.setAttribute('fill', 'blue');
                notehead.setAttribute('stroke', 'blue');
                notehead.setAttribute('data-active', 'true');
                
                const textElements = notehead.querySelectorAll('text');
                textElements.forEach(text => {
                  text.setAttribute('fill', 'blue');
                  text.style.fill = 'blue';
                });
              });
            }
          });
        }
      }
      
    } catch (error) {
      console.error('Error rendering staff:', error);
    }
    
    factoryRef.current = factory;
    
    // Clean up function
    return () => {
      if (factoryRef.current) {
        factoryRef.current.reset();
      }
      // Remove measure number text elements using stored ref
      const svg = currentContainer?.querySelector('svg');
      if (svg) {
        const texts = svg.querySelectorAll('text[data-measure-number], text[data-chord], text[data-index-number]');
        texts.forEach(text => text.remove());
      }
    };
  }, [notes, timeSignature, currentTime, nightMode, MEASURE_WIDTH, SCROLL_SCALE, chords, scale]);

  // Effect for handling active note highlighting and scrolling
  useEffect(() => {
    if (!containerRef.current || !scrollContainerRef.current) return;
    
    // Find active note based on current time
    const activeNote = notes.find(note => 
      note.time <= currentTime && 
      note.time + note.duration > currentTime
    );
    
    // Update active note position
    if (activeNote) {
      const position = getXPositionForTime(activeNote.time);
      setActiveNotePos(position);
      
      // Find and update active note visualization
      const svg = containerRef.current.querySelector('svg');
      if (svg) {
        // First, reset all notes to default coloring
        const allNotes = svg.querySelectorAll('.vf-stavenote, .vf-notehead');
        allNotes.forEach(note => {
          note.removeAttribute('data-active');
          note.setAttribute('fill', nightMode ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)');
          note.setAttribute('stroke', nightMode ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)');
        });
        
        // Find active notes by time
        const groupedNotes = groupNotesByTime(notes, currentTime, timeSignature);
        const staveNoteElements = svg.querySelectorAll('.vf-stavenote');
        
        // Highlight active notes
        staveNoteElements.forEach((el, index) => {
          if (groupedNotes[index]?.active) {
            el.setAttribute('data-active', 'true');
            el.setAttribute('fill', '#61dafb');
            el.setAttribute('stroke', '#61dafb');
            
            // Also highlight all child elements
            const allChildren = el.querySelectorAll('*');
            allChildren.forEach(child => {
              child.setAttribute('fill', '#61dafb');
              child.setAttribute('stroke', '#61dafb');
            });
          }
        });
      }
      
      // If in auto-scroll mode, center on current playback position
      if (!manualScrollMode && !isDragging && scrollContainerRef.current && activeNotePos !== null) {
        const containerWidth = scrollContainerRef.current.clientWidth;
        const targetScrollLeft = calculateTargetScrollLeft(containerWidth);
        
        // Use requestAnimationFrame for smoother scrolling
        requestAnimationFrame(() => {
          scrollContainerRef.current?.scrollTo({
            left: targetScrollLeft,
            behavior: 'auto'
          });
        });
      }
    }
  }, [notes, currentTime, timeSignature, totalWidth, totalDuration, activeNotePos, 
    manualScrollMode, isDragging, nightMode, SCROLL_SCALE, getXPositionForTime, calculateTargetScrollLeft]);

  // Handle zoom level changes
  useEffect(() => {
    if (!manualScrollMode && !isDragging && scrollContainerRef.current && activeNotePos !== null) {
      const containerWidth = scrollContainerRef.current.clientWidth;
      const targetScrollLeft = calculateTargetScrollLeft(containerWidth);
      
      // Use requestAnimationFrame for smoother zoom transitions
      requestAnimationFrame(() => {
        scrollContainerRef.current?.scrollTo({
          left: targetScrollLeft,
          behavior: 'auto'
        });
      });
    }
  }, [SCROLL_SCALE, activeNotePos, manualScrollMode, isDragging, calculateTargetScrollLeft]);

  // Mouse event handlers for dragging
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (scrollContainerRef.current) {
      setIsDragging(true);
      setDragStartX(e.clientX);
      setScrollStartX(scrollContainerRef.current.scrollLeft);
      setManualScrollMode(true);
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging && scrollContainerRef.current) {
      e.preventDefault();
      const dx = e.clientX - dragStartX;
      const newScrollLeft = scrollStartX - dx;
      scrollContainerRef.current.scrollLeft = newScrollLeft;
    }
  }, [isDragging, dragStartX, scrollStartX]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Touch event handlers for mobile dragging
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (scrollContainerRef.current && e.touches[0]) {
      setIsDragging(true);
      setDragStartX(e.touches[0].clientX);
      setScrollStartX(scrollContainerRef.current.scrollLeft);
      setManualScrollMode(true);
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (isDragging && scrollContainerRef.current && e.touches[0]) {
      const dx = e.touches[0].clientX - dragStartX;
      const newScrollLeft = scrollStartX - dx;
      scrollContainerRef.current.scrollLeft = newScrollLeft;
    }
  }, [isDragging, dragStartX, scrollStartX]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Toggle between auto-scroll and manual mode on double click
  const handleDoubleClick = useCallback(() => {
    setManualScrollMode(!manualScrollMode);
  }, [manualScrollMode]);

  // Update handleResumeAutoScroll to use the new function
  const handleResumeAutoScroll = useCallback(() => {
    setManualScrollMode(false);
    if (scrollContainerRef.current) {
      const containerWidth = scrollContainerRef.current.clientWidth;
      const targetScrollLeft = calculateTargetScrollLeft(containerWidth);
      scrollContainerRef.current.scrollLeft = targetScrollLeft;
    }
  }, [calculateTargetScrollLeft]);

  // Auto-scrolling for following the music
  useEffect(() => {
    // Only scroll if not in manual mode
    if (!manualScrollMode && !isDragging && scrollContainerRef.current && currentTime > 0) {
      const containerWidth = scrollContainerRef.current.clientWidth;
      const targetScrollLeft = calculateTargetScrollLeft(containerWidth);
      
      // Use requestAnimationFrame for smoother scrolling
      requestAnimationFrame(() => {
        scrollContainerRef.current?.scrollTo({
          left: targetScrollLeft,
          behavior: 'auto'
        });
      });
    }
  }, [loopEnabled, loopStart, loopEnd, manualScrollMode, isDragging, currentTime, calculateTargetScrollLeft]);

  return (
    <div className="vex-staff-display" data-night-mode={nightMode}>


      {/* ScaleDivisor tester */}
      {/* <div style={{ 
        position: 'absolute', 
        top: '5px', 
        left: '50%', 
        transform: 'translateX(-50%)',
        zIndex: 1000,
        background: 'rgba(255, 255, 255, 0.9)',
        padding: '5px',
        borderRadius: '4px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
      }}>
        <span style={{ fontSize: '12px' }}>Scale Divisor: {scaleDivisor.toFixed(2)}</span>
        <input
          type="range"
          min="0.1"
          max="2"
          step="0.05"
          value={scaleDivisor}
          onChange={(e) => setScaleDivisor(parseFloat(e.target.value))}
          style={{ width: '100px' }}
        />
      </div> */}

      {manualScrollMode && (
        <button 
          className="staff-resume-button visible"
          onClick={handleResumeAutoScroll}
        >
          Resume Auto-Scroll
        </button>
      )}
      <div 
        className={`staff-scroll-container ${manualScrollMode ? 'manual-scroll' : ''}`} 
        ref={scrollContainerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onDoubleClick={handleDoubleClick}
      >
        <div id="vf-container" ref={containerRef} />
        
        {/* Loop markers - similar to those in TablaturePlayer */}
        {loopEnabled && (
          <>
            <div 
              className="sheet-loop-marker sheet-loop-start-marker"
              style={{ left: `${getLoopMarkerPosition(loopStart)}px` }}
            >
              <div className="measure-info">
                M{getFormattedMeasureTime(loopStart, timeSignature[0])}
              </div>
            </div>
            <div 
              className="sheet-loop-marker sheet-loop-end-marker"
              style={{ left: `${getLoopMarkerPosition(loopEnd)}px` }}
            >
              <div className="measure-info">
                M{getFormattedMeasureTime(loopEnd, timeSignature[0])}
              </div>
            </div>
            <div 
              className="sheet-loop-region"
              style={{
                left: `${getLoopMarkerPosition(loopStart)}px`,
                width: `${getLoopMarkerPosition(loopEnd) - getLoopMarkerPosition(loopStart)}px`
              }}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default VexStaffDisplay;
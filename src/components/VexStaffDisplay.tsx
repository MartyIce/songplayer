import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Factory, Voice, StaveNote, Formatter, Barline } from 'vexflow';
import { Note, StringFretNote } from '../types/SongTypes';
import './VexStaffDisplay.css';

interface VexStaffDisplayProps {
  notes: Note[];
  currentTime: number;
  timeSignature: [number, number];
  loopEnabled?: boolean;
  loopStart?: number;
  loopEnd?: number;
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
const SCROLL_SCALE = 60; // Scaling factor to synchronize with tab view - aligned with basePixelsPerBeat in TablaturePlayer

// Stave rendering constants
const VISIBLE_WIDTH = 1000; // Visible width of the score display
const STAVE_LEFT_PADDING = 20; // Padding to the left of the stave
const CLEF_WIDTH = 90; // Width needed for clef and time signature
const MEASURE_WIDTH = 240; // Width per measure (adjusted for better spacing and aligned with tablature)

/**
 * Converts string/fret to pitch note
 */
function getPitchFromTab(note: StringFretNote): string {
  const baseNote = TUNING[note.string - 1];
  const noteName = baseNote.slice(0, -1);
  const octave = parseInt(baseNote.slice(-1));
  
  // Calculate semitones from base note
  const semitones = note.fret;
  
  // Basic pitch calculation
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const baseIndex = notes.indexOf(noteName);
  const newIndex = (baseIndex + semitones) % 12;
  const octaveIncrease = Math.floor((baseIndex + semitones) / 12);
  
  return `${notes[newIndex]}${octave + octaveIncrease}`;
}

/**
 * Converts duration in beats to VexFlow duration string
 */
function getVexflowDuration(duration: number): string {
  if (duration === 2.0) return 'h';      // half note
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
  
  // Sort notes within each non-rest group by pitch
  groupedNotes.forEach(group => {
    if (!group.isRest && group.notes) {
      group.notes.sort((a, b) => {
        const aNoteName = a.slice(0, -1);
        const aOctave = parseInt(a.slice(-1));
        const bNoteName = b.slice(0, -1);
        const bOctave = parseInt(b.slice(-1));
        
        if (aOctave !== bOctave) {
          return bOctave - aOctave;
        }
        
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const aIndex = notes.indexOf(aNoteName);
        const bIndex = notes.indexOf(bNoteName);
        
        return bIndex - aIndex;
      });
    }
  });
  
  return groupedNotes;
}

/**
 * Creates VexFlow stave notes from grouped notes
 */
function createVexflowNotes(groupedNotes: GroupedNote[]): StaveNote[] {
  return groupedNotes.map((group) => {
    if (group.isRest) {
      const voiceCount = group.voiceCount || 1;
      // Create vertically stacked rests for simultaneous rests
      const restPositions = ['b/4', 'd/4']; // Positions for stacked rests
      return new StaveNote({
        keys: restPositions.slice(0, Math.min(voiceCount, 2)), // Limit to 2 stacked rests
        duration: getVexflowDuration(group.duration) + 'r',
        autoStem: true
      });
    }

    if (!group.notes.length) {
      return new StaveNote({
        keys: ['b/4'],
        duration: 'wr',
        autoStem: true
      });
    }

    const keys = group.notes.map(note => {
      const noteName = note.slice(0, -1);
      const octave = note.slice(-1);
      return `${noteName.toLowerCase()}/${octave}`;
    });
    
    const duration = getVexflowDuration(group.duration);
    return new StaveNote({
      keys,
      duration,
      autoStem: true
    });
  });
}

/**
 * Custom function to manually position notes according to their time
 */
function positionNotes(groupedNotes: GroupedNote[], 
                      voice: Voice, 
                      stave: any): void {
  // Get all tickables in the voice
  const tickables = voice.getTickables();
  
  // Set position for each note based on its time
  groupedNotes.forEach((group, index) => {
    if (index < tickables.length) {
      const tickable = tickables[index];
      // Set the x position based on the same scale factor as grid lines
      const xPos = CLEF_WIDTH + (group.time * SCROLL_SCALE);
      tickable.setXShift(xPos - tickable.getX());
    }
  });
}

// Function to get X position for a note at a given time
function getXPositionForTime(time: number, totalWidth: number, totalDuration: number): number {
  // Calculate position based on time and scroll scale to match tablature
  const clefWidth = CLEF_WIDTH; // Width for clef and time signature
  
  // Position is based on time * scale factor, plus clef width offset
  return clefWidth + (time * SCROLL_SCALE);
}

const VexStaffDisplay: React.FC<VexStaffDisplayProps> = ({ 
  notes, 
  currentTime, 
  timeSignature,
  loopEnabled = false,
  loopStart = 0,
  loopEnd = 0
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

  useEffect(() => {
    if (!containerRef.current) return;
    
    containerRef.current.innerHTML = '';
    
    const lastNoteTime = notes.length > 0 ? 
      Math.max(...notes.map(note => note.time + note.duration)) : 
      0;
    
    const beatsPerMeasure = timeSignature[0];
    const totalMeasures = Math.ceil(lastNoteTime / beatsPerMeasure);
    
    const calculatedWidth = Math.max(VISIBLE_WIDTH, totalMeasures * MEASURE_WIDTH);
    
    setTotalWidth(calculatedWidth);
    setTotalDuration(lastNoteTime);
    
    const factory = new Factory({
      renderer: {
        elementId: containerRef.current.id || 'vf-container',
        width: calculatedWidth,
        height: 150,
        background: '#1a1a1a'
      }
    });
    
    const context = factory.getContext();
    const system = factory.System({
      x: STAVE_LEFT_PADDING,
      width: calculatedWidth - (STAVE_LEFT_PADDING * 2),
    });
    
    try {
      const stave = system.addStave({
        voices: []
      }).addClef('treble')
        .addTimeSignature(`${timeSignature[0]}/${timeSignature[1]}`);
      
      stave.setWidth(calculatedWidth - (STAVE_LEFT_PADDING * 2));
      
      // Group notes by time to handle chords
      const groupedNotes = groupNotesByTime(notes, currentTime, timeSignature);
      
      // Create VexFlow notes
      const vexNotes = createVexflowNotes(groupedNotes);
      
      // Create a single voice for all notes
      const voice = new Voice({
        numBeats: beatsPerMeasure * totalMeasures,
        beatValue: timeSignature[1]
      }).setStrict(false);
      
      voice.addTickables(vexNotes);
      
      // Format and draw
      new Formatter()
        .joinVoices([voice])
        .formatToStave([voice], stave);
      
      // Apply custom positioning based on note timing
      positionNotes(groupedNotes, voice, stave);
      
      stave.setBegBarType(Barline.type.SINGLE);
      stave.setEndBarType(Barline.type.END);
      
      stave.draw();
      voice.draw(context, stave);
      
      // Draw measure barlines
      let currentMeasureTime = beatsPerMeasure;
      while (currentMeasureTime < lastNoteTime) {
        // Calculate position based on SCROLL_SCALE to align with tablature grid lines
        const x = CLEF_WIDTH + (currentMeasureTime * SCROLL_SCALE);
        
        context.beginPath();
        context.moveTo(x, stave.getYForLine(0));
        context.lineTo(x, stave.getYForLine(4));
        context.setStrokeStyle('#FFFFFF');
        context.setLineWidth(1);
        context.stroke();
        
        currentMeasureTime += beatsPerMeasure;
      }
      
      // Color active notes
      if (containerRef.current) {
        const svg = containerRef.current.querySelector('svg');
        if (svg) {
          // Reset all notes to default coloring
          const allNotes = svg.querySelectorAll('.vf-stavenote, .vf-notehead');
          allNotes.forEach(note => {
            note.removeAttribute('data-active');
            note.setAttribute('fill', 'rgba(255, 255, 255, 0.8)');
            note.setAttribute('stroke', 'rgba(255, 255, 255, 0.8)');
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
    
    return () => {
      if (factoryRef.current) {
        factoryRef.current.reset();
      }
    };
  }, [notes, timeSignature, currentTime]);

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
      const position = getXPositionForTime(activeNote.time, totalWidth, totalDuration);
      setActiveNotePos(position);
      
      // Find and update active note visualization
      const svg = containerRef.current.querySelector('svg');
      if (svg) {
        // First, reset all notes to default coloring
        const allNotes = svg.querySelectorAll('.vf-stavenote, .vf-notehead');
        allNotes.forEach(note => {
          note.removeAttribute('data-active');
          note.setAttribute('fill', 'rgba(255, 255, 255, 0.8)');
          note.setAttribute('stroke', 'rgba(255, 255, 255, 0.8)');
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
        const targetScrollLeft = (currentTime * SCROLL_SCALE) - (containerWidth / 2) + CLEF_WIDTH;
        
        // Use direct positioning to maintain synchronization with tab view
        scrollContainerRef.current.scrollLeft = targetScrollLeft;
      }
    }
  }, [notes, currentTime, timeSignature, totalWidth, totalDuration, activeNotePos, manualScrollMode, isDragging]);

  // Mouse event handlers for dragging
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (scrollContainerRef.current) {
      setIsDragging(true);
      setDragStartX(e.clientX);
      setScrollStartX(scrollContainerRef.current.scrollLeft);
      setManualScrollMode(true);
      
      // Add no-transition class for immediate response during dragging
      if (containerRef.current) {
        containerRef.current.classList.add('no-transition');
      }
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging && scrollContainerRef.current) {
      e.preventDefault(); // Prevent text selection during drag
      const dx = e.clientX - dragStartX;
      const newScrollLeft = scrollStartX - dx;
      
      // Direct DOM manipulation for immediate response and synchronization
      scrollContainerRef.current.scrollLeft = newScrollLeft;
    }
  }, [isDragging, dragStartX, scrollStartX]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    
    // Remove no-transition class when dragging ends
    if (containerRef.current) {
      containerRef.current.classList.remove('no-transition');
    }
  }, []);

  // Touch event handlers for mobile dragging
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (scrollContainerRef.current && e.touches[0]) {
      setIsDragging(true);
      setDragStartX(e.touches[0].clientX);
      setScrollStartX(scrollContainerRef.current.scrollLeft);
      setManualScrollMode(true);
      
      // Add no-transition class for immediate response during dragging
      if (containerRef.current) {
        containerRef.current.classList.add('no-transition');
      }
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (isDragging && scrollContainerRef.current && e.touches[0]) {
      const dx = e.touches[0].clientX - dragStartX;
      const newScrollLeft = scrollStartX - dx;
      
      // Direct DOM manipulation for immediate response and synchronization
      scrollContainerRef.current.scrollLeft = newScrollLeft;
    }
  }, [isDragging, dragStartX, scrollStartX]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    
    // Remove no-transition class when dragging ends
    if (containerRef.current) {
      containerRef.current.classList.remove('no-transition');
    }
  }, []);

  // Toggle between auto-scroll and manual mode on double click
  const handleDoubleClick = useCallback(() => {
    setManualScrollMode(!manualScrollMode);
  }, [manualScrollMode]);

  // Helper to get the X position for loop markers
  const getLoopMarkerPosition = (time: number): number => {
    return getXPositionForTime(time, totalWidth, totalDuration);
  };

  // Auto-scrolling for following the music
  useEffect(() => {
    // No need to store animation frame ref since we're not using it yet
    // This effect is for future auto-scrolling implementation
    
    // Clean up not needed since we're not using animation frames yet
  }, [loopEnabled, loopStart, loopEnd, activeNotePos, manualScrollMode, currentTime]);

  return (
    <div className="vex-staff-display">
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
            />
            <div 
              className="sheet-loop-marker sheet-loop-end-marker"
              style={{ left: `${getLoopMarkerPosition(loopEnd)}px` }}
            />
            <div 
              className="sheet-loop-region"
              style={{
                left: `${getLoopMarkerPosition(loopStart)}px`,
                width: `${getLoopMarkerPosition(loopEnd) - getLoopMarkerPosition(loopStart)}px`
              }}
            />
          </>
        )}
        
        {manualScrollMode && (
          <div className="manual-scroll-indicator">Manual Scroll</div>
        )}
      </div>
    </div>
  );
};

export default VexStaffDisplay;
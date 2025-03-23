import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Factory, Voice, StaveNote, Formatter, Barline } from 'vexflow';
import { Note, StringFretNote } from '../types/SongTypes';
import './VexStaffDisplay.css';

interface VexStaffDisplayProps {
  notes: Note[];
  currentTime: number;
  timeSignature: [number, number];
}

interface GroupedNote {
  time: number;
  duration: number;
  notes: string[];
  active: boolean;
  isRest?: boolean;
  voiceCount?: number;
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
const ACTIVE_NOTE_COLOR = '#FF0000'; // Bright red for active notes
const INACTIVE_NOTE_COLOR = '#FFFFFF'; // White for inactive notes
const TIMING_TOLERANCE = 0.05; // 50ms tolerance for timing
const SCROLL_SCALE = 56; // Scaling factor to synchronize with tab view

// Stave rendering constants
const VISIBLE_WIDTH = 1000; // Visible width of the score display
const STAVE_LEFT_PADDING = 20; // Padding to the left of the stave
const CLEF_WIDTH = 90; // Width needed for clef and time signature
const MEASURE_WIDTH = 200; // Width per measure (adjusted for better spacing)

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
 * Groups notes that occur at the same time (chords)
 */
function groupNotesByTime(visibleNotes: Note[], currentTime: number): GroupedNote[] {
  const groupedNotes: GroupedNote[] = [];
  const restGroups: { [key: string]: number } = {}; // Track number of rests at each time point
  
  // First pass: Group regular notes
  visibleNotes.forEach(note => {
    if ('rest' in note) {
      // Count rests at each time point
      const timeKey = note.time.toFixed(3);
      restGroups[timeKey] = (restGroups[timeKey] || 0) + 1;
      return;
    }

    let pitch: string = '';
    if ('note' in note) {
      pitch = note.note;
    } else if ('string' in note) {
      pitch = getPitchFromTab(note);
    } else {
      return; // Skip if neither note nor string/fret
    }
    
    if (!pitch) return; // Skip if no valid pitch was determined
    
    const active = isNoteActive(note.time, note.duration, currentTime);
    
    // Use a smaller epsilon for time comparison to prevent grouping different notes
    const existingGroup = groupedNotes.find(g => 
      Math.abs(g.time - note.time) < 0.001 && g.duration === note.duration
    );
    
    if (existingGroup) {
      existingGroup.notes.push(pitch);
      
      // If this note is active, mark the whole group as active
      if (active) {
        existingGroup.active = true;
      }
    } else {
      groupedNotes.push({
        time: note.time,
        duration: note.duration,
        notes: [pitch],
        active
      });
    }
  });
  
  // Second pass: Add rest groups
  Object.entries(restGroups).forEach(([timeStr, count]) => {
    const time = parseFloat(timeStr);
    const matchingNote = visibleNotes.find(n => Math.abs(n.time - time) < 0.001 && 'rest' in n);
    if (matchingNote) {
      groupedNotes.push({
        time,
        duration: matchingNote.duration,
        notes: [],
        active: false,
        isRest: true,
        voiceCount: count // Add the count of simultaneous rests
      });
    }
  });
  
  // Sort notes within each group by pitch (high to low for proper stave rendering)
  groupedNotes.forEach(group => {
    if (!group.isRest) {
      group.notes.sort((a, b) => {
        // Extract note and octave
        const aNoteName = a.slice(0, -1);
        const aOctave = parseInt(a.slice(-1));
        const bNoteName = b.slice(0, -1);
        const bOctave = parseInt(b.slice(-1));
        
        // Compare octaves first (higher octave should be first in VexFlow)
        if (aOctave !== bOctave) {
          return bOctave - aOctave; // Higher octave first (descending)
        }
        
        // If octaves are the same, compare notes within the octave
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const aIndex = notes.indexOf(aNoteName);
        const bIndex = notes.indexOf(bNoteName);
        
        return bIndex - aIndex; // Higher notes first (descending order)
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
    if (!group.notes.length && !group.isRest) {
      return new StaveNote({
        keys: ['b/4'],
        duration: 'wr',
        autoStem: true
      });
    }

    // Handle rests
    if (group.isRest) {
      const voiceCount = group.voiceCount || 1;
      if (voiceCount > 1) {
        // Create multiple rests stacked vertically
        const restPositions = ['b/4', 'd/4']; // Different vertical positions for stacked rests
        return new StaveNote({
          keys: restPositions.slice(0, voiceCount),
          duration: 'qr',
          autoStem: true
        });
      } else {
        // Single rest
        return new StaveNote({
          keys: ['b/4'],
          duration: 'qr',
          autoStem: true
        });
      }
    }

    // Format keys for VexFlow (e.g., "C4" becomes "c/4")
    const keys = group.notes.map(note => {
      const noteName = note.slice(0, -1);
      const octave = note.slice(-1);
      return `${noteName.toLowerCase()}/${octave}`;
    });
    
    const duration = getVexflowDuration(group.duration);

    const staveNote = new StaveNote({
      keys,
      duration,
      autoStem: true
    });

    // ... existing code for accidentals ...
    return staveNote;
  });
}

// Function to get X position for a note at a given time
function getXPositionForTime(time: number, totalWidth: number, totalDuration: number): number {
  // Calculate position based on time proportion
  const clefWidth = 90; // Width for clef and time signature
  const usableWidth = totalWidth - clefWidth - 40; // Subtract padding
  
  // Position is proportional to time, but offset by clef width
  return clefWidth + (time / totalDuration) * usableWidth;
}

const VexStaffDisplay: React.FC<VexStaffDisplayProps> = ({ notes, currentTime, timeSignature }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const factoryRef = useRef<Factory | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [activeNotePos, setActiveNotePos] = useState<number | null>(null);
  const [totalWidth, setTotalWidth] = useState(1000);
  const [totalDuration, setTotalDuration] = useState(0);
  const [isInitialPlay, setIsInitialPlay] = useState(true);
  const lastScrollTimeRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [scrollStartX, setScrollStartX] = useState(0);
  const [manualScrollMode, setManualScrollMode] = useState(false);

  // Initial render of the score
  useEffect(() => {
    if (!containerRef.current) return;
    
    // Clear previous content
    containerRef.current.innerHTML = '';
    
    // Find the last note to calculate required width
    const lastNoteTime = notes.length > 0 ? 
      Math.max(...notes.map(note => note.time + note.duration)) : 
      0;
    
    // Calculate how many measures we need to display
    const beatsPerMeasure = timeSignature[0];
    const totalMeasures = Math.ceil(lastNoteTime / beatsPerMeasure) + 1; // Add one for safety
    
    // Use MEASURE_WIDTH constant for consistent measure widths
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
      // Create a single stave for all notes
      const stave = system.addStave({
        voices: []
      }).addClef('treble')
        .addTimeSignature(`${timeSignature[0]}/${timeSignature[1]}`);
      
      // Set stave width to accommodate all measures
      stave.setWidth(calculatedWidth - (STAVE_LEFT_PADDING * 2));
      
      // Group notes by time to handle chords
      const groupedNotes = groupNotesByTime(notes, currentTime);
      
      // Create VexFlow notes from our grouped notes
      const vexNotes = createVexflowNotes(groupedNotes);
      
      // Create a voice with the total number of beats
      const voice = new Voice({
        numBeats: beatsPerMeasure * totalMeasures,
        beatValue: timeSignature[1]
      }).setStrict(false);
      
      voice.addTickables(vexNotes);
      
      // Format and draw
      new Formatter()
        .joinVoices([voice])
        .formatToStave([voice], stave);
      
      // Set begin and end barlines
      stave.setBegBarType(Barline.type.SINGLE);
      stave.setEndBarType(Barline.type.END);
      
      // Draw the stave
      stave.draw();
      
      // Draw the notes
      voice.draw(context, stave);

      // Calculate and draw measure barlines based on note timings
      let currentMeasureTime = beatsPerMeasure; // First barline after 3 beats
      let currentX = 0;
      
      // Find x-positions for each note
      const notePositions = vexNotes.map((note, index) => {
        const bbox = note.getBoundingBox();
        return {
          x: bbox.x,
          time: groupedNotes[index].time,
          duration: groupedNotes[index].duration
        };
      });
      
      // Draw barlines at measure boundaries
      while (currentMeasureTime < lastNoteTime) {
        // Find the last note before or at this measure boundary
        const lastNoteInMeasure = notePositions
          .filter(pos => pos.time + pos.duration <= currentMeasureTime)
          .sort((a, b) => b.x - a.x)[0];
        
        if (lastNoteInMeasure) {
          // Place barline just after this note
          const x = lastNoteInMeasure.x + 30; // Add some padding after the note
          
          context.beginPath();
          context.moveTo(x, stave.getYForLine(0));
          context.lineTo(x, stave.getYForLine(4));
          context.setStrokeStyle('#FFFFFF');
          context.setLineWidth(1);
          context.stroke();
        }
        
        currentMeasureTime += beatsPerMeasure;
      }
      
      // Color active notes
      if (containerRef.current) {
        const svg = containerRef.current.querySelector('svg');
        if (svg) {
          // First, reset all notes to default coloring
          const allNotes = svg.querySelectorAll('.vf-stavenote, .vf-notehead');
          allNotes.forEach(note => {
            note.removeAttribute('data-active');
            note.setAttribute('fill', 'rgba(255, 255, 255, 0.8)');
            note.setAttribute('stroke', 'rgba(255, 255, 255, 0.8)');
          });
          
          // Find all StaveNote elements with active notes and modify their paths
          const staveNoteElements = svg.querySelectorAll('.vf-stavenote');
          
          staveNoteElements.forEach((el, index) => {
            const group = groupedNotes[index];
            if (group && isNoteActive(group.time, group.duration, currentTime)) {
              // Set attributes on the group
              el.setAttribute('fill', 'blue');
              el.setAttribute('stroke', 'blue');
              el.setAttribute('data-active', 'true');
              
              // Find and color all paths inside this note
              const paths = el.querySelectorAll('path');
              paths.forEach(path => {
                path.setAttribute('fill', 'blue');
                path.setAttribute('stroke', 'blue');
              });
              
              // Find and color all text elements inside this note (noteheads)
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
            } else {
              // Explicitly set inactive notes to white
              el.setAttribute('fill', 'rgba(255, 255, 255, 0.8)');
              el.setAttribute('stroke', 'rgba(255, 255, 255, 0.8)');
              el.removeAttribute('data-active');
              
              const paths = el.querySelectorAll('path');
              paths.forEach(path => {
                path.setAttribute('fill', 'rgba(255, 255, 255, 0.8)');
                path.setAttribute('stroke', 'rgba(255, 255, 255, 0.8)');
              });
              
              const noteheads = el.querySelectorAll('.vf-notehead');
              noteheads.forEach(notehead => {
                notehead.setAttribute('fill', 'rgba(255, 255, 255, 0.8)');
                notehead.setAttribute('stroke', 'rgba(255, 255, 255, 0.8)');
                notehead.removeAttribute('data-active');
                
                const textElements = notehead.querySelectorAll('text');
                textElements.forEach(text => {
                  text.setAttribute('fill', 'rgba(255, 255, 255, 0.8)');
                  text.style.fill = 'rgba(255, 255, 255, 0.8)';
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
  }, [notes, timeSignature]); // Note: removed currentTime dependency - updating separately for scrolling

  // Effect for handling active note highlighting and scrolling
  useEffect(() => {
    if (!containerRef.current || !scrollContainerRef.current) return;
    
    // Find active note
    const activeNote = notes.find(note => 
      isNoteActive(note.time, note.duration, currentTime)
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
        const groupedNotes = groupNotesByTime(notes, currentTime);
        const staveNoteElements = svg.querySelectorAll('.vf-stavenote');
        
        staveNoteElements.forEach((el, index) => {
          const group = groupedNotes[index];
          if (group && isNoteActive(group.time, group.duration, currentTime)) {  // Use isNoteActive here
            // Set attributes on the group
            el.setAttribute('fill', 'blue');
            el.setAttribute('stroke', 'blue');
            el.setAttribute('data-active', 'true');
            
            // Find and color all paths inside this note
            const paths = el.querySelectorAll('path');
            paths.forEach(path => {
              path.setAttribute('fill', 'blue');
              path.setAttribute('stroke', 'blue');
            });
            
            // Find and color all text elements inside this note (noteheads)
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
      
      // Scrolling logic - only if not in manual scroll mode
      if (position !== null && !manualScrollMode) {
        // Continue showing the beginning until the active note reaches the middle
        const containerWidth = scrollContainerRef.current.clientWidth;
        const middlePoint = containerWidth / 2;
        
        // If the active note is past the middle or we're no longer in initial play
        if (position > middlePoint || !isInitialPlay) {
          setIsInitialPlay(false);
          
          // Calculate the scroll position to center the active note
          const scrollPos = position - middlePoint;
          
          // Smooth scrolling with animation
          const now = Date.now();
          if (now - lastScrollTimeRef.current > 50) { // Limit scroll updates
            lastScrollTimeRef.current = now;
            scrollContainerRef.current.scrollTo({
              left: Math.max(0, scrollPos),
              behavior: 'smooth'
            });
          }
        }
      }
    }
  }, [currentTime, notes, totalWidth, totalDuration, isInitialPlay, manualScrollMode]);

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
      const dx = e.clientX - dragStartX;
      scrollContainerRef.current.scrollLeft = scrollStartX - dx;
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
      scrollContainerRef.current.scrollLeft = scrollStartX - dx;
    }
  }, [isDragging, dragStartX, scrollStartX]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Toggle between auto-scroll and manual mode on double click
  const handleDoubleClick = useCallback(() => {
    setManualScrollMode(!manualScrollMode);
  }, [manualScrollMode]);

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
        {manualScrollMode && (
          <div className="manual-scroll-indicator">Manual Scroll</div>
        )}
      </div>
    </div>
  );
};

export default VexStaffDisplay;
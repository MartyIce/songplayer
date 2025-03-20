import React, { useEffect, useRef } from 'react';
import { Factory, Voice, StaveNote, Formatter, Barline } from 'vexflow';
import { Note } from '../types/SongTypes';
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
}

// Constants
const TUNING = ['E2', 'A2', 'D3', 'G3', 'B3', 'E4']; // Standard guitar tuning
const ACTIVE_NOTE_COLOR = '#FF0000'; // Bright red for active notes
const INACTIVE_NOTE_COLOR = '#FFFFFF'; // White for inactive notes
const TIMING_TOLERANCE = 0.05; // 50ms tolerance for timing

/**
 * Converts string/fret to pitch note
 */
function getPitchFromTab(stringNum: number, fret: number): string {
  const baseNote = TUNING[stringNum - 1];
  const noteName = baseNote.slice(0, -1);
  const octave = parseInt(baseNote.slice(-1));
  
  // Calculate semitones from base note
  const semitones = fret;
  
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
 * Checks if a note is active at the current time
 */
function isNoteActive(noteTime: number, noteDuration: number, currentTime: number): boolean {
  return (
    noteTime - TIMING_TOLERANCE <= currentTime && 
    currentTime < noteTime + noteDuration + TIMING_TOLERANCE
  );
}

/**
 * Groups notes that occur at the same time (chords)
 */
function groupNotesByTime(visibleNotes: Note[], currentTime: number): GroupedNote[] {
  const groupedNotes: GroupedNote[] = [];
  
  visibleNotes.forEach(note => {
    const pitch = 'note' in note ? note.note : getPitchFromTab(note.string, note.fret);
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
  
  return groupedNotes;
}

/**
 * Creates VexFlow stave notes from grouped notes
 */
function createVexflowNotes(groupedNotes: GroupedNote[]): StaveNote[] {
  const vexNotes = groupedNotes.map(group => {
    const duration = getVexflowDuration(group.duration);
    
    // Format keys for VexFlow (e.g., "C4" becomes "c/4")
    const keys = group.notes.map(note => {
      const noteName = note.slice(0, -1);
      const octave = parseInt(note.slice(-1)) + 2;
      return `${noteName.toLowerCase()}/${octave}`;
    });
    
    // Create the note
    const staveNote = new StaveNote({
      keys,
      duration,
      autoStem: true
    });
    
    // Apply coloring if note is active
    if (group.active) {
      // Apply color to the entire note with strong styling
      staveNote.setStyle({
        fillStyle: 'blue',
        strokeStyle: 'blue'
      });
      
      // Set direct SVG attributes to ensure CSS selectors work
      try {
        // Access the base element and set attributes
        (staveNote as any).setAttribute('fill', 'blue');
        (staveNote as any).setAttribute('stroke', 'blue');
        (staveNote as any).setAttribute('data-active', 'true');
        
        // Try to access the note's element class
        if ((staveNote as any).getElem) {
          const elem = (staveNote as any).getElem();
          if (elem) {
            elem.setAttribute('fill', 'blue');
            elem.setAttribute('stroke', 'blue');
            elem.setAttribute('data-active', 'true');
          }
        }
      } catch (e) {
        console.log('Could not set attributes directly:', e);
      }
      
      // Color each notehead in the chord with strong styling
      for (let i = 0; i < keys.length; i++) {
        staveNote.setKeyStyle(i, { 
          shadowBlur: 2, 
          shadowColor: 'blue', 
          fillStyle: 'blue',
          strokeStyle: 'blue'
        });
        
        // Try to access the Vex.Flow.NoteHead directly if possible
        try {
          // Different versions of VexFlow have different ways to access noteheads
          const note = staveNote as any;
          
          // Try common methods to access noteheads
          const notehead = 
            (note.getKeyProps && note.getKeyProps()[i]?.notehead) || 
            (note.note_heads && note.note_heads[i]) ||
            (note.noteHeads && note.noteHeads[i]);
          
          if (notehead && notehead.style) {
            // Apply styling directly to the notehead
            notehead.style.fillStyle = 'blue';
            notehead.style.strokeStyle = 'blue';
          }
        } catch (e) {
          console.log('Could not directly style notehead:', e);
        }
      }
      
      console.log('Active note:', { time: group.time, duration: group.duration, keys });
    }
    
    return staveNote;
  });
  
  // If no notes, add a whole rest
  if (vexNotes.length === 0) {
    vexNotes.push(new StaveNote({
      keys: ['b/4'],
      duration: 'wr',
      autoStem: true
    }));
  }
  
  return vexNotes;
}

const VexStaffDisplay: React.FC<VexStaffDisplayProps> = ({ notes, currentTime, timeSignature }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const factoryRef = useRef<Factory | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    
    // Clear previous content
    containerRef.current.innerHTML = '';
    
    // Initialize VexFlow
    const factory = new Factory({
      renderer: {
        elementId: containerRef.current.id || 'vf-container',
        width: 1200,
        height: 150,
        background: '#1a1a1a'
      }
    });
    
    const context = factory.getContext();
    const system = factory.System();
    
    try {
      // Calculate display parameters
      const beatsPerMeasure = timeSignature[0];
      const currentMeasure = Math.floor(currentTime / beatsPerMeasure);
      const measuresToShow = 3;
      
      // Filter notes to show only those in the visible measures
      const startTime = currentMeasure * beatsPerMeasure;
      const endTime = (currentMeasure + measuresToShow) * beatsPerMeasure;
      
      const visibleNotes = notes
        .filter(note => note.time >= startTime && note.time < endTime)
        .sort((a, b) => a.time - b.time);
      
      // Group notes by time to handle chords
      const groupedNotes = groupNotesByTime(visibleNotes, currentTime);
      
      // Create a single stave
      const stave = system.addStave({
        voices: []
      }).addClef('treble')
        .addTimeSignature(`${timeSignature[0]}/${timeSignature[1]}`);
      
      // Set stave width
      stave.setWidth(1100);
      
      // Add barlines at measure positions
      const measureWidth = stave.getWidth() / measuresToShow;
      for (let i = 1; i < measuresToShow; i++) {
        const x = measureWidth * i;
        const barline = new Barline(Barline.type.SINGLE);
        stave.addModifier(barline, x);
      }
      
      // Create VexFlow notes from our grouped notes
      const vexNotes = createVexflowNotes(groupedNotes);
      
      // Create a voice with the total number of beats
      const voice = new Voice({
        numBeats: timeSignature[0] * measuresToShow,
        beatValue: timeSignature[1]
      }).setStrict(false);
      
      voice.addTickables(vexNotes);
      
      // Format and draw
      new Formatter()
        .joinVoices([voice])
        .formatToStave([voice], stave);
      
      stave.draw();
      voice.draw(context, stave);
      
      // Direct SVG modification for active notes
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
            if (group && group.active) {
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
                
                // Get all text elements inside the notehead
                const textElements = notehead.querySelectorAll('text');
                textElements.forEach(text => {
                  text.setAttribute('fill', 'blue');
                  text.style.fill = 'blue';
                });
              });
              
              console.log('Directly colored note and text:', index);
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
  }, [notes, currentTime, timeSignature]);

  return (
    <div className="vex-staff-display">
      <div id="vf-container" ref={containerRef} />
    </div>
  );
};

export default VexStaffDisplay;
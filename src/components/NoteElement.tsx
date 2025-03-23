import React, { useMemo, useCallback } from 'react';
import * as Tone from 'tone';
import { StringFretNote } from '../types/SongTypes';
import './NoteElement.css';

interface NoteElementProps {
  note: StringFretNote;
  currentTime: number;
}

// Standard guitar tuning (written pitch, high to low)
const TUNING = ['E5', 'B4', 'G4', 'D4', 'A3', 'E3'];

const NoteElement: React.FC<NoteElementProps> = ({ note, currentTime }) => {
  // Initialize synth
  const synth = useMemo(() => {
    const s = new Tone.Synth().toDestination();
    return s;
  }, []);

  // Calculate note frequency from string and fret
  const getNoteFrequency = useCallback((stringNum: number, fret: number) => {
    const baseNote = TUNING[stringNum - 1];
    return Tone.Frequency(baseNote).transpose(fret).toFrequency();
  }, []);

  // Handle click to play note
  const handleClick = useCallback(() => {
    const frequency = getNoteFrequency(note.string, note.fret);
    // Play the note for 1 second
    synth.triggerAttackRelease(frequency, 1);
  }, [note.string, note.fret, synth, getNoteFrequency]);

  // Calculate position and width based on time and duration
  const noteStyle = useMemo(() => {
    // The trigger line is at 50% of the screen width
    const triggerLinePosition = 50;
    
    // Slow down the scroll rate - notes move at 40px per second 
    const pixelsPerSecond = 40;
    
    // Calculate the time difference between the note's time and current time
    const timeDiff = note.time - currentTime;
    
    // Calculate the width proportionally to the duration, but scaled for visual clarity
    // This ensures the width accurately represents the duration
    const width = note.duration * pixelsPerSecond * 2;
    
    // Calculate the horizontal position (left edge of the note)
    // When timeDiff is 0, the LEFT EDGE of the note should be at the trigger line
    const xPosition = triggerLinePosition + (timeDiff * pixelsPerSecond / 5);
    
    // Calculate vertical position based on string number
    // Each string has a height of approximately 66.67px (400px / 6 strings)
    // String 1 (high E) at the bottom, String 6 (low E) at the top
    const stringHeight = 66.67;
    const yPosition = (note.string - 1) * stringHeight + (stringHeight / 2);
    
    return {
      left: `${xPosition}%`,
      top: `${yPosition}px`,
      width: `${width}px`,
      backgroundColor: note.color || '#61dafb',
      cursor: 'pointer', // Add pointer cursor to indicate clickability
    };
  }, [note.time, note.duration, note.string, note.color, currentTime]);
  
  // Determine if the note is active (being played) - exact time matching
  const isActive = note.time <= currentTime && note.time + note.duration > currentTime;
  
  // Determine if the note is past (already played)
  const isPast = note.time + note.duration <= currentTime;
  
  // Calculate how much of the note has been played (for the progress indicator)
  const progressPercentage = useMemo(() => {
    if (currentTime <= note.time) return 0;
    if (currentTime >= note.time + note.duration) return 100;
    
    return ((currentTime - note.time) / note.duration) * 100;
  }, [currentTime, note.time, note.duration]);
  
  return (
    <div 
      className={`note-element ${isActive ? 'active' : ''} ${isPast ? 'past' : ''}`}
      style={noteStyle}
      onClick={handleClick}
    >
      <div className="note-content">
        <span className="fret-number">{note.fret}</span>
      </div>
      {isActive && (
        <div 
          className="progress-indicator" 
          style={{ width: `${progressPercentage}%` }}
        />
      )}
    </div>
  );
};

export default NoteElement; 
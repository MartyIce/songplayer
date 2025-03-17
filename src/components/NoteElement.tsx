import React, { useMemo } from 'react';
import { Note } from '../types/SongTypes';
import './NoteElement.css';

interface NoteElementProps {
  note: Note;
  currentTime: number;
}

const NoteElement: React.FC<NoteElementProps> = ({ note, currentTime }) => {
  // Calculate position based on time
  // Notes start from the right side of the screen and move to the left
  const position = useMemo(() => {
    // The trigger line is at 100px from the left
    const triggerLinePosition = 100;
    
    // Notes move at a speed of 100px per second
    const pixelsPerSecond = 100;
    
    // Calculate the time difference between the note's time and current time
    const timeDiff = note.time - currentTime;
    
    // Calculate the horizontal position
    // When timeDiff is 0, the note should be at the trigger line
    const xPosition = triggerLinePosition + (timeDiff * pixelsPerSecond);
    
    return {
      left: `${xPosition}px`,
    };
  }, [note.time, currentTime]);
  
  // Determine if the note is active (being played)
  const isActive = note.time <= currentTime && note.time + note.duration > currentTime;
  
  // Calculate vertical position based on string number
  // Each string has a height of approximately 50px (300px / 6 strings)
  const stringHeight = 50;
  const yPosition = (note.string - 1) * stringHeight + (stringHeight / 2);
  
  return (
    <div 
      className={`note-element ${isActive ? 'active' : ''}`}
      style={{
        ...position,
        top: `${yPosition}px`,
        backgroundColor: note.color || '#61dafb',
      }}
    >
      <span className="fret-number">{note.fret}</span>
    </div>
  );
};

export default NoteElement; 
import React, { useMemo, useCallback } from 'react';
import * as Tone from 'tone';
import { StringFretNote } from '../types/SongTypes';
import './NoteElement.css';

interface NoteElementProps {
  note: StringFretNote;
  currentTime: number;
}

// Standard guitar tuning (actual sounding pitches, high to low)
const TUNING = ['E4', 'B3', 'G3', 'D3', 'A2', 'E2'];

const NoteElement: React.FC<NoteElementProps> = ({ note, currentTime }) => {
  // Calculate position and width based on time and duration
  const noteStyle = useMemo(() => {
    // The trigger line is at 50% of the viewport width to match the red line
    const triggerLinePosition = 50;
    
    // Calculate the time difference between the note's time and current time
    const timeDiff = note.time - currentTime;
    
    // Calculate the width proportionally to the duration
    // Using viewport width units for consistent sizing
    const baseVwPerBeat = 10; // 10vw per beat
    
    // Calculate width based on note duration in beats
    const width = note.duration * baseVwPerBeat;
    
    // Calculate position based on time in beats
    const xPosition = triggerLinePosition + (timeDiff * baseVwPerBeat);
    
    // Calculate vertical position based on string number
    const stringHeight = 66.67;
    const yPosition = (note.string - 1) * stringHeight + (stringHeight / 2);

    // Calculate opacity based on note duration and current time
    let opacity = 1;
    const noteEndTime = note.time + note.duration;
    if (currentTime > noteEndTime) {
      opacity = Math.max(0, 1 - (currentTime - noteEndTime));
    }
    
    return {
      left: `${xPosition}vw`,
      top: `${yPosition}px`,
      width: `${width}vw`,
      backgroundColor: note.color || '#61dafb',
      opacity,
      cursor: 'pointer',
    };
  }, [note.time, note.duration, note.string, note.color, currentTime]);
  
  // Determine if the note is active (being played)
  const isActive = useMemo(() => {
    // Calculate the note's center position relative to the trigger line
    const triggerLinePosition = 50; // Match the visual trigger line
    const baseVwPerBeat = 10;
    const timeDiff = note.time - currentTime;
    const notePosition = triggerLinePosition + (timeDiff * baseVwPerBeat);
    
    // Note is active when its center crosses the trigger line
    const isCrossingTriggerLine = Math.abs(notePosition - triggerLinePosition) < 1;
    return isCrossingTriggerLine;
  }, [note.time, currentTime]);
  
  // Determine if the note is past (already played)
  const isPast = useMemo(() => {
    return note.time < currentTime;
  }, [note.time, currentTime]);
  
  // Calculate progress percentage
  const progressPercentage = useMemo(() => {
    if (currentTime <= note.time) return 0;
    if (currentTime >= note.time + note.duration) return 100;
    return ((currentTime - note.time) / note.duration) * 100;
  }, [note.time, note.duration, currentTime]);

  // Handle click to play note
  const handleClick = useCallback(() => {
    const frequency = Tone.Frequency(TUNING[note.string - 1]).transpose(note.fret).toFrequency();
    const synth = new Tone.Synth().toDestination();
    synth.triggerAttackRelease(frequency, 1);
    setTimeout(() => synth.dispose(), 2000); // Clean up synth after note finishes
  }, [note.string, note.fret]);
  
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
import React, { useMemo, useEffect, useRef, useState, useCallback } from 'react';
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // Set up resize observer to handle container width changes
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current.closest('.tablature-display');
    if (!container) return;

    setContainerWidth(container.clientWidth);

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Calculate position and width based on time and duration
  const noteStyle = useMemo(() => {
    // Get the trigger line position in pixels (50% of container width)
    const triggerLinePosition = containerWidth * 0.5;
    
    // Calculate the time difference between the note's time and current time
    const timeDiff = note.time - currentTime;
    
    // Use fixed pixel units instead of viewport units for consistent sizing
    const basePixelsPerBeat = 100; // 100px per beat
    
    // Calculate width based on note duration in beats
    const width = note.duration * basePixelsPerBeat;
    
    // Calculate position based on time in beats
    const xPosition = triggerLinePosition + (timeDiff * basePixelsPerBeat);
    
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
      left: `${xPosition}px`,
      top: `${yPosition}px`,
      width: `${width}px`,
      backgroundColor: note.color || '#61dafb',
      opacity,
      cursor: 'pointer',
    };
  }, [note.time, note.duration, note.string, note.color, currentTime, containerWidth]);
  
  // Determine if the note is active (being played)
  const isActive = useMemo(() => {
    // Calculate the note's center position relative to the trigger line
    const triggerLinePosition = 50; // Match the visual trigger line
    const basePixelsPerBeat = 100;
    const timeDiff = note.time - currentTime;
    const notePosition = triggerLinePosition + (timeDiff * basePixelsPerBeat);
    
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
    synth.triggerAttackRelease(frequency, "8n");
  }, [note.string, note.fret]);
  
  return (
    <div 
      className={`note-element ${isActive ? 'active' : ''} ${isPast ? 'past' : ''}`}
      style={noteStyle}
      onClick={handleClick}
      ref={containerRef}
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
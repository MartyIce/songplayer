import React, { useMemo, useEffect, useRef, useCallback } from 'react';
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
  
  useEffect(() => {
    // Keep the ref for potential future use, but no need to track width
    const updateContainerWidth = () => {
      // No need to set state that's not used
    };

    // Initial setup
    updateContainerWidth();

    // Add a small delay to ensure the container is properly rendered
    const timeoutId = setTimeout(updateContainerWidth, 100);

    return () => clearTimeout(timeoutId);
  }, []);

  // Determine if the note is active (being played)
  const isActive = useMemo(() => {
    return currentTime >= note.time && currentTime <= note.time + note.duration;
  }, [note.time, note.duration, currentTime]);
  
  // Determine if the note is past (already played)
  const isPast = useMemo(() => {
    return currentTime > note.time + note.duration;
  }, [note.time, note.duration, currentTime]);

  // Calculate position and width based on time and duration
  const noteStyle = useMemo(() => {
    const basePixelsPerBeat = 60; // Match the parent component
    
    // Calculate width based on note duration in beats
    const width = note.duration * basePixelsPerBeat;
    
    // Calculate position based on time in beats
    const xPosition = note.time * basePixelsPerBeat + 20; // Add left padding
    
    // Calculate vertical position based on string number (1-6)
    // With flex layout, we need to calculate the position differently
    // The container height is 280px with 40px padding top and bottom, leaving 200px for 6 strings
    // Each string position is evenly distributed across 200px (the string-container's content area)
    const containerHeight = 280;
    const paddingTop = 40;
    const contentHeight = containerHeight - (paddingTop * 2);
    const stringSpacing = contentHeight / 5; // 5 spaces for 6 strings
    const yPosition = paddingTop + ((note.string - 1) * stringSpacing);
    
    return {
      left: `${xPosition}px`,
      top: `${yPosition}px`,
      width: `${width}px`,
      height: '30px',
      backgroundColor: isActive ? '#61dafb' : 'rgba(97, 218, 251, 0.5)',
      opacity: isPast ? 0.5 : 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: '4px',
      position: 'absolute' as const,
      transform: 'translateY(-15px)', // Center vertically on the string
      zIndex: isActive ? 2 : 1,
      color: '#000',
      fontWeight: 'bold',
      fontSize: '14px',
      cursor: 'default',
      userSelect: 'none' as const,
      boxShadow: isActive ? '0 0 8px rgba(97, 218, 251, 0.8)' : 'none',
    };
  }, [note.time, note.duration, note.string, isActive, isPast]);

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
          style={{ width: `${((currentTime - note.time) / note.duration) * 100}%` }}
        />
      )}
    </div>
  );
};

export default NoteElement; 
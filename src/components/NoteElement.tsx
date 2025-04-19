import React from 'react';
import { StringFretNote } from '../types/SongTypes';
import { useZoom } from '../contexts/ZoomContext';

interface NoteElementProps {
  note: StringFretNote;
  currentTime: number;
  scale?: number;
  containerHeight?: number; // Add container height prop for dynamic spacing
}

// Remove or comment out the unused TUNING constant
// const TUNING = ['E4', 'B3', 'G3', 'D3', 'A2', 'E2']; // Standard guitar tuning

const NoteElement: React.FC<NoteElementProps> = ({ 
  note, 
  currentTime, 
  scale = 1,
  containerHeight 
}) => {
  const { zoomLevel } = useZoom();
  const basePixelsPerBeat = 60 * zoomLevel;
  const isActive = currentTime >= note.time && currentTime < note.time + note.duration;
  
  // Calculate scaled dimensions - matching GuitarString values
  const baseHeight = 30;
  const scaledHeight = baseHeight * scale;
  const basePaddingTop = 20; // Match GuitarString paddingTop
  const scaledPaddingTop = basePaddingTop * scale;
  const baseStringSpacing = 40; // Match GuitarString baseStringSpacing
  
  // Calculate dynamic string spacing if container height is provided
  let scaledStringSpacing = baseStringSpacing * scale;
  if (containerHeight) {
    // Calculate available space for 6 strings (accounting for top and bottom padding)
    const availableHeight = containerHeight - (basePaddingTop * 2 * scale);
    // Calculate optimal string spacing to fit all strings
    const optimalSpacing = availableHeight / 5; // 5 spaces between 6 strings
    scaledStringSpacing = optimalSpacing;
  }

  const style: React.CSSProperties = {
    position: 'absolute',
    left: `${note.time * basePixelsPerBeat + 20}px`,
    top: `${scaledPaddingTop + (note.string - 1) * scaledStringSpacing}px`,
    width: `${note.duration * basePixelsPerBeat}px`,
    height: `${scaledHeight}px`,
    transform: `translateY(-${scaledHeight / 2}px)`,
    backgroundColor: isActive ? '#c28738' : 'rgba(151, 114, 63, 0.7)',
    zIndex: isActive ? 2 : 1,
    boxShadow: isActive ? '0 0 8px rgba(255, 154, 0, 0.7)' : '0 2px 4px rgba(0, 0, 0, 0.3)',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontWeight: 'bold',
    transition: 'background-color 0.2s ease, opacity 0.2s ease',
  };

  return (
    <div className={`note-element ${isActive ? 'active' : ''}`} style={style}>
      {note.fret}
    </div>
  );
};

export default NoteElement; 
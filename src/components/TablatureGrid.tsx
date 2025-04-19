import React from 'react';

interface TablatureGridProps {
  songDuration: number;
  basePixelsPerBeat: number;
  scale?: number; // Optional scale factor
}

export const TablatureGrid: React.FC<TablatureGridProps> = ({
  songDuration,
  basePixelsPerBeat,
  scale = 1 // Default scale is 1
}) => {
  const gridLines = [];
  
  // Constants for grid layout - scaled by the scale factor
  const baseContainerHeight = 280;
  const basePaddingTop = 40;
  const containerHeight = baseContainerHeight * scale;
  const paddingTop = basePaddingTop * scale;
  const contentHeight = containerHeight - (paddingTop * 2);
  const stringSpacing = contentHeight / 5; // 5 spaces for 6 strings
  
  // Horizontal lines (for strings)
  for (let i = 0; i < 6; i++) {
    const yPosition = paddingTop + (i * stringSpacing);
    gridLines.push(
      <div 
        key={`h-${i}`} 
        className="grid-line horizontal" 
        style={{ 
          top: `${yPosition}px`,
          opacity: 0.15
        }}
      />
    );
  }
  
  // Vertical lines (time markers)
  const linesPerBeat = 1;
  const totalBeats = Math.ceil(songDuration);
  const totalLines = totalBeats * linesPerBeat;
  
  for (let i = 0; i <= totalLines; i++) {
    const xPosition = i * basePixelsPerBeat + 20;
    gridLines.push(
      <div 
        key={`v-${i}`} 
        className="grid-line vertical" 
        style={{ 
          left: `${xPosition}px`,
          opacity: 0.15,
          height: `${containerHeight}px` // Apply scaled height to vertical lines
        }}
      />
    );
  }
  
  return <div className="grid-lines" style={{ height: `${containerHeight}px` }}>{gridLines}</div>;
}; 
import React from 'react';

interface TablatureGridProps {
  songDuration: number;
  basePixelsPerBeat: number;
}

export const TablatureGrid: React.FC<TablatureGridProps> = ({
  songDuration,
  basePixelsPerBeat
}) => {
  const gridLines = [];
  
  // Constants for grid layout
  const containerHeight = 280;
  const paddingTop = 40;
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
          opacity: 0.15
        }}
      />
    );
  }
  
  return <div className="grid-lines">{gridLines}</div>;
}; 
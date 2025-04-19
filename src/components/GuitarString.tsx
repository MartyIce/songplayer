import React from 'react';
import './GuitarString.css';

interface GuitarStringProps {
  stringNumber: number;
  scale?: number;
  isMobile?: boolean;
}

const STANDARD_TUNING = ['E4', 'B3', 'G3', 'D3', 'A2', 'E2'];

export const GuitarString: React.FC<GuitarStringProps> = ({ 
  stringNumber, 
  scale = 1,
  isMobile = false
}) => {
  const baseStringSpacing = 40;
  const scaledStringSpacing = baseStringSpacing * scale;
  const paddingTop = 20;
  const scaledPaddingTop = paddingTop * scale;

  // Calculate string thickness based on string number (thicker for lower strings)
  const thickness = Math.min(4, 1 + (stringNumber - 1) * 0.5);
  
  // Calculate string color (darker for lower strings)
  const brightness = Math.max(60, 100 - (stringNumber - 1) * 8);
  const stringColor = `hsl(45, 40%, ${brightness}%)`;

  const style: React.CSSProperties = {
    position: 'absolute',
    top: `${scaledPaddingTop + (stringNumber - 1) * scaledStringSpacing}px`,
    height: `${thickness}px`,
    backgroundColor: stringColor,
  };

  return (
    <div 
      className={`guitar-string ${isMobile ? 'mobile-string' : ''}`} 
      style={style}
    >
      <div className="string-label">{stringNumber}</div>
      <div className="string-tuning">{STANDARD_TUNING[stringNumber - 1]}</div>
    </div>
  );
}; 
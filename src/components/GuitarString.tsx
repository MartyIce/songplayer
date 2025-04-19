import React, { useEffect, useState } from 'react';
import './GuitarString.css';

interface GuitarStringProps {
  stringNumber: number;
  scale?: number;
  isMobile?: boolean;
  containerHeight?: number; // Optional container height for dynamic sizing
}

const STANDARD_TUNING = ['E4', 'B3', 'G3', 'D3', 'A2', 'E2'];

export const GuitarString: React.FC<GuitarStringProps> = ({ 
  stringNumber, 
  scale = 1,
  isMobile = false,
  containerHeight
}) => {
  const [dynamicSpacing, setDynamicSpacing] = useState<number | null>(null);
  
  // Base values before scaling
  const baseStringSpacing = 40;
  const paddingTop = 20;

  // Use container height to calculate dynamic spacing if provided
  useEffect(() => {
    if (containerHeight && isMobile) {
      // Calculate available space for 6 strings (accounting for top and bottom padding)
      const availableHeight = containerHeight - (paddingTop * 2 * scale);
      // Calculate optimal string spacing to fit all strings
      const optimalSpacing = availableHeight / 5; // 5 spaces between 6 strings
      setDynamicSpacing(optimalSpacing);
    } else {
      setDynamicSpacing(null);
    }
  }, [containerHeight, scale, isMobile]);

  // Use dynamic spacing if available, otherwise use the scaled default
  const scaledStringSpacing = dynamicSpacing || (baseStringSpacing * scale);
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

  const tuningNote = STANDARD_TUNING[stringNumber - 1];

  return (
    <div 
      className={`guitar-string ${isMobile ? 'mobile-string' : ''}`} 
      style={style}
    >
      <div className="string-label">{tuningNote}</div>
      <div className="string-tuning">{tuningNote}</div>
    </div>
  );
}; 
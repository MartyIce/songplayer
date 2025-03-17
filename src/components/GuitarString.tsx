import React from 'react';
import './GuitarString.css';

interface GuitarStringProps {
  stringNumber: number;
}

const GuitarString: React.FC<GuitarStringProps> = ({ stringNumber }) => {
  // Calculate string thickness based on string number (1-6)
  // String 1 is thinnest, String 6 is thickest
  const thickness = 1 + (stringNumber - 1) * 0.5;
  
  return (
    <div 
      className="guitar-string"
      style={{ 
        height: `${thickness}px`,
        opacity: 0.7 + (stringNumber * 0.05)
      }}
      data-string={stringNumber}
    >
      <div className="string-label">{stringNumber}</div>
    </div>
  );
};

export default GuitarString; 
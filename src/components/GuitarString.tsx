import React from 'react';
import './GuitarString.css';

interface GuitarStringProps {
  stringNumber: number;
}

const GuitarString: React.FC<GuitarStringProps> = ({ stringNumber }) => {
  // Standard tuning notes from highest to lowest
  const tunings = ['E4', 'B3', 'G3', 'D3', 'A2', 'E2'];
  const tuning = tunings[stringNumber - 1];
  
  return (
    <div 
      className="guitar-string"
      style={{ 
        height: '2px',
        backgroundColor: '#000',  // Make strings black
        opacity: 0.9,  // Make strings more visible
        boxShadow: '0 0 2px rgba(0, 0, 0, 0.5)'  // Add subtle glow
      }}
      data-string={stringNumber}
    >
      <div className="string-label">{stringNumber}</div>
      <div className="string-tuning">{tuning}</div>
    </div>
  );
};

export default GuitarString; 
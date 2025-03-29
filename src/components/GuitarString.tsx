import React from 'react';
import './GuitarString.css';

interface GuitarStringProps {
  stringNumber: number;
}

const GuitarString: React.FC<GuitarStringProps> = ({ stringNumber }) => {
  // Standard tuning notes from highest to lowest
  const tunings = ['E4', 'B3', 'G3', 'D3', 'A2', 'E2'];
  const tuning = tunings[stringNumber - 1];
  
  // Adjust string thickness based on string number (thicker for bass strings)
  const getStringThickness = (stringNum: number) => {
    switch(stringNum) {
      case 1: return 1; // Thinnest (high E)
      case 2: return 1.3;
      case 3: return 1.6;
      case 4: return 2;
      case 5: return 2.5;
      case 6: return 3; // Thickest (low E)
      default: return 2;
    }
  };
  
  // Adjust string color based on string number (first 3 are nylon, last 3 are wound)
  const getStringColor = (stringNum: number) => {
    return stringNum <= 3 
      ? '#e0d6a9' // Brighter nylon color for high strings
      : '#c0a478'; // Darker wound string color for bass strings
  };
  
  return (
    <div 
      className="guitar-string"
      style={{ 
        height: `${getStringThickness(stringNumber)}px`,
        backgroundColor: getStringColor(stringNumber),
        opacity: 0.9,
        boxShadow: `0 0 ${getStringThickness(stringNumber)}px rgba(0, 0, 0, 0.5)`
      }}
      data-string={stringNumber}
    >
      <div className="string-label">{stringNumber}</div>
      <div className="string-tuning">{tuning}</div>
    </div>
  );
};

export default GuitarString; 
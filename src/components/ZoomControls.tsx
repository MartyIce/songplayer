import React from 'react';
import { useZoom } from '../contexts/ZoomContext';
import './ZoomControls.css';

const ZoomControls: React.FC = () => {
  const { zoomLevel, increaseZoom, decreaseZoom } = useZoom();

  return (
    <div className="zoom-controls">
      <button 
        onClick={decreaseZoom}
        disabled={zoomLevel <= 0.4}
        title="Zoom Out"
      >
        -
      </button>
      <span className="zoom-level">{Math.round(zoomLevel * 100)}%</span>
      <button 
        onClick={increaseZoom}
        disabled={zoomLevel >= 2}
        title="Zoom In"
      >
        +
      </button>
    </div>
  );
};

export default ZoomControls; 
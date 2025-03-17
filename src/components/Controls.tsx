import React from 'react';
import './Controls.css';

interface ControlsProps {
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
}

const Controls: React.FC<ControlsProps> = ({
  isPlaying,
  onPlay,
  onPause,
  onStop,
  speed,
  onSpeedChange
}) => {
  const handleSpeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSpeed = parseFloat(e.target.value);
    onSpeedChange(newSpeed);
  };
  
  return (
    <div className="controls">
      <div className="control-buttons">
        {!isPlaying ? (
          <button className="control-btn play-btn" onClick={onPlay}>
            <span className="icon">▶</span> Play
          </button>
        ) : (
          <button className="control-btn pause-btn" onClick={onPause}>
            <span className="icon">⏸</span> Pause
          </button>
        )}
        <button className="control-btn stop-btn" onClick={onStop}>
          <span className="icon">⏹</span> Stop
        </button>
      </div>
      
      <div className="speed-control">
        <label htmlFor="speed-slider">Speed: {speed.toFixed(1)}x</label>
        <input
          id="speed-slider"
          type="range"
          min="0.5"
          max="2"
          step="0.1"
          value={speed}
          onChange={handleSpeedChange}
        />
      </div>
    </div>
  );
};

export default Controls; 
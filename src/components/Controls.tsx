import React from 'react';
import './Controls.css';
import { GuitarType } from '../utils/GuitarSampler';

interface ControlsProps {
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
  currentTime?: number;
  songDuration?: number;
  guitarType: GuitarType;
  onGuitarTypeChange: (type: GuitarType) => void;
}

const Controls: React.FC<ControlsProps> = ({
  isPlaying,
  onPlay,
  onPause,
  onStop,
  speed,
  onSpeedChange,
  currentTime = 0,
  songDuration = 0,
  guitarType,
  onGuitarTypeChange
}) => {
  const handleSpeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSpeed = parseFloat(e.target.value);
    onSpeedChange(newSpeed);
  };

  const handleGuitarChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onGuitarTypeChange(e.target.value as GuitarType);
  };
  
  // Format time as MM:SS
  const formatTime = (timeInSeconds: number) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
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
      
      <div className="time-display">
        <span>{formatTime(currentTime)}</span>
        {songDuration > 0 && (
          <span> / {formatTime(songDuration)}</span>
        )}
      </div>

      <div className="guitar-control">
        <label htmlFor="guitar-select">Guitar Type:</label>
        <select
          id="guitar-select"
          value={guitarType}
          onChange={handleGuitarChange}
          className="guitar-select"
        >
          <option value="acoustic">Acoustic</option>
          <option value="electric">Electric</option>
          <option value="nylon">Nylon</option>
        </select>
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
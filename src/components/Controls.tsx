import React from 'react';
import './Controls.css';
import { GuitarType } from '../utils/GuitarSampler';

interface ControlsProps {
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  bpm: number;
  onBpmChange: (bpm: number) => void;
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
  bpm,
  onBpmChange,
  currentTime = 0,
  songDuration = 0,
  guitarType,
  onGuitarTypeChange
}) => {
  const handleBpmChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newBpm = parseFloat(e.target.value);
    onBpmChange(newBpm);
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

  // Calculate slider background gradient
  const getSliderBackground = () => {
    const min = 40;
    const max = 240;
    const percentage = ((bpm - min) / (max - min)) * 100;
    return `linear-gradient(to right, #61dafb 0%, #61dafb ${percentage}%, #444 ${percentage}%, #444 100%)`;
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
      
      <div className="tempo-control">
        <label htmlFor="tempo-slider">Tempo: {bpm} BPM</label>
        <input
          id="tempo-slider"
          type="range"
          min="40"
          max="240"
          step="1"
          value={bpm}
          onChange={handleBpmChange}
          style={{ background: getSliderBackground() }}
        />
      </div>
    </div>
  );
};

export default Controls; 
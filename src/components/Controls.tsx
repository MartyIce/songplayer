import React from 'react';
import './Controls.css';
import { GuitarType } from '../utils/GuitarSampler';

interface ControlsProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  onStop: () => void;
  currentTime: number;
  duration: number;
  tempo: number;
  onTempoChange: (newTempo: number) => void;
  guitarType: GuitarType;
  onGuitarTypeChange: (type: GuitarType) => void;
  metronomeEnabled: boolean;
  onMetronomeChange: (enabled: boolean) => void;
  isMuted: boolean;
  onMuteChange: (muted: boolean) => void;
}

const Controls: React.FC<ControlsProps> = ({
  isPlaying,
  onPlayPause,
  onStop,
  currentTime,
  duration,
  tempo,
  onTempoChange,
  guitarType,
  onGuitarTypeChange,
  metronomeEnabled,
  onMetronomeChange,
  isMuted,
  onMuteChange,
}) => {
  const handleBpmChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newBpm = parseFloat(e.target.value);
    onTempoChange(newBpm);
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
    const percentage = ((tempo - min) / (max - min)) * 100;
    return `linear-gradient(to right, #61dafb 0%, #61dafb ${percentage}%, #444 ${percentage}%, #444 100%)`;
  };
  
  return (
    <div className="controls">
      <div className="main-controls">
        <button className="play-button" onClick={onPlayPause}>
          {isPlaying ? '⏸ Pause' : '▶ Play'}
        </button>
        <button className="stop-button" onClick={onStop}>
          ⏹ Stop
        </button>
      </div>

      <div className="time-display">
        {formatTime(currentTime)} / {formatTime(duration)}
      </div>

      <div className="guitar-control">
        <label>Guitar Type:</label>
        <select 
          className="guitar-select"
          value={guitarType}
          onChange={handleGuitarChange}
        >
          <option value="acoustic">Acoustic</option>
          <option value="electric">Electric</option>
          <option value="nylon">Nylon</option>
        </select>
      </div>

      <div className="tempo-control">
        <label>Tempo: {tempo} BPM</label>
        <input
          type="range"
          min="40"
          max="240"
          value={tempo}
          onChange={handleBpmChange}
          style={{ background: getSliderBackground() }}
          className="tempo-slider"
        />
      </div>

      <div className="playback-controls">
        <label className="control-checkbox">
          <input
            type="checkbox"
            checked={metronomeEnabled}
            onChange={(e) => onMetronomeChange(e.target.checked)}
          />
          Enable Metronome
        </label>

        <label className="control-checkbox">
          <input
            type="checkbox"
            checked={isMuted}
            onChange={(e) => onMuteChange(e.target.checked)}
          />
          Mute Guitar
        </label>
      </div>
    </div>
  );
};

export default Controls; 
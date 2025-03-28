import React from 'react';
import './Controls.css';
import { GuitarType } from '../utils/GuitarSampler';

interface ControlsProps {
  isPlaying: boolean;
  onPlay: () => void;
  onStop: () => void;
  currentTime: number;
  duration: number;
  guitarType: GuitarType;
  onGuitarChange: (type: GuitarType) => void;
  bpm: number;
  onBpmChange: (bpm: number) => void;
  metronomeEnabled: boolean;
  onMetronomeChange: (enabled: boolean) => void;
  isMuted: boolean;
  onMuteChange: (muted: boolean) => void;
  loopEnabled: boolean;
  onLoopChange: (enabled: boolean) => void;
  loopStart: number;
  loopEnd: number;
  onLoopPointsChange: (start: number, end: number) => void;
}

const Controls: React.FC<ControlsProps> = ({
  isPlaying,
  onPlay,
  onStop,
  currentTime,
  duration,
  guitarType,
  onGuitarChange,
  bpm,
  onBpmChange,
  metronomeEnabled,
  onMetronomeChange,
  isMuted,
  onMuteChange,
  loopEnabled,
  onLoopChange,
  loopStart,
  loopEnd,
  onLoopPointsChange,
}) => {
  // Format time as MM:SS
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleLoopStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStart = parseFloat(e.target.value);
    onLoopPointsChange(newStart, loopEnd);
  };

  const handleLoopEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEnd = parseFloat(e.target.value);
    onLoopPointsChange(loopStart, newEnd);
  };

  return (
    <div className="controls">
      <div className="main-controls">
        <button className="play-button" onClick={onPlay}>
          {isPlaying ? '⏸ Pause' : '▶ Play'}
        </button>
        <button className="stop-button" onClick={onStop}>
          ⏹ Stop
        </button>
        <div className="time-display">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      </div>

      <div className="guitar-control">
        <label htmlFor="guitar-type">Guitar Type</label>
        <select
          id="guitar-type"
          value={guitarType}
          onChange={(e) => onGuitarChange(e.target.value as GuitarType)}
          className="guitar-select"
        >
          <option value="acoustic">Acoustic</option>
          <option value="electric">Electric</option>
          <option value="nylon">Nylon String</option>
        </select>
      </div>

      <div className="tempo-control">
        <label>Tempo: {bpm} BPM</label>
        <input
          type="range"
          min="40"
          max="200"
          value={bpm}
          onChange={(e) => onBpmChange(parseInt(e.target.value))}
        />
      </div>

      <div className="playback-controls">
        <label className="control-checkbox">
          <input
            type="checkbox"
            checked={metronomeEnabled}
            onChange={(e) => onMetronomeChange(e.target.checked)}
          />
          <span>Enable Metronome</span>
        </label>

        <label className="control-checkbox">
          <input
            type="checkbox"
            checked={isMuted}
            onChange={(e) => onMuteChange(e.target.checked)}
          />
          <span>Mute Guitar</span>
        </label>

        <label className="control-checkbox">
          <input
            type="checkbox"
            checked={loopEnabled}
            onChange={(e) => onLoopChange(e.target.checked)}
          />
          <span>Enable Loop</span>
        </label>
      </div>

      {loopEnabled && (
        <div className="loop-controls">
          <div className="loop-point-control">
            <label>Loop Start: {formatTime(loopStart)}</label>
            <input
              type="range"
              min="0"
              max={duration}
              step="0.1"
              value={loopStart}
              onChange={(e) => onLoopPointsChange(parseFloat(e.target.value), loopEnd)}
            />
          </div>
          <div className="loop-point-control">
            <label>Loop End: {formatTime(loopEnd)}</label>
            <input
              type="range"
              min="0"
              max={duration}
              step="0.1"
              value={loopEnd}
              onChange={(e) => onLoopPointsChange(loopStart, parseFloat(e.target.value))}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Controls; 
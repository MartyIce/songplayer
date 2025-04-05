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
  timeSignature: [number, number]; // [beats per measure, beat unit]
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
  timeSignature,
}) => {
  // Format time as MM:SS
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Format time as decimal number with 2 decimal places
  const formatTimeDecimal = (time: number) => {
    return time.toFixed(2);
  };

  // Format measure.beat
  const getMeasureTime = (time: number) => {
    const beatsPerMeasure = timeSignature[0];
    const measure = Math.floor(time / beatsPerMeasure) + 1;
    const beat = ((time % beatsPerMeasure) + 1).toFixed(2);
    return `${measure}.${beat}`;
  };

  // Handle time input change
  const handleTimeInputChange = (value: string, isStart: boolean) => {
    const newTime = parseFloat(value);
    if (!isNaN(newTime) && newTime >= 0 && newTime <= duration) {
      if (isStart) {
        onLoopPointsChange(newTime, loopEnd);
      } else {
        onLoopPointsChange(loopStart, newTime);
      }
    }
  };

  // Handle measure.beat input change
  const handleMeasureInputChange = (value: string, isStart: boolean) => {
    const [measureStr, beatStr] = value.split('.');
    const measure = parseInt(measureStr);
    const beat = parseFloat(beatStr);
    
    if (!isNaN(measure) && !isNaN(beat) && measure > 0 && beat > 0) {
      const beatsPerMeasure = timeSignature[0];
      const newTime = (measure - 1) * beatsPerMeasure + (beat - 1);
      
      if (newTime >= 0 && newTime <= duration) {
        if (isStart) {
          onLoopPointsChange(newTime, loopEnd);
        } else {
          onLoopPointsChange(loopStart, newTime);
        }
      }
    }
  };

  // Calculate slider percentage for styling
  const getSliderStyle = (value: number, min: number, max: number) => {
    const percentage = ((value - min) / (max - min)) * 100;
    return {
      background: `linear-gradient(to right, #61dafb 0%, #61dafb ${percentage}%, #444 ${percentage}%, #444 100%)`
    };
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
          style={getSliderStyle(bpm, 40, 200)}
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
            <div className="loop-point-label">
              <span>Loop Start</span>
              <div className="input-group">
                <label>Time:</label>
                <input
                  type="text"
                  className="time-input"
                  value={formatTimeDecimal(loopStart)}
                  onChange={(e) => handleTimeInputChange(e.target.value, true)}
                />
                <label>Measure/Beat:</label>
                <input
                  type="text"
                  className="measure-input"
                  value={getMeasureTime(loopStart)}
                  onChange={(e) => handleMeasureInputChange(e.target.value, true)}
                />
              </div>
            </div>
            <input
              type="range"
              min="0"
              max={duration}
              step="0.1"
              value={loopStart}
              onChange={(e) => onLoopPointsChange(parseFloat(e.target.value), loopEnd)}
              style={getSliderStyle(loopStart, 0, duration)}
            />
          </div>
          <div className="loop-point-control">
            <div className="loop-point-label">
              <span>Loop End</span>
              <div className="input-group">
                <label>Time:</label>
                <input
                  type="text"
                  className="time-input"
                  value={formatTimeDecimal(loopEnd)}
                  onChange={(e) => handleTimeInputChange(e.target.value, false)}
                />
                <label>Measure/Beat:</label>
                <input
                  type="text"
                  className="measure-input"
                  value={getMeasureTime(loopEnd)}
                  onChange={(e) => handleMeasureInputChange(e.target.value, false)}
                />
              </div>
            </div>
            <input
              type="range"
              min="0"
              max={duration}
              step="0.1"
              value={loopEnd}
              onChange={(e) => onLoopPointsChange(loopStart, parseFloat(e.target.value))}
              style={getSliderStyle(loopEnd, 0, duration)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Controls; 
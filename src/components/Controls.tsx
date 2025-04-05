import React, { useState, useEffect } from 'react';
import './Controls.css';
import { GuitarType } from '../utils/GuitarSampler';
import LoopPointAdjuster from './LoopPointAdjuster';

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
  songList: { id: string; name: string }[];
  currentSongId: string;
  onSongChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  isLoading: boolean;
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
  songList,
  currentSongId,
  onSongChange,
  isLoading,
}) => {
  // Add state for temporary input values
  const [tempTimeStart, setTempTimeStart] = useState<string>('');
  const [tempTimeEnd, setTempTimeEnd] = useState<string>('');
  const [tempMeasureStart, setTempMeasureStart] = useState<string>('');
  const [tempMeasureEnd, setTempMeasureEnd] = useState<string>('');

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

  // Handle time input change - now only updates temporary state
  const handleTimeInputChange = (value: string, isStart: boolean) => {
    if (isStart) {
      setTempTimeStart(value);
    } else {
      setTempTimeEnd(value);
    }
  };

  // Handle measure.beat input change - now only updates temporary state
  const handleMeasureInputChange = (value: string, isStart: boolean) => {
    if (isStart) {
      setTempMeasureStart(value);
    } else {
      setTempMeasureEnd(value);
    }
  };

  // New handlers for input blur
  const handleTimeInputBlur = (value: string, isStart: boolean) => {
    const newTime = parseFloat(value);
    if (!isNaN(newTime) && newTime >= 0 && newTime <= duration) {
      if (isStart) {
        onLoopPointsChange(newTime, loopEnd);
      } else {
        onLoopPointsChange(loopStart, newTime);
      }
    }
    // Reset temp value to current valid value
    if (isStart) {
      setTempTimeStart(formatTimeDecimal(loopStart));
    } else {
      setTempTimeEnd(formatTimeDecimal(loopEnd));
    }
  };

  const handleMeasureInputBlur = (value: string, isStart: boolean) => {
    // Handle case where input is just a measure number (e.g. "14")
    if (!value.includes('.')) {
      value = value + '.1.0';  // Default to first beat, no decimal
    } else {
      // Handle case where input is measure.beat (e.g. "14.1")
      const parts = value.split('.');
      if (parts.length === 2) {
        value = value + '.0';  // Add .0 if no decimal provided
      }
    }

    // Split on first dot to separate measure from beat
    const [measureStr, ...beatParts] = value.split('.');
    // Rejoin any remaining parts with dots to handle decimal beats
    const beatStr = beatParts.join('.');
    
    const measure = parseInt(measureStr);
    const beat = parseFloat(beatStr);
    
    if (!isNaN(measure) && !isNaN(beat) && measure > 0) {
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
    // Reset temp value to current valid value
    if (isStart) {
      setTempMeasureStart(getMeasureTime(loopStart));
    } else {
      setTempMeasureEnd(getMeasureTime(loopEnd));
    }
  };

  // Initialize temp values when loop points change
  useEffect(() => {
    setTempTimeStart(formatTimeDecimal(loopStart));
    setTempTimeEnd(formatTimeDecimal(loopEnd));
    setTempMeasureStart(getMeasureTime(loopStart));
    setTempMeasureEnd(getMeasureTime(loopEnd));
  }, [loopStart, loopEnd]);

  // Calculate slider percentage for styling
  const getSliderStyle = (value: number, min: number, max: number) => {
    const percentage = ((value - min) / (max - min)) * 100;
    return {
      background: `linear-gradient(to right, #61dafb 0%, #61dafb ${percentage}%, #444 ${percentage}%, #444 100%)`
    };
  };

  // Add loop adjustment handlers
  const adjustLoopPoint = (isStart: boolean, direction: 'left' | 'right', amount: 'measure' | 'beat') => {
    const beatsPerMeasure = timeSignature[0];
    const adjustment = amount === 'measure' ? beatsPerMeasure : 1;
    const delta = direction === 'left' ? -adjustment : adjustment;

    if (isStart) {
      const newStart = Math.max(0, loopStart + delta);
      if (newStart < loopEnd) {
        onLoopPointsChange(newStart, loopEnd);
      }
    } else {
      const newEnd = Math.min(duration, loopEnd + delta);
      if (newEnd > loopStart) {
        onLoopPointsChange(loopStart, newEnd);
      }
    }
  };

  return (
    <div className="controls">
      <div className="top-controls">
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

        <div className="right-controls">
          <div className="guitar-control">
            <label htmlFor="guitar-type">Type:</label>
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

          <div className="song-select">
            <label htmlFor="song-select">Song:</label>
            <select 
              id="song-select" 
              onChange={onSongChange}
              value={currentSongId}
              disabled={isLoading}
              className="song-selector"
            >
              {songList.map(song => (
                <option key={song.id} value={song.id}>
                  {song.name}
                </option>
              ))}
            </select>
            {isLoading && <span className="loading-indicator">Loading...</span>}
          </div>
        </div>
      </div>

      <div className="middle-controls">
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
                  value={tempTimeStart}
                  onChange={(e) => handleTimeInputChange(e.target.value, true)}
                  onBlur={(e) => handleTimeInputBlur(e.target.value, true)}
                />
                <label>Measure/Beat:</label>
                <input
                  type="text"
                  className="measure-input"
                  value={tempMeasureStart}
                  onChange={(e) => handleMeasureInputChange(e.target.value, true)}
                  onBlur={(e) => handleMeasureInputBlur(e.target.value, true)}
                />
                <LoopPointAdjuster 
                  onAdjust={(direction, amount) => adjustLoopPoint(true, direction, amount)} 
                />
              </div>
            </div>
            <div className="slider-container">
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
          </div>
          <div className="loop-point-control">
            <div className="loop-point-label">
              <span>Loop End</span>
              <div className="input-group">
                <label>Time:</label>
                <input
                  type="text"
                  className="time-input"
                  value={tempTimeEnd}
                  onChange={(e) => handleTimeInputChange(e.target.value, false)}
                  onBlur={(e) => handleTimeInputBlur(e.target.value, false)}
                />
                <label>Measure/Beat:</label>
                <input
                  type="text"
                  className="measure-input"
                  value={tempMeasureEnd}
                  onChange={(e) => handleMeasureInputChange(e.target.value, false)}
                  onBlur={(e) => handleMeasureInputBlur(e.target.value, false)}
                />
                <LoopPointAdjuster 
                  onAdjust={(direction, amount) => adjustLoopPoint(false, direction, amount)} 
                />
              </div>
            </div>
            <div className="slider-container">
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
        </div>
      )}
    </div>
  );
};

export default Controls; 
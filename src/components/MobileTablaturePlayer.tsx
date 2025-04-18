import React, { useState, useEffect } from 'react';
import { SongData, StringFretNote } from '../types/SongTypes';
import './MobileTablaturePlayer.css';
import VexStaffDisplay from './VexStaffDisplay';
import { TablatureGrid } from './TablatureGrid';
import { useZoom } from '../contexts/ZoomContext';
import { useNotePlayer } from '../hooks/useNotePlayer';
import { useMetronome } from '../shared/hooks/useMetronome';
import { useLoopControl } from '../shared/hooks/useLoopControl';
import { useScrollControl } from '../hooks/useScrollControl';
import { usePlayerSettings } from '../hooks/usePlayerSettings';
import { useSongProcessor } from '../hooks/useSongProcessor';
import { useTransportControl } from '../hooks/useTransportControl';
import { GuitarType } from '../utils/GuitarSampler';
import GuitarString from './GuitarString';
import NoteElement from './NoteElement';
import * as Tone from 'tone';

// Helper function to format time as MM:SS
const formatTime = (time: number) => {
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

interface MobileTablaturePlayerProps {
  song: SongData;
  songList: { id: string; name: string; filename: string; }[];
  currentSongId: string;
  onSongChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  isLoading: boolean;
}

const MobileTablaturePlayer: React.FC<MobileTablaturePlayerProps> = ({
  song,
  songList,
  currentSongId,
  onSongChange,
  isLoading
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isResetAnimating, setIsResetAnimating] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [bpm, setBpm] = useState(song.bpm);

  // Process song data using the hook
  const {
    processedSong,
    songDuration,
    visibleNotes,
    clearNotes
  } = useSongProcessor({
    song,
    currentTime,
    isResetAnimating
  });

  const { zoomLevel } = useZoom();
  const basePixelsPerBeat = 60 * zoomLevel;

  // Get player settings from the hook
  const {
    guitarType,
    chordsEnabled,
    chordsVolume,
    isMuted,
    nightMode,
    handleBpmChange,
    handleGuitarTypeChange,
    handleChordsEnabledChange,
    handleChordsVolumeChange,
    handleMuteChange,
    handleNightModeChange
  } = usePlayerSettings(song);

  // Use the enhanced loop control hook
  const {
    loopEnabled,
    loopStart,
    loopEnd,
    handleLoopEnabledChange,
    handleLoopPointsChange,
    getLoopMarkerPosition
  } = useLoopControl({
    songDuration,
    isPlaying,
    currentTime,
    onResetAnimation: () => {
      setIsResetAnimating(true);
      setTimeout(() => setIsResetAnimating(false), 50);
    },
    basePixelsPerBeat,
    onLoopReset: () => {
      clearScheduledNotes();
      scheduleNotes(processedSong, loopStart, songDuration);
    }
  });

  // Use the enhanced metronome hook
  const { metronomeEnabled, toggleMetronome } = useMetronome({
    notes: processedSong.notes,
    timeSignature: processedSong.timeSignature,
    clickOffset: 0.1,
  });

  const { scheduleNotes, clearScheduledNotes } = useNotePlayer({
    isMuted,
    chordsEnabled,
    chordsVolume,
    loopEnabled,
    loopStart,
    loopEnd,
    onResetAnimation: () => {
      setIsResetAnimating(true);
      setTimeout(() => setIsResetAnimating(false), 50);
    },
  });

  // Use transport control hook
  const {
    handlePlay,
    handlePause,
    handleStop,
    containerRef
  } = useTransportControl({
    isPlaying,
    setIsPlaying,
    currentTime,
    setCurrentTime,
    songDuration,
    loopEnabled,
    loopStart,
    metronomeEnabled,
    scheduleNotes,
    scheduleMetronomeClicks: () => {},
    clearScheduledNotes,
    clearScheduledClicks: () => {},
    processedSong
  });

  const {
    scrollOffset,
    isDragging,
    isManualScrolling,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleResumeAutoScroll
  } = useScrollControl({
    containerRef,
    isPlaying,
    currentTime,
    basePixelsPerBeat
  });

  // Update current time based on Transport position
  useEffect(() => {
    let animationFrame: number;
    let lastKnownTime = 0;

    const updateTime = (timestamp: number) => {
      if (isPlaying) {
        // Skip updates during the reset animation to prevent visual glitches
        if (isResetAnimating) {
          animationFrame = requestAnimationFrame(updateTime);
          return;
        }
        
        const transportTimeInBeats = Tone.Transport.seconds * (Tone.Transport.bpm.value / 60);
        
        if (loopEnabled) {
          // Check if we're at or beyond the loop end point
          if (transportTimeInBeats >= loopEnd) {
            // Don't update the time past loop end - the loopId in scheduleNotes will handle
            // jumping back to loop start
            animationFrame = requestAnimationFrame(updateTime);
            return;
          }
          
          // Check if we've jumped backwards (loop restart)
          if (lastKnownTime > transportTimeInBeats + 1) {
            // Force-update the UI to reflect the loop restart
            clearNotes(); // Clear notes for a clean restart
          }
        } else if (transportTimeInBeats >= songDuration) {
          handleStop();
          return;
        }

        // Store the current time for the next frame
        lastKnownTime = transportTimeInBeats;
        
        setCurrentTime(transportTimeInBeats);
      }
      animationFrame = requestAnimationFrame(updateTime);
    };

    if (isPlaying) {
      lastKnownTime = currentTime;
      animationFrame = requestAnimationFrame(updateTime);
    }

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [isPlaying, songDuration, loopEnabled, loopEnd, isResetAnimating, currentTime, handleStop, clearNotes]);

  const togglePlay = () => {
    if (isPlaying) {
      handlePause();
    } else {
      handlePlay();
    }
  };

  const toggleControls = () => {
    setShowControls(!showControls);
  };

  return (
    <div className="mobile-tablature-player">
      <div className="mobile-top-bar">
        <img 
          src={`${process.env.PUBLIC_URL}/string-slinger.png`} 
          alt="String Slinger" 
          className="mobile-logo"
        />
        <div className="mobile-controls-group">
          <div className="mobile-play-controls">
            <button onClick={togglePlay} type="button">
              {isPlaying ? '⏸' : '▶'}
            </button>
            <button onClick={handleStop} type="button">
              ⏹
            </button>
          </div>
          <div className="mobile-bpm-control">
            <input
              type="range"
              min="40"
              max="240"
              value={bpm}
              onChange={(e) => setBpm(parseInt(e.target.value))}
            />
            <span className="bpm-value">{bpm} BPM</span>
          </div>
        </div>
        <button 
          className="mobile-menu-button"
          onClick={toggleControls}
          type="button"
        >
          ☰
        </button>
      </div>

      {showControls && (
        <div className="mobile-controls-overlay">
          <button 
            className="mobile-close-button"
            onClick={() => setShowControls(false)}
          >
            ✕
          </button>
          
          <div className="mobile-time-display">
            {formatTime(currentTime)} / {formatTime(songDuration)}
          </div>

          <div className="mobile-controls-content">
            <div className="mobile-control-group">
              <div className="mobile-control-group-title">Playback Controls</div>
              <label>
                <input
                  type="checkbox"
                  checked={metronomeEnabled}
                  onChange={(e) => toggleMetronome(e.target.checked)}
                />
                Metronome
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={chordsEnabled}
                  onChange={(e) => handleChordsEnabledChange(e.target.checked)}
                />
                Chords
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={isMuted}
                  onChange={(e) => handleMuteChange(e.target.checked)}
                />
                Mute Guitar
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={nightMode}
                  onChange={(e) => handleNightModeChange(e.target.checked)}
                />
                Night Mode
              </label>
            </div>

            <div className="mobile-control-group">
              <div className="mobile-control-group-title">Loop Settings</div>
              <label>
                <input
                  type="checkbox"
                  checked={loopEnabled}
                  onChange={(e) => handleLoopEnabledChange(e.target.checked)}
                />
                Enable Loop
              </label>
              {loopEnabled && (
                <>
                  <label>
                    Loop Start (beats)
                    <input
                      type="number"
                      min="0"
                      max={loopEnd}
                      step="0.5"
                      value={loopStart}
                      onChange={(e) => handleLoopPointsChange(parseFloat(e.target.value), loopEnd)}
                    />
                  </label>
                  <label>
                    Loop End (beats)
                    <input
                      type="number"
                      min={loopStart}
                      max={songDuration}
                      step="0.5"
                      value={loopEnd}
                      onChange={(e) => handleLoopPointsChange(loopStart, parseFloat(e.target.value))}
                    />
                  </label>
                </>
              )}
            </div>

            <div className="mobile-control-group">
              <div className="mobile-control-group-title">Sound Settings</div>
              <label>
                Tempo: {bpm} BPM
                <input
                  type="range"
                  min="40"
                  max="200"
                  value={bpm}
                  onChange={(e) => handleBpmChange(parseInt(e.target.value))}
                />
              </label>
              {chordsEnabled && (
                <label>
                  Chords Volume
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={chordsVolume}
                    onChange={(e) => handleChordsVolumeChange(parseFloat(e.target.value))}
                  />
                </label>
              )}
            </div>

            <div className="mobile-control-group">
              <div className="mobile-control-group-title">Instrument & Song</div>
              <label>Guitar Type</label>
              <select
                value={guitarType}
                onChange={(e) => handleGuitarTypeChange(e.target.value as GuitarType)}
              >
                <option value="acoustic">Acoustic</option>
                <option value="electric">Electric</option>
                <option value="nylon">Nylon String</option>
              </select>
              
              <label>Current Song</label>
              <select 
                onChange={onSongChange}
                value={currentSongId}
                disabled={isLoading}
              >
                {songList.map(song => (
                  <option key={song.id} value={song.id}>
                    {song.name}
                  </option>
                ))}
              </select>
              {isLoading && <div style={{ color: '#fff' }}>Loading...</div>}
            </div>
          </div>
        </div>
      )}

      <div className="mobile-sheet-view">
        <VexStaffDisplay
          notes={processedSong.notes}
          currentTime={currentTime}
          timeSignature={processedSong.timeSignature}
          loopEnabled={loopEnabled}
          loopStart={loopStart}
          loopEnd={loopEnd}
          nightMode={nightMode}
          chords={processedSong.chords}
          scale={0.65}
        />
      </div>

      <div 
        className={`mobile-tab-view ${isDragging ? 'dragging' : ''}`}
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {isManualScrolling && isPlaying && (
          <button 
            className="resume-button visible"
            onClick={handleResumeAutoScroll}
          >
            Resume Auto-Scroll
          </button>
        )}
        <div 
          className={`tablature-content ${isDragging ? 'no-transition' : ''}`}
          style={{ 
            transform: `translateX(${scrollOffset}px)`,
            width: `${Math.max(1000, songDuration * basePixelsPerBeat + 400)}px`
          }}
        >
          <TablatureGrid 
            songDuration={songDuration}
            basePixelsPerBeat={basePixelsPerBeat}
          />
          
          {loopEnabled && (
            <>
              <div 
                className="loop-marker loop-start-marker"
                style={{ left: `${getLoopMarkerPosition(loopStart)}px` }}
              />
              <div 
                className="loop-marker loop-end-marker"
                style={{ left: `${getLoopMarkerPosition(loopEnd)}px` }}
              />
              <div 
                className="loop-region"
                style={{
                  left: `${getLoopMarkerPosition(loopStart)}px`,
                  width: `${getLoopMarkerPosition(loopEnd) - getLoopMarkerPosition(loopStart)}px`
                }}
              />
            </>
          )}
          
          <div className="strings-container">
            {[1, 2, 3, 4, 5, 6].map(stringNum => (
              <GuitarString key={stringNum} stringNumber={stringNum} />
            ))}
          </div>
          
          <div className="notes-container">
            {visibleNotes.map((note: StringFretNote, index: number) => (
              <NoteElement 
                key={`${note.string}-${note.time}-${index}`}
                note={note}
                currentTime={currentTime}
              />
            ))}
          </div>
        </div>
        <div className="trigger-line" />
      </div>
    </div>
  );
};

export default MobileTablaturePlayer; 
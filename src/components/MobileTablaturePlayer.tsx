import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { GuitarString } from './GuitarString';
import NoteElement from './NoteElement';
import * as Tone from 'tone';
import { useSongSelection } from '../hooks/useSongSelection';
import { usePlaybackLoop } from '../hooks/usePlaybackLoop';

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
  // Save current song ID whenever it changes
  useSongSelection(currentSongId);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isResetAnimating, setIsResetAnimating] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [tabViewHeight, setTabViewHeight] = useState<number>(0);
  const tabViewRef = useRef<HTMLDivElement>(null);

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

  const { zoomLevel, setZoomLevel } = useZoom();
  const basePixelsPerBeat = 60 * zoomLevel;

  // Get player settings from the hook
  const {
    guitarType,
    chordsEnabled,
    chordsVolume,
    isMuted,
    nightMode,
    bpm,
    handleBpmChange,
    handleGuitarTypeChange,
    handleChordsEnabledChange,
    handleChordsVolumeChange,
    handleMuteChange,
    handleNightModeChange
  } = usePlayerSettings(song);

  // Initialize Tone.Transport
  useEffect(() => {
    // Set initial tempo and time signature
    Tone.Transport.bpm.value = bpm;
    const [beatsPerBar] = song.timeSignature || [3, 4];
    Tone.Transport.timeSignature = beatsPerBar;
  }, [song, bpm]);

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
    handleResumeAutoScroll,
    resetScroll
  } = useScrollControl({
    containerRef,
    isPlaying,
    currentTime,
    basePixelsPerBeat
  });

  // Update handleStop to include scroll reset
  const handleStopWithScroll = useCallback(() => {
    handleStop();
    resetScroll();
  }, [handleStop, resetScroll]);

  // Use the shared playback loop hook
  usePlaybackLoop({
    isPlaying,
    isResetAnimating,
    currentTime,
    songDuration,
    loopEnabled,
    loopEnd,
    setCurrentTime,
    clearNotes,
    clearScheduledNotes,
    scheduleNotes,
    scheduleMetronomeClicks: () => {},
    metronomeEnabled,
    processedSong
  });

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

  // Handle BPM change with scheduling
  const handleBpmChangeWithScheduling = useCallback((newBpm: number) => {
    handleBpmChange(newBpm);
    
    // Store current position and state
    const wasPlaying = isPlaying;
    const currentBeat = currentTime;
    
    // Pause if playing
    if (wasPlaying) {
      Tone.Transport.pause();
    }
    
    // Update tempo
    Tone.Transport.bpm.value = newBpm;
    
    // Convert current position from beats to seconds for the new tempo
    const newPositionInSeconds = currentBeat * (60 / newBpm);
    Tone.Transport.seconds = newPositionInSeconds;
    
    // Resume if was playing
    if (wasPlaying) {
      // Reschedule notes from current position
      scheduleNotes(processedSong, currentBeat, songDuration);
      Tone.Transport.start();
    }
  }, [isPlaying, currentTime, scheduleNotes, processedSong, songDuration, handleBpmChange]);

  // Measure tab view height for responsive string spacing
  useEffect(() => {
    const measureTabViewHeight = () => {
      if (tabViewRef.current) {
        setTabViewHeight(tabViewRef.current.clientHeight);
      }
    };
    
    // Initial measurement
    measureTabViewHeight();
    
    // Re-measure on window resize
    window.addEventListener('resize', measureTabViewHeight);
    
    return () => {
      window.removeEventListener('resize', measureTabViewHeight);
    };
  }, []);
  
  // Set tabViewRef current when containerRef changes
  useEffect(() => {
    if (containerRef && containerRef.current) {
      const height = containerRef.current.clientHeight;
      setTabViewHeight(height);
    }
  }, [containerRef]);

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
              {isPlaying ? '⏸ Pause' : '▶ Play'}
            </button>
            <button onClick={handleStopWithScroll} type="button">
              ⏹ Stop
            </button>
          </div>
          <div className="mobile-bpm-control">
            <input
              type="range"
              min="40"
              max="240"
              value={bpm}
              onChange={(e) => handleBpmChangeWithScheduling(parseInt(e.target.value))}
            />
            <span className="bpm-value">{bpm} BPM</span>
          </div>
          <div className="mobile-zoom-control">
            <button 
              onClick={() => setZoomLevel(Math.max(0.5, zoomLevel - 0.1))}
              type="button"
              disabled={zoomLevel <= 0.5}
            >
              -
            </button>
            <span className="zoom-value">{Math.round(zoomLevel * 100)}%</span>
            <button 
              onClick={() => setZoomLevel(Math.min(2, zoomLevel + 0.1))}
              type="button"
              disabled={zoomLevel >= 2}
            >
              +
            </button>
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
                  onChange={(e) => handleBpmChangeWithScheduling(parseInt(e.target.value))}
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
          songKey={processedSong.key}
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
            scale={0.8}
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
              <GuitarString 
                key={stringNum} 
                stringNumber={stringNum}
                scale={0.8}
                isMobile={true}
                containerHeight={tabViewHeight}
              />
            ))}
          </div>
          
          <div className="notes-container">
            {visibleNotes.map((note: StringFretNote, index: number) => (
              <NoteElement 
                key={`${note.string}-${note.time}-${index}`}
                note={note}
                currentTime={currentTime}
                scale={0.8}
                containerHeight={tabViewHeight}
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
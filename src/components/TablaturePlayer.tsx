import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import * as Tone from 'tone';
import { SongData, StringFretNote } from '../types/SongTypes';
import './TablaturePlayer.css';
import { GuitarString } from './GuitarString';
import NoteElement from './NoteElement';
import Controls from './Controls';
import VexStaffDisplay from './VexStaffDisplay';
import { guitarSampler, GuitarType } from '../utils/GuitarSampler';
import { STORAGE_KEYS } from '../utils/localStorage';
import { useZoom } from '../contexts/ZoomContext';
import ZoomControls from './ZoomControls';
import { useNotePlayer } from '../hooks/useNotePlayer';
import { useMetronome } from '../shared/hooks/useMetronome';
import { useLoopControl } from '../shared/hooks/useLoopControl';
import { useScrollControl } from '../hooks/useScrollControl';
import { usePlayerSettings } from '../hooks/usePlayerSettings';
import { TablatureGrid } from './TablatureGrid';
import { useSongProcessor } from '../hooks/useSongProcessor';
import { useTransportControl } from '../hooks/useTransportControl';
import { useSongSelection } from '../hooks/useSongSelection';
import { usePlaybackLoop } from '../hooks/usePlaybackLoop';
import { SongListItem } from '../utils/songPopulator';

interface TablaturePlayerProps {
  song: SongData;
  songList: SongListItem[];
  currentSongId: string;
  onSongChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  isLoading: boolean;
}

const TablaturePlayer: React.FC<TablaturePlayerProps> = ({ 
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

  // Process song data using the hook
  const {
    originalSong,
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
  const basePixelsPerBeat = useMemo(() => 60 * zoomLevel, [zoomLevel]); // Apply zoom to base scale
  
  // Get player settings from the hook
  const {
    bpm,
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
  
  // Refs
  const notesContainerRef = useRef<HTMLDivElement>(null);
  const tablatureContentRef = useRef<HTMLDivElement>(null);
  const scheduledNotes = useRef<number[]>([]);
  
  // Memoize props for useMetronome to ensure stable references
  const metronomeNotes = useMemo(() => originalSong.notes, [originalSong.notes]);
  const metronomeTimeSignature = useMemo(() => originalSong.timeSignature, [originalSong.timeSignature]);

  const handleResetAnimation = useCallback(() => {
    setIsResetAnimating(true);
    setTimeout(() => {
      setIsResetAnimating(false);
    }, 50);
  }, []);

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
    onResetAnimation: handleResetAnimation,
    basePixelsPerBeat,
    onLoopReset: () => {
      // Clear existing scheduled notes
      clearScheduledNotes();
      // Reschedule notes from loop start
      scheduleNotes(processedSong, loopStart, songDuration);
      // Reschedule metronome clicks from loop start
      scheduleMetronomeClicks(loopStart);
    }
  });

  // Use the enhanced metronome hook
  const { metronomeEnabled, toggleMetronome, scheduleMetronomeClicks, clearScheduledClicks } = useMetronome({
    notes: metronomeNotes,
    timeSignature: metronomeTimeSignature,
    clickOffset: 0.1,
  });

  const { scheduleNotes, clearScheduledNotes } = useNotePlayer({
    isMuted,
    chordsEnabled,
    chordsVolume,
    loopEnabled,
    loopStart,
    loopEnd,
    onResetAnimation: handleResetAnimation,
  });

  // Use transport control hook
  const {
    handlePlay,
    handlePause,
    handleStop,
    handlePlayPause,
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
    scheduleMetronomeClicks,
    clearScheduledNotes,
    clearScheduledClicks,
    processedSong
  });

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
    scheduleMetronomeClicks,
    metronomeEnabled,
    processedSong
  });

  // Initialize Tone.Transport
  useEffect(() => {
    // Set initial tempo and time signature
    Tone.Transport.bpm.value = bpm;
    const [beatsPerBar] = song.timeSignature || [3, 4];
    Tone.Transport.timeSignature = beatsPerBar;
  }, [song, bpm]);
  
  // Update handleMuteChange to use clearScheduledNotes
  const handleMuteChangeWithScheduling = useCallback((muted: boolean) => {
    handleMuteChange(muted);
    
    clearScheduledNotes();
    
    if (!muted && isPlaying) {
      scheduleNotes(processedSong, currentTime, songDuration);
    }
  }, [isPlaying, currentTime, scheduleNotes, clearScheduledNotes, processedSong, songDuration, handleMuteChange]);

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

  // Calculate content transform based on scroll offset
  const getContentTransform = useCallback(() => {
    return `translateX(${scrollOffset}px)`;
  }, [scrollOffset]);

  // Calculate the required width for the entire song
  const contentWidth = useMemo(() => {
    const minWidth = 1000; // Minimum width in pixels
    const durationBasedWidth = songDuration * basePixelsPerBeat;
    return Math.max(minWidth, durationBasedWidth + 400); // Add extra padding for visibility
  }, [songDuration, basePixelsPerBeat]);

  // Handle guitar type change with scheduling
  const handleGuitarTypeChangeWithScheduling = useCallback(async (type: GuitarType) => {
    const wasPlaying = isPlaying;
    if (wasPlaying) {
      handlePause();
    }
    
    handleGuitarTypeChange(type);
    await guitarSampler.switchGuitar(type);
    
    if (wasPlaying) {
      handlePlay();
    }
  }, [isPlaying, handlePause, handlePlay, handleGuitarTypeChange]);
  
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

  // Handle chords volume change with scheduling
  const handleChordsVolumeChangeWithScheduling = useCallback((volume: number) => {
    handleChordsVolumeChange(volume);

    // If we're currently playing, reschedule notes to apply the new volume
    if (isPlaying) {
      // Clear existing scheduled notes
      scheduledNotes.current.forEach(id => Tone.Transport.clear(id));
      scheduledNotes.current = [];
      
      // Reschedule from current position with new volume
      scheduleNotes(processedSong, currentTime, songDuration);
    }
  }, [isPlaying, currentTime, scheduleNotes, processedSong, songDuration, handleChordsVolumeChange]);

  return (
    <div className="tablature-player" ref={containerRef}>
      <Controls
        isPlaying={isPlaying}
        onPlay={handlePlayPause}
        onStop={handleStopWithScroll}
        currentTime={currentTime}
        duration={songDuration}
        guitarType={guitarType}
        onGuitarChange={handleGuitarTypeChangeWithScheduling}
        bpm={bpm}
        onBpmChange={handleBpmChangeWithScheduling}
        metronomeEnabled={metronomeEnabled}
        onMetronomeChange={toggleMetronome}
        chordsEnabled={chordsEnabled}
        onChordsChange={handleChordsEnabledChange}
        chordsVolume={chordsVolume}
        onChordsVolumeChange={handleChordsVolumeChangeWithScheduling}
        isMuted={isMuted}
        onMuteChange={handleMuteChangeWithScheduling}
        loopEnabled={loopEnabled}
        onLoopChange={handleLoopEnabledChange}
        loopStart={loopStart}
        loopEnd={loopEnd}
        onLoopPointsChange={handleLoopPointsChange}
        timeSignature={song.timeSignature || [3, 4]}
        songList={songList}
        currentSongId={currentSongId}
        onSongChange={onSongChange}
        isLoading={isLoading}
        nightMode={nightMode}
        onNightModeChange={handleNightModeChange}
      />
      
      <VexStaffDisplay
        notes={originalSong.notes}
        currentTime={currentTime}
        timeSignature={originalSong.timeSignature}
        songKey={originalSong.key}
        loopEnabled={loopEnabled}
        loopStart={loopStart}
        loopEnd={loopEnd}
        nightMode={nightMode}
        chords={originalSong.chords}
      />
      
      <div 
        className={`tablature-display ${isDragging ? 'dragging' : ''}`}
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
          ref={tablatureContentRef}
          className={`tablature-content ${isDragging ? 'no-transition' : ''}`}
          style={{ 
            transform: getContentTransform(),
            width: `${contentWidth}px`
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
          
          <div className="strings-container" ref={notesContainerRef}>
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
      <div className="controls-container">
        <div className="controls-row">
          <div className="control-group">
            <ZoomControls />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TablaturePlayer; 
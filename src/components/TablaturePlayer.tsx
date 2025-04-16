import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import * as Tone from 'tone';
import { SongData, StringFretNote, Note } from '../types/SongTypes';
import './TablaturePlayer.css';
import GuitarString from './GuitarString';
import NoteElement from './NoteElement';
import Controls from './Controls';
import VexStaffDisplay from './VexStaffDisplay';
import { convertSongToStringFret } from '../utils/noteConverter';
import { guitarSampler, GuitarType } from '../utils/GuitarSampler';
import { STORAGE_KEYS, saveToStorage, getFromStorage } from '../utils/localStorage';
import { useZoom } from '../contexts/ZoomContext';
import ZoomControls from './ZoomControls';
import { useNotePlayer } from '../hooks/useNotePlayer';
import { useMetronome } from '../shared/hooks/useMetronome';
import { useLoopControl } from '../shared/hooks/useLoopControl';

interface TablaturePlayerProps {
  song: SongData;
  songList: { id: string; name: string; filename: string; }[];
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
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.CURRENT_SONG, currentSongId);
  }, [currentSongId]);

  // Keep both the original song and the processed version
  const [originalSong, processedSong] = useMemo(() => {
    if (song.tuning) {
      // If the song has tuning, it's in pitch format and needs conversion
      const converted = convertSongToStringFret(song);
      return [song, converted];
    }
    // If no tuning, it's already in string/fret format
    return [song, song];
  }, [song.title]);

  const { zoomLevel } = useZoom();
  const basePixelsPerBeat = useMemo(() => 60 * zoomLevel, [zoomLevel]); // Apply zoom to base scale
  
  // State declarations
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [bpm, setBpm] = useState<number>(() => getFromStorage(STORAGE_KEYS.TEMPO, song.bpm));
  const [visibleNotes, setVisibleNotes] = useState<StringFretNote[]>([]);
  const [guitarType, setGuitarType] = useState<GuitarType>(() => getFromStorage(STORAGE_KEYS.GUITAR_TYPE, 'acoustic'));
  const [chordsEnabled, setChordsEnabled] = useState(() => getFromStorage(STORAGE_KEYS.CHORDS_ENABLED, true));
  const [chordsVolume, setChordsVolume] = useState(() => getFromStorage(STORAGE_KEYS.CHORDS_VOLUME, 0.7));
  const [isMuted, setIsMuted] = useState(() => getFromStorage(STORAGE_KEYS.MUTE, false));
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [isManualScrolling, setIsManualScrolling] = useState(false);
  const [isResetAnimating, setIsResetAnimating] = useState(false);
  const [nightMode, setNightMode] = useState(() => getFromStorage(STORAGE_KEYS.NIGHT_MODE, false));
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Refs
  const synth = useRef<Tone.PolySynth | null>(null);
  const notesContainerRef = useRef<HTMLDivElement>(null);
  const tablatureContentRef = useRef<HTMLDivElement>(null);
  const scheduledNotes = useRef<number[]>([]);
  
  // Memoize props for useMetronome to ensure stable references
  const metronomeNotes = useMemo(() => originalSong.notes, [originalSong.title]);
  const metronomeTimeSignature = useMemo(() => originalSong.timeSignature, [originalSong.title]);

  // Calculate the total duration of the song in beats
  const songDuration = useMemo(() => {
    if (!processedSong.notes.length) return 0;
    const lastNote = [...processedSong.notes].sort((a, b) => (b.time + b.duration) - (a.time + a.duration))[0];
    return lastNote.time + lastNote.duration;
  }, [processedSong.notes]);
  
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
    getLoopMarkerPosition,
    checkAndHandleLoopReset
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

  // Update handleStop to use clearScheduledNotes
  const handleStop = useCallback(() => {
    Tone.Transport.stop();
    clearScheduledNotes();
    clearScheduledClicks();
    Tone.Transport.seconds = 0;
    setCurrentTime(0);
    setIsPlaying(false);
  }, [clearScheduledNotes, clearScheduledClicks]);

  // Initialize the synth
  useEffect(() => {
    synth.current = new Tone.PolySynth(Tone.Synth).toDestination();
    
    return () => {
      if (synth.current) {
        synth.current.dispose();
      }
    };
  }, []);
  
  // Initialize Tone.Transport
  useEffect(() => {
    // Set initial tempo and time signature
    const savedBpm = getFromStorage(STORAGE_KEYS.TEMPO, song.bpm);
    Tone.Transport.bpm.value = savedBpm;
    const [beatsPerBar] = song.timeSignature || [3, 4];
    Tone.Transport.timeSignature = beatsPerBar;
    setBpm(savedBpm);
    
    // Clean up function
    return () => {
      Tone.Transport.stop();
      Tone.Transport.cancel();
      scheduledNotes.current.forEach(id => Tone.Transport.clear(id));
      scheduledNotes.current = [];
    };
  }, [song, songDuration]);
  
  // Update handleMuteChange to use clearScheduledNotes
  const handleMuteChange = useCallback((muted: boolean) => {
    setIsMuted(muted);
    saveToStorage(STORAGE_KEYS.MUTE, muted);
    
    clearScheduledNotes();
    
    if (!muted && isPlaying) {
      scheduleNotes(processedSong, currentTime, songDuration);
    }
  }, [isPlaying, currentTime, scheduleNotes, clearScheduledNotes, processedSong, songDuration]);

  // Handle pause button
  const handlePause = useCallback(() => {
    if (isPlaying) {
      Tone.Transport.pause();
      clearScheduledNotes();
      clearScheduledClicks();
      setIsPlaying(false);
    }
  }, [isPlaying, clearScheduledNotes, clearScheduledClicks]);
  
  // Handle play button
  const handlePlay = useCallback(async () => {
    // Ensure container is ready before playing
    if (!containerRef.current) {
      console.warn('Container not ready yet');
      return;
    }

    try {
      // Start Tone.js context
      await Tone.start();
      console.log('Tone.js context started');

      if (!isPlaying) {
        // Reset transport state
        Tone.Transport.cancel();
        
        // Reset if at end
        if (currentTime >= songDuration) {
          setCurrentTime(0);
          Tone.Transport.seconds = 0;
        }
        
        // If loop is enabled, start from loop start position
        if (loopEnabled) {
          setCurrentTime(loopStart);
          Tone.Transport.seconds = loopStart * (60 / Tone.Transport.bpm.value);
        }
        
        // Initialize scroll position only if not in manual mode
        if (!isManualScrolling && containerRef.current) {
          const containerWidth = containerRef.current.clientWidth;
          setScrollOffset(containerWidth / 2);
        }
        
        // Schedule notes and metronome clicks from current position
        scheduleNotes(processedSong, currentTime, songDuration);
        if (metronomeEnabled) {
          scheduleMetronomeClicks(currentTime);
        }
        
        // Start transport
        console.log('Starting transport at position:', Tone.Transport.seconds);
        Tone.Transport.start();
        setIsPlaying(true);
        console.log('Transport started, playback began');
      }
    } catch (error) {
      console.error('Error starting playback:', error);
    }
  }, [isPlaying, currentTime, songDuration, loopEnabled, loopStart, scheduleNotes, isManualScrolling, processedSong, metronomeEnabled, scheduleMetronomeClicks]);
  
  const handlePlayPause = useCallback(async () => {
    if (isPlaying) {
      handlePause();
    } else {
      handlePlay();
    }
  }, [isPlaying, handlePause, handlePlay]);
  
  // Handle guitar type change
  const handleGuitarTypeChange = useCallback(async (type: GuitarType) => {
    const wasPlaying = isPlaying;
    if (wasPlaying) {
      handlePause();
    }
    
    setGuitarType(type);
    saveToStorage(STORAGE_KEYS.GUITAR_TYPE, type);
    await guitarSampler.switchGuitar(type);
    
    if (wasPlaying) {
      handlePlay();
    }
  }, [isPlaying, handlePause, handlePlay]);

  // Generate grid lines for better visual reference
  const renderGridLines = () => {
    const gridLines = [];
    
    // Horizontal lines (for strings)
    // With the new flexbox layout, we need to calculate positions differently
    const containerHeight = 280;
    const paddingTop = 40;
    const contentHeight = containerHeight - (paddingTop * 2);
    const stringSpacing = contentHeight / 5; // 5 spaces for 6 strings
    
    for (let i = 0; i < 6; i++) {
      const yPosition = paddingTop + (i * stringSpacing);
      gridLines.push(
        <div 
          key={`h-${i}`} 
          className="grid-line horizontal" 
          style={{ 
            top: `${yPosition}px`,
            opacity: 0.15 // Make grid lines more subtle
          }}
        />
      );
    }
    
    // Vertical lines (time markers)
    const linesPerBeat = 1; // One line per beat
    const totalBeats = Math.ceil(songDuration);
    const totalLines = totalBeats * linesPerBeat;
    
    for (let i = 0; i <= totalLines; i++) {
      const xPosition = i * basePixelsPerBeat + 20; // Add left padding
      gridLines.push(
        <div 
          key={`v-${i}`} 
          className="grid-line vertical" 
          style={{ 
            left: `${xPosition}px`,
            opacity: 0.15 // Make grid lines more subtle
          }}
        />
      );
    }
    
    return gridLines;
  };
  
  // Handle BPM change
  const handleBpmChange = useCallback((newBpm: number) => {
    setBpm(newBpm);
    saveToStorage(STORAGE_KEYS.TEMPO, newBpm);
    
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
  }, [isPlaying, currentTime, scheduleNotes, processedSong, songDuration]);

  // Calculate content transform based on scroll offset
  const getContentTransform = useCallback(() => {
    return `translateX(${scrollOffset}px)`;
  }, [scrollOffset]);

  // Handle manual scrolling - though not used directly in this file, it's available for future use
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleScroll = useCallback((deltaX: number) => {
    setScrollOffset(prev => prev - deltaX);
  }, []);

  // Handle mouse events
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setStartX(e.clientX - scrollOffset);
    setIsManualScrolling(true);
    if (tablatureContentRef.current) {
      tablatureContentRef.current.classList.add('no-transition');
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    
    const newOffset = e.clientX - startX;
    setScrollOffset(newOffset);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    if (tablatureContentRef.current) {
      tablatureContentRef.current.classList.remove('no-transition');
    }
  };

  // Handle touch events for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    setStartX(e.touches[0].clientX - scrollOffset);
    setIsManualScrolling(true);
    if (tablatureContentRef.current) {
      tablatureContentRef.current.classList.add('no-transition');
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    
    const newOffset = e.touches[0].clientX - startX;
    setScrollOffset(newOffset);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    if (tablatureContentRef.current) {
      tablatureContentRef.current.classList.remove('no-transition');
    }
  };

  // Handle resuming auto-scroll
  const handleResumeAutoScroll = useCallback(() => {
    setIsManualScrolling(false);
    if (containerRef.current && isPlaying) {
      const containerWidth = containerRef.current.clientWidth;
      setScrollOffset(containerWidth / 2 - (currentTime * basePixelsPerBeat));
    }
  }, [isPlaying, currentTime, basePixelsPerBeat]);

  // Calculate the required width for the entire song
  const contentWidth = useMemo(() => {
    const minWidth = 1000; // Minimum width in pixels
    const durationBasedWidth = songDuration * basePixelsPerBeat;
    return Math.max(minWidth, durationBasedWidth + 400); // Add extra padding for visibility
  }, [songDuration, basePixelsPerBeat]);

  // Handle night mode change
  const handleNightModeChange = useCallback((enabled: boolean) => {
    setNightMode(enabled);
    saveToStorage(STORAGE_KEYS.NIGHT_MODE, enabled);
  }, []);

  // Handle chords enabled/disabled
  const handleChordsEnabledChange = useCallback((enabled: boolean) => {
    setChordsEnabled(enabled);
    saveToStorage(STORAGE_KEYS.CHORDS_ENABLED, enabled);
  }, []);

  // Handle chords volume change
  const handleChordsVolumeChange = useCallback((volume: number) => {
    setChordsVolume(volume);
    saveToStorage(STORAGE_KEYS.CHORDS_VOLUME, volume);

    // If we're currently playing, reschedule notes to apply the new volume
    if (isPlaying) {
      // Clear existing scheduled notes
      scheduledNotes.current.forEach(id => Tone.Transport.clear(id));
      scheduledNotes.current = [];
      
      // Reschedule from current position with new volume
      scheduleNotes(processedSong, currentTime, songDuration);
    }
  }, [isPlaying, currentTime, scheduleNotes, processedSong, songDuration]);

  // Initialize position
  useEffect(() => {
    const initializePosition = () => {
      if (containerRef.current) {
        const triggerLinePosition = containerRef.current.clientWidth / 2;
        setScrollOffset(triggerLinePosition);
      }
    };

    // Initial setup
    initializePosition();

    // Add a small delay to ensure the container is properly rendered
    const timeoutId = setTimeout(initializePosition, 100);

    return () => clearTimeout(timeoutId);
  }, []);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current && !isManualScrolling && !isPlaying) {
        const containerWidth = containerRef.current.clientWidth;
        setScrollOffset(containerWidth / 2);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isManualScrolling, isPlaying]);

  // Auto-scroll during playback
  useEffect(() => {
    if (isPlaying && currentTime > 0 && containerRef.current && !isManualScrolling) {
      const containerWidth = containerRef.current.clientWidth;
      const newOffset = containerWidth / 2 - (currentTime * basePixelsPerBeat);
      
      // Use requestAnimationFrame for smoother scrolling
      requestAnimationFrame(() => {
        setScrollOffset(newOffset);
      });
    }
  }, [isPlaying, currentTime, basePixelsPerBeat, isManualScrolling]);

  // Update scroll position when zoom changes
  useEffect(() => {
    if (containerRef.current && !isManualScrolling) {
      const containerWidth = containerRef.current.clientWidth;
      const newOffset = containerWidth / 2 - (currentTime * basePixelsPerBeat);
      
      // Use requestAnimationFrame for smoother zoom transitions
      requestAnimationFrame(() => {
        setScrollOffset(newOffset);
      });
    }
  }, [basePixelsPerBeat, currentTime, isManualScrolling]);

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
        
        // Check for loop reset first
        if (checkAndHandleLoopReset(transportTimeInBeats)) {
          animationFrame = requestAnimationFrame(updateTime);
          return;
        }
        
        // Check if we've jumped backwards (loop restart)
        if (lastKnownTime > transportTimeInBeats + 1) {
          // Force-update the UI to reflect the loop restart
          setVisibleNotes([]); // Clear notes for a clean restart
        }

        if (!loopEnabled && transportTimeInBeats >= songDuration) {
          handleStop();
          return;
        }

        // Store the current time for the next frame
        lastKnownTime = transportTimeInBeats;
        
        setCurrentTime(transportTimeInBeats);
        
        // Only update scroll position if not in manual mode
        if (!isManualScrolling && containerRef.current) {
          const containerWidth = containerRef.current.clientWidth;
          // Calculate offset to keep the current position at the trigger line
          const newOffset = containerWidth / 2 - (transportTimeInBeats * basePixelsPerBeat);
          setScrollOffset(newOffset);
        }
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
  }, [isPlaying, songDuration, isManualScrolling, loopEnabled, loopEnd, isResetAnimating, basePixelsPerBeat, currentTime, handleStop, checkAndHandleLoopReset]);

  // Update visible notes based on current time
  useEffect(() => {
    // If we're in the middle of a loop reset animation, don't update the notes
    // This prevents flickering during the loop transition
    if (isResetAnimating) {
      return;
    }
    
    // Show all notes, but still handle loop boundaries
    const visible = processedSong.notes.filter(
      (note: Note) => {
        // Filter out rest notes - they should not be displayed in the tablature
        if ('rest' in note) {
          return false;
        }
        
        // Show all notes, regardless of loop state
        return true;
      }
    ) as StringFretNote[];
    
    setVisibleNotes(visible);
  }, [currentTime, processedSong.notes, isResetAnimating]);

  return (
    <div className="tablature-player" ref={containerRef}>
      <Controls
        isPlaying={isPlaying}
        onPlay={handlePlayPause}
        onStop={handleStop}
        currentTime={currentTime}
        duration={songDuration}
        guitarType={guitarType}
        onGuitarChange={handleGuitarTypeChange}
        bpm={bpm}
        onBpmChange={handleBpmChange}
        metronomeEnabled={metronomeEnabled}
        onMetronomeChange={toggleMetronome}
        chordsEnabled={chordsEnabled}
        onChordsChange={handleChordsEnabledChange}
        chordsVolume={chordsVolume}
        onChordsVolumeChange={handleChordsVolumeChange}
        isMuted={isMuted}
        onMuteChange={handleMuteChange}
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
          <div className="grid-lines">
            {renderGridLines()}
          </div>
          
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
            {visibleNotes.map((note, index) => (
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
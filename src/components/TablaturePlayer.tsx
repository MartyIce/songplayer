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
  }, [song]);

  const { zoomLevel } = useZoom();
  const basePixelsPerBeat = useMemo(() => 60 * zoomLevel, [zoomLevel]); // Apply zoom to base scale
  
  // State declarations
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [bpm, setBpm] = useState<number>(() => getFromStorage(STORAGE_KEYS.TEMPO, song.bpm));
  const [visibleNotes, setVisibleNotes] = useState<StringFretNote[]>([]);
  const [guitarType, setGuitarType] = useState<GuitarType>(() => getFromStorage(STORAGE_KEYS.GUITAR_TYPE, 'acoustic'));
  const [metronomeEnabled, setMetronomeEnabled] = useState(() => getFromStorage(STORAGE_KEYS.METRONOME_ENABLED, false));
  const [isMuted, setIsMuted] = useState(() => getFromStorage(STORAGE_KEYS.MUTE, false));
  const [loopEnabled, setLoopEnabled] = useState(() => getFromStorage(STORAGE_KEYS.LOOP_ENABLED, false));
  const [loopStart, setLoopStart] = useState(() => getFromStorage(STORAGE_KEYS.LOOP_START, 0));
  const [loopEnd, setLoopEnd] = useState(() => {
    const savedLoopEnd = getFromStorage(STORAGE_KEYS.LOOP_END, null);
    return savedLoopEnd !== null ? savedLoopEnd : song.notes[song.notes.length - 1].time + song.notes[song.notes.length - 1].duration;
  });
  const [isDragging, setIsDragging] = useState(false);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [startX, setStartX] = useState(0);
  const [isManualScrolling, setIsManualScrolling] = useState(false);
  const [isResetAnimating, setIsResetAnimating] = useState(false);
  const [nightMode, setNightMode] = useState(() => getFromStorage(STORAGE_KEYS.NIGHT_MODE, false));
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Refs
  const synth = useRef<Tone.PolySynth | null>(null);
  const notesContainerRef = useRef<HTMLDivElement>(null);
  const tablatureContentRef = useRef<HTMLDivElement>(null);
  const dragTimeout = useRef<NodeJS.Timeout>();
  const scheduledNotes = useRef<number[]>([]);
  const metronomePart = useRef<Tone.Part | null>(null);
  
  // Calculate the total duration of the song in beats
  const songDuration = useMemo(() => {
    if (!processedSong.notes.length) return 0;
    const lastNote = [...processedSong.notes].sort((a, b) => (b.time + b.duration) - (a.time + a.duration))[0];
    return lastNote.time + lastNote.duration;
  }, [processedSong.notes]);
  
  // Define handleStop first since it's used in updateTime
  const handleStop = useCallback(() => {
    // Stop transport and clear all scheduled notes
    Tone.Transport.stop();
    scheduledNotes.current.forEach(id => Tone.Transport.clear(id));
    scheduledNotes.current = [];
    
    // Stop any currently playing notes
    guitarSampler.stopAllNotes();
    
    // Reset position
    Tone.Transport.seconds = 0;
    setCurrentTime(0);
    setIsPlaying(false);
  }, []);
  
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
    
    // Only set loop end to songDuration if there's no saved value
    const savedLoopEnd = getFromStorage(STORAGE_KEYS.LOOP_END, null);
    if (savedLoopEnd === null) {
      setLoopEnd(songDuration);
    }
    
    // Clean up function
    return () => {
      Tone.Transport.stop();
      Tone.Transport.cancel();
      scheduledNotes.current.forEach(id => Tone.Transport.clear(id));
      scheduledNotes.current = [];
    };
  }, [song, songDuration]);
  
  // Play a note using the guitar sampler
  const playNote = useCallback((note: Note) => {
    if (!guitarSampler.isReady() || isMuted) return;

    let noteToPlay: string | null = null;

    if ('note' in note) {
      // PitchNote - direct note name
      noteToPlay = note.note;
    } else if ('string' in note) {
      // StringFretNote - calculate from string and fret
      const baseNotes = ['E4', 'B3', 'G3', 'D3', 'A2', 'E2'];
      const stringIndex = note.string - 1;
      const baseNote = baseNotes[stringIndex];
      noteToPlay = Tone.Frequency(baseNote).transpose(note.fret).toNote();
    }

    if (noteToPlay) {
      guitarSampler.playNote(noteToPlay, Tone.now(), note.duration * (60 / Tone.Transport.bpm.value));
    }
  }, [isMuted]);

  // Define scheduleNotes with useCallback before it's used
  const scheduleNotes = useCallback((startBeat = 0) => {
    // Clear any previously scheduled notes
    scheduledNotes.current.forEach(id => Tone.Transport.clear(id));
    scheduledNotes.current = [];

    if (isMuted) return; // Don't schedule notes if muted

    // Schedule each note that comes after startBeat
    processedSong.notes
      .filter((note: Note) => {
        if (loopEnabled) {
          return note.time >= startBeat && note.time < loopEnd;
        }
        return note.time >= startBeat;
      })
      .forEach((note: Note) => {
        const timeInSeconds = note.time * (60 / Tone.Transport.bpm.value);
        const id = Tone.Transport.schedule(time => {
          playNote(note);
        }, timeInSeconds);
        scheduledNotes.current.push(id);
      });

    // Schedule loop if enabled
    if (loopEnabled) {
      const loopEndTime = loopEnd * (60 / Tone.Transport.bpm.value);
      const loopId = Tone.Transport.schedule(time => {
        // Signal that we're resetting for animation purposes
        setIsResetAnimating(true);
        
        // Reset to loop start point
        setCurrentTime(loopStart);
        // Set Transport position to loop start
        const loopStartSeconds = loopStart * (60 / Tone.Transport.bpm.value);
        Tone.Transport.seconds = loopStartSeconds;
        
        // Clear the reset animation flag after a short delay
        setTimeout(() => {
          setIsResetAnimating(false);
        }, 50);
        
        // Reschedule notes from loop start
        scheduleNotes(loopStart);
      }, loopEndTime);
      scheduledNotes.current.push(loopId);
    }
  }, [loopEnabled, loopEnd, loopStart, isMuted, processedSong.notes, playNote]);
  
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
    let lastTime = 0;
    let lastKnownTime = 0;

    const updateTime = (timestamp: number) => {
      if (isPlaying) {
        // Skip updates during the reset animation to prevent visual glitches
        if (isResetAnimating) {
          animationFrame = requestAnimationFrame(updateTime);
          return;
        }
        
        // Not using the delta, but keeping it for future debugging
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _ = timestamp - lastTime;
        lastTime = timestamp;

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
            setVisibleNotes([]); // Clear notes for a clean restart
          }
        } else if (transportTimeInBeats >= songDuration) {
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
  }, [isPlaying, songDuration, isManualScrolling, loopEnabled, loopEnd, isResetAnimating, basePixelsPerBeat, currentTime, handleStop]);

  // Handle mute change
  const handleMuteChange = useCallback((muted: boolean) => {
    setIsMuted(muted);
    saveToStorage(STORAGE_KEYS.MUTE, muted);
    
    // Clear all currently scheduled notes
    scheduledNotes.current.forEach(id => Tone.Transport.clear(id));
    scheduledNotes.current = [];
    
    // Stop any currently playing notes
    guitarSampler.stopAllNotes();
    
    if (!muted && isPlaying) {
      // If unmuting while playing, schedule notes from current position
      scheduleNotes(currentTime);
    }
  }, [isPlaying, currentTime, scheduleNotes]);

  // Handle metronome change
  const handleMetronomeChange = useCallback((enabled: boolean) => {
    setMetronomeEnabled(enabled);
    saveToStorage(STORAGE_KEYS.METRONOME_ENABLED, enabled);
  }, []);
  
  // Handle pause button
  const handlePause = useCallback(() => {
    if (isPlaying) {
      Tone.Transport.pause();
      setIsPlaying(false);
    }
  }, [isPlaying]);
  
  // Handle play button
  const handlePlay = useCallback(async () => {
    // Ensure container is ready before playing
    if (!containerRef.current) {
      console.warn('Container not ready yet');
      return;
    }

    await Tone.start();
    if (!isPlaying) {
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
      
      // Schedule notes from current position
      scheduleNotes(loopEnabled ? loopStart : currentTime);
      
      // Start transport
      Tone.Transport.start();
      setIsPlaying(true);
    }
  }, [isPlaying, currentTime, songDuration, loopEnabled, loopStart, scheduleNotes, isManualScrolling]);
  
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
      scheduleNotes(currentBeat);
      Tone.Transport.start();
    }
  }, [isPlaying, currentTime, scheduleNotes]);

  // Create a click synth for the metronome
  useEffect(() => {
    // Create a click synth with a short envelope
    const clickSynth = new Tone.Synth({
      oscillator: {
        type: 'sine',
      },
      envelope: {
        attack: 0.001,
        decay: 0.05,
        sustain: 0,
        release: 0.05,
      },
    }).toDestination();
    clickSynth.volume.value = -10; // Reduce volume

    // Create metronome part
    if (metronomePart.current) {
      metronomePart.current.dispose();
    }

    // Set up time signature
    const [beatsPerBar] = song.timeSignature || [3, 4];
    Tone.Transport.timeSignature = beatsPerBar;

    // Calculate total beats in the song
    const totalBeats = Math.ceil(song.notes[song.notes.length - 1].time + 
                               song.notes[song.notes.length - 1].duration);
    
    // Create metronome clicks for each beat
    const metronomeEvents = Array.from({ length: totalBeats }, (_, i) => ({
      time: `${Math.floor(i / beatsPerBar)}:${i % beatsPerBar}:0`,
      beat: i % beatsPerBar
    }));

    metronomePart.current = new Tone.Part((time, event) => {
      if (metronomeEnabled) {
        // Accent first beat of each bar (beat 0)
        const isAccent = event.beat === 0;
        clickSynth.triggerAttackRelease(
          isAccent ? 1200 : 800, // Higher pitch for accented beats
          0.02, // Shorter duration for a crisper click
          time,
          isAccent ? 0.7 : 0.5 // Higher velocity for accented beats
        );
      }
    }, metronomeEvents);

    metronomePart.current.loop = false;
    metronomePart.current.start(0);

    return () => {
      clickSynth.dispose();
      metronomePart.current?.dispose();
    };
  }, [metronomeEnabled, song.notes, song.timeSignature]);

  // Handle loop points change
  const handleLoopPointsChange = useCallback((start: number, end: number) => {
    // Update loop points
    setLoopStart(start);
    setLoopEnd(end);
    saveToStorage(STORAGE_KEYS.LOOP_START, start);
    saveToStorage(STORAGE_KEYS.LOOP_END, end);
    
    if (isPlaying && loopEnabled) {
      // If we're playing and the current time is outside the new loop boundaries,
      // move playback position to the start of the loop
      if (currentTime < start || currentTime > end) {
        setCurrentTime(start);
        Tone.Transport.seconds = start * (60 / Tone.Transport.bpm.value);
        
        // Update scroll position
        if (containerRef.current) {
          const containerWidth = containerRef.current.clientWidth;
          setScrollOffset(containerWidth / 2 - (start * basePixelsPerBeat));
        }
      }
      
      // Reschedule the notes with the new loop boundaries
      scheduledNotes.current.forEach(id => Tone.Transport.clear(id));
      scheduleNotes(currentTime < start ? start : currentTime);
    }
  }, [isPlaying, loopEnabled, currentTime, basePixelsPerBeat, scheduleNotes]);

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

  // Update getLoopMarkerPosition to be relative to the start of the content
  const getLoopMarkerPosition = useCallback((time: number) => {
    return time * basePixelsPerBeat;
  }, [basePixelsPerBeat]);

  // Handle loop enabled/disabled
  const handleLoopEnabledChange = useCallback((enabled: boolean) => {
    setLoopEnabled(enabled);
    saveToStorage(STORAGE_KEYS.LOOP_ENABLED, enabled);
  }, []);

  // Handle night mode change
  const handleNightModeChange = useCallback((enabled: boolean) => {
    setNightMode(enabled);
    saveToStorage(STORAGE_KEYS.NIGHT_MODE, enabled);
  }, []);

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
        onMetronomeChange={handleMetronomeChange}
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
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

interface TablaturePlayerProps {
  song: SongData;
}

const TablaturePlayer: React.FC<TablaturePlayerProps> = ({ song }) => {
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

  const basePixelsPerBeat = 60;
  
  // State declarations
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [bpm, setBpm] = useState<number>(song.bpm);
  const [visibleNotes, setVisibleNotes] = useState<StringFretNote[]>([]);
  const [guitarType, setGuitarType] = useState<GuitarType>('acoustic');
  const [metronomeEnabled, setMetronomeEnabled] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [loopStart, setLoopStart] = useState(0);
  const [loopEnd, setLoopEnd] = useState(song.notes[song.notes.length - 1].time + song.notes[song.notes.length - 1].duration);
  const [isDragging, setIsDragging] = useState(false);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [startX, setStartX] = useState(0);
  const [isManualScrolling, setIsManualScrolling] = useState(false);
  const [isResetAnimating, setIsResetAnimating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Refs
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const synth = useRef<Tone.PolySynth | null>(null);
  const notesContainerRef = useRef<HTMLDivElement>(null);
  const tablatureContentRef = useRef<HTMLDivElement>(null);
  const dragTimeout = useRef<NodeJS.Timeout>();
  const scheduledNotes = useRef<number[]>([]);
  const metronomeRef = useRef<Tone.Player | null>(null);
  const metronomePart = useRef<Tone.Part | null>(null);
  
  // Calculate the total duration of the song in beats
  const songDuration = useMemo(() => {
    if (!processedSong.notes.length) return 0;
    const lastNote = [...processedSong.notes].sort((a, b) => (b.time + b.duration) - (a.time + a.duration))[0];
    return lastNote.time + lastNote.duration;
  }, [processedSong.notes]);
  
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
    Tone.Transport.bpm.value = song.bpm;
    const [beatsPerBar] = song.timeSignature || [3, 4];
    Tone.Transport.timeSignature = beatsPerBar;
    setBpm(song.bpm);
    setLoopEnd(songDuration);
    
    // Clean up function
    return () => {
      Tone.Transport.stop();
      Tone.Transport.cancel();
      scheduledNotes.current.forEach(id => Tone.Transport.clear(id));
      scheduledNotes.current = [];
    };
  }, [song, songDuration]);
  
  // Schedule all notes when starting playback
  const scheduleNotes = (startBeat = 0) => {
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
        
        // Force an immediate update of visible notes and scroll position
        if (containerRef.current) {
          const containerWidth = containerRef.current.clientWidth;
          setScrollOffset(containerWidth / 2 - (loopStart * basePixelsPerBeat));
        }
        
        // Clear the reset animation flag after a short delay
        setTimeout(() => {
          setIsResetAnimating(false);
        }, 50);
        
        // Reschedule notes from loop start
        scheduleNotes(loopStart);
      }, loopEndTime);
      scheduledNotes.current.push(loopId);
    }
  };
  
  // Update visible notes based on current time
  useEffect(() => {
    // If we're in the middle of a loop reset animation, don't update the notes
    // This prevents flickering during the loop transition
    if (isResetAnimating) {
      return;
    }
    
    // Show notes within a reasonable window to avoid too many notes on screen at once
    const visibleTimeWindowBefore = 2; // 2 seconds before current time
    const visibleTimeWindowAfter = 8;  // 8 seconds after current time
    
    const visible = processedSong.notes.filter(
      (note: Note) => {
        // Handle looping
        if (loopEnabled && isPlaying) {
          // Handle visualization around loop points
          if (currentTime > loopEnd - 1 || currentTime < loopStart + 1) {
            // Around loop boundaries, we have special cases
            
            // Only include notes within the loop region
            if (note.time < loopStart || note.time > loopEnd) {
              return false;
            }
            
            // When near the end of the loop, also show notes from the start
            // to prepare for the visual transition
            if (currentTime > loopEnd - 1) {
              if (note.time >= loopStart && note.time < loopStart + visibleTimeWindowAfter) {
                return true;
              }
            }
          } else {
            // Regular case - only show notes within the loop and current viewport
            if (note.time > loopEnd) {
              return false;
            }
          }
        }
        
        // Standard visibility criteria
        // Include notes that are about to be played (upcoming)
        const isUpcoming = note.time > currentTime - visibleTimeWindowBefore && 
                          note.time < currentTime + visibleTimeWindowAfter;
        
        // Include notes that are currently being played
        const isNoteActive = note.time <= currentTime && 
                          note.time + note.duration > currentTime;
        
        // Include notes that have just finished playing
        const justFinished = note.time + note.duration >= currentTime - 1 && 
                             note.time + note.duration <= currentTime;
        
        return isUpcoming || isNoteActive || justFinished;
      }
    ) as StringFretNote[];
    
    setVisibleNotes(visible);
  }, [currentTime, processedSong.notes, isPlaying, loopEnabled, loopStart, loopEnd, isResetAnimating]);
  
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
    if (isPlaying && currentTime > 0 && containerRef.current) {
      const basePixelsPerBeat = 60;
      const containerWidth = containerRef.current.clientWidth;
      setScrollOffset(containerWidth / 2 - (currentTime * basePixelsPerBeat));
    }
  }, [isPlaying, currentTime]);

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
        
        const delta = timestamp - lastTime;
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
            
            // Update scroll position for loop start
            if (containerRef.current) {
              const containerWidth = containerRef.current.clientWidth;
              setScrollOffset(containerWidth / 2 - (transportTimeInBeats * basePixelsPerBeat));
            }
          }
        } else if (transportTimeInBeats >= songDuration) {
          handleStop();
          return;
        }

        // Store the current time for the next frame
        lastKnownTime = transportTimeInBeats;
        
        setCurrentTime(transportTimeInBeats);
        
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
  }, [isPlaying, songDuration, isManualScrolling, loopEnabled, loopEnd, loopStart, isResetAnimating]);

  // Handle guitar type change
  const handleGuitarTypeChange = async (type: GuitarType) => {
    const wasPlaying = isPlaying;
    if (wasPlaying) {
      handlePause();
    }
    
    setGuitarType(type);
    await guitarSampler.switchGuitar(type);
    
    if (wasPlaying) {
      handlePlay();
    }
  };

  // Handle mute change
  const handleMuteChange = (muted: boolean) => {
    setIsMuted(muted);
    
    // Clear all currently scheduled notes
    scheduledNotes.current.forEach(id => Tone.Transport.clear(id));
    scheduledNotes.current = [];
    
    // Stop any currently playing notes
    guitarSampler.stopAllNotes();
    
    if (!muted && isPlaying) {
      // If unmuting while playing, schedule notes from current position
      scheduleNotes(currentTime);
    }
  };

  // Play a note using the guitar sampler
  const playNote = (note: Note) => {
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
  };
  
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
  
  // Handle play button
  const handlePlay = async () => {
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
      
      // Initialize scroll position
      const containerWidth = containerRef.current.clientWidth;
      setScrollOffset(containerWidth / 2);
      
      // Schedule notes from current position
      scheduleNotes(loopEnabled ? loopStart : currentTime);
      
      // Start transport
      Tone.Transport.start();
      setIsPlaying(true);
    }
  };
  
  // Handle pause button
  const handlePause = () => {
    if (isPlaying) {
      Tone.Transport.pause();
      setIsPlaying(false);
    }
  };
  
  // Handle stop button
  const handleStop = () => {
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
  };
  
  // Handle BPM change
  const handleBpmChange = (newBpm: number) => {
    setBpm(newBpm);
    
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
  };
  
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

  const handleMetronomeChange = (enabled: boolean) => {
    setMetronomeEnabled(enabled);
  };

  const handlePlayPause = async () => {
    await Tone.start();
    
    if (Tone.Transport.state === 'started') {
      // Pause playback
      Tone.Transport.pause();
      setIsPlaying(false);
    } else {
      // Start or resume playback
      if (currentTime >= songDuration) {
        // Reset if at end
        setCurrentTime(0);
        Tone.Transport.seconds = 0;
      }
      
      // If loop is enabled, start from loop start position
      if (loopEnabled) {
        setCurrentTime(loopStart);
        Tone.Transport.seconds = loopStart * (60 / Tone.Transport.bpm.value);
      }
      
      // Schedule notes from current position if not muted
      if (!isMuted) {
        scheduleNotes(loopEnabled ? loopStart : currentTime);
      }
      
      // Start transport
      Tone.Transport.start();
      setIsPlaying(true);
    }
  };

  // Handle loop points change
  const handleLoopPointsChange = (start: number, end: number) => {
    // Store previous values
    const previousStart = loopStart;
    const previousEnd = loopEnd;
    
    // Update loop points
    setLoopStart(start);
    setLoopEnd(end);
    
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
  };

  // Calculate content transform based on scroll offset
  const getContentTransform = useCallback(() => {
    return `translateX(${scrollOffset}px)`;
  }, [scrollOffset]);

  // Handle manual scrolling
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
    
    if (dragTimeout.current) {
      clearTimeout(dragTimeout.current);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    if (tablatureContentRef.current) {
      tablatureContentRef.current.classList.remove('no-transition');
    }

    if (dragTimeout.current) {
      clearTimeout(dragTimeout.current);
    }
    dragTimeout.current = setTimeout(() => {
      setIsManualScrolling(false);
    }, 2000);
  };

  // Handle touch events for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    setStartX(e.touches[0].clientX - scrollOffset);
    if (tablatureContentRef.current) {
      tablatureContentRef.current.classList.add('no-transition');
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    
    const newOffset = e.touches[0].clientX - startX;
    setScrollOffset(newOffset);
    setIsManualScrolling(true);
    
    if (dragTimeout.current) {
      clearTimeout(dragTimeout.current);
    }
    
    dragTimeout.current = setTimeout(() => {
      setIsManualScrolling(false);
    }, 2000);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    if (tablatureContentRef.current) {
      tablatureContentRef.current.classList.remove('no-transition');
    }
  };

  // Calculate the required width for the entire song
  const contentWidth = useMemo(() => {
    const minWidth = 1000; // Minimum width in pixels
    const durationBasedWidth = songDuration * basePixelsPerBeat;
    return Math.max(minWidth, durationBasedWidth + 400); // Add extra padding for visibility
  }, [songDuration]);

  // Update getLoopMarkerPosition to be relative to the start of the content
  const getLoopMarkerPosition = (time: number) => {
    return time * basePixelsPerBeat;
  };

  return (
    <div className="tablature-player" ref={containerRef}>
      <Controls
        isPlaying={isPlaying}
        onPlay={handlePlay}
        onStop={handleStop}
        currentTime={currentTime}
        duration={songDuration}
        guitarType={guitarType}
        onGuitarChange={setGuitarType}
        bpm={bpm}
        onBpmChange={(newBpm) => {
          setBpm(newBpm);
          Tone.Transport.bpm.value = newBpm;
        }}
        metronomeEnabled={metronomeEnabled}
        onMetronomeChange={setMetronomeEnabled}
        isMuted={isMuted}
        onMuteChange={setIsMuted}
        loopEnabled={loopEnabled}
        onLoopChange={setLoopEnabled}
        loopStart={loopStart}
        loopEnd={loopEnd}
        onLoopPointsChange={handleLoopPointsChange}
      />
      
      <VexStaffDisplay
        notes={originalSong.notes}
        currentTime={currentTime}
        timeSignature={originalSong.timeSignature}
        loopEnabled={loopEnabled}
        loopStart={loopStart}
        loopEnd={loopEnd}
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
        
        <div className={`manual-scroll-indicator ${isManualScrolling ? 'visible' : ''}`}>
          Manual Scrolling
        </div>
      </div>
    </div>
  );
};

export default TablaturePlayer; 
import React, { useState, useEffect, useRef, useMemo } from 'react';
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

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [bpm, setBpm] = useState<number>(song.bpm);
  const [visibleNotes, setVisibleNotes] = useState<StringFretNote[]>([]);
  const [guitarType, setGuitarType] = useState<GuitarType>('acoustic');
  
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const synth = useRef<Tone.PolySynth | null>(null);
  const notesContainerRef = useRef<HTMLDivElement>(null);
  
  // Keep track of scheduled notes
  const scheduledNotes = useRef<number[]>([]);
  
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
    setBpm(song.bpm);
    
    // Clean up function
    return () => {
      Tone.Transport.stop();
      Tone.Transport.cancel();
      scheduledNotes.current.forEach(id => Tone.Transport.clear(id));
      scheduledNotes.current = [];
    };
  }, [song]);
  
  // Schedule all notes when starting playback
  const scheduleNotes = (startBeat = 0) => {
    // Clear any previously scheduled notes
    scheduledNotes.current.forEach(id => Tone.Transport.clear(id));
    scheduledNotes.current = [];

    // Schedule each note that comes after startBeat
    processedSong.notes
      .filter((note: Note) => note.time >= startBeat)
      .forEach((note: Note) => {
        const timeInSeconds = note.time * (60 / Tone.Transport.bpm.value);
        const id = Tone.Transport.schedule((time) => {
          playNote(note);
        }, timeInSeconds);
        scheduledNotes.current.push(id);
      });
  };
  
  // Update visible notes based on current time
  useEffect(() => {
    // Show notes within a reasonable window to avoid too many notes on screen at once
    const visibleTimeWindowBefore = 2; // 2 seconds before current time
    const visibleTimeWindowAfter = 8;  // 8 seconds after current time
    
    const visible = processedSong.notes.filter(
      (note: Note) => {
        // A note is visible if:
        // 1. It's about to be played (upcoming)
        // 2. It's currently being played
        // 3. It has just finished playing
        
        // Include notes that are about to be played
        const isUpcoming = note.time > currentTime - visibleTimeWindowBefore && 
                          note.time < currentTime + visibleTimeWindowAfter;
        
        // Include notes that are currently being played (any part of the note is crossing the current time)
        const isPlaying = note.time <= currentTime && 
                          note.time + note.duration > currentTime;
        
        // Include notes that have just finished playing (within the last 1 second)
        const justFinished = note.time + note.duration >= currentTime - 1 && 
                             note.time + note.duration <= currentTime;
        
        return isUpcoming || isPlaying || justFinished;
      }
    ) as StringFretNote[];
    
    setVisibleNotes(visible);
  }, [currentTime, processedSong.notes]);
  
  // Update current time based on Transport position
  useEffect(() => {
    let animationFrame: number;

    const updateTime = () => {
      if (isPlaying) {
        // Convert Transport time to beats
        const transportTimeInBeats = Tone.Transport.seconds * (Tone.Transport.bpm.value / 60);
        
        // Check if we need to loop
        if (transportTimeInBeats >= songDuration) {
          // Stop transport and clear scheduled notes
          Tone.Transport.stop();
          scheduledNotes.current.forEach(id => Tone.Transport.clear(id));
          scheduledNotes.current = [];
          
          // Reset position
          Tone.Transport.seconds = 0;
          setCurrentTime(0);
          
          // Reschedule notes and restart
          scheduleNotes(0);
          Tone.Transport.start();
        } else {
          setCurrentTime(transportTimeInBeats);
        }
      }
      animationFrame = requestAnimationFrame(updateTime);
    };

    if (isPlaying) {
      animationFrame = requestAnimationFrame(updateTime);
    }

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [isPlaying, songDuration]);
  
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

  // Play a note using the guitar sampler
  const playNote = (note: Note) => {
    if (!guitarSampler.isReady()) return;

    let noteToPlay: string | null = null;

    if ('note' in note) {
      // PitchNote - direct note name
      noteToPlay = note.note;
    } else if ('string' in note) {
      // StringFretNote - calculate from string and fret
      const baseNotes = ['E4', 'B3', 'G3', 'D3', 'A2', 'E2']; // Order from high to low
      const stringIndex = note.string - 1; // Convert to 0-based index
      const baseNote = baseNotes[stringIndex];
      noteToPlay = Tone.Frequency(baseNote).transpose(note.fret).toNote();
    }

    if (noteToPlay) {
      guitarSampler.playNote(noteToPlay, Tone.now(), note.duration);
    }
  };
  
  // Generate grid lines for better visual reference
  const renderGridLines = () => {
    const gridLines = [];
    
    // Horizontal lines (for strings)
    for (let i = 1; i <= 6; i++) {
      // Adjust for the new display height (400px / 6 strings)
      const stringHeight = 66.67;
      // Reverse the position calculation so string 1 is at the bottom
      const yPosition = (6 - i) * stringHeight + (stringHeight / 2);
      
      gridLines.push(
        <div 
          key={`h-${i}`} 
          className="grid-line" 
          style={{ top: `${yPosition}px` }}
        />
      );
    }
    
    // Vertical lines (time markers)
    for (let i = 1; i <= 10; i++) {
      const xPosition = i * 10; // Every 10% of the width
      
      gridLines.push(
        <div 
          key={`v-${i}`} 
          className="grid-line vertical" 
          style={{ left: `${xPosition}%` }}
        />
      );
    }
    
    return gridLines;
  };
  
  // Handle play button
  const handlePlay = async () => {
    await Tone.start();
    if (!isPlaying) {
      // Reset if at end
      if (currentTime >= songDuration) {
        setCurrentTime(0);
        Tone.Transport.seconds = 0;
      }
      
      // Schedule notes from current position
      scheduleNotes(currentTime);
      
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
    
    // Reset position
    Tone.Transport.seconds = 0;
    setCurrentTime(0);
    setIsPlaying(false);
  };
  
  // Handle BPM change
  const handleBpmChange = (newBpm: number) => {
    setBpm(newBpm);
    
    // Store current position in beats
    const wasPlaying = isPlaying;
    const currentPositionInBeats = currentTime;
    
    // Pause if playing
    if (wasPlaying) {
      Tone.Transport.pause();
    }
    
    // Update tempo
    Tone.Transport.bpm.value = newBpm;
    
    // Convert current position from beats to seconds for the new tempo
    const newPositionInSeconds = currentPositionInBeats * (60 / newBpm);
    
    // Resume if was playing
    if (wasPlaying) {
      // Reschedule notes from current position
      scheduleNotes(currentPositionInBeats);
      Tone.Transport.seconds = newPositionInSeconds;
      Tone.Transport.start();
    }
  };
  
  return (
    <div className="tablature-player">
      <Controls 
        isPlaying={isPlaying}
        onPlay={handlePlay}
        onPause={handlePause}
        onStop={handleStop}
        bpm={bpm}
        onBpmChange={handleBpmChange}
        currentTime={currentTime}
        songDuration={songDuration}
        guitarType={guitarType}
        onGuitarTypeChange={handleGuitarTypeChange}
      />
      
      <VexStaffDisplay
        notes={originalSong.notes}
        currentTime={currentTime}
        timeSignature={originalSong.timeSignature}
      />
      
      <div className="tablature-display">
        <div className="grid-lines">
          {renderGridLines()}
        </div>
        
        <div className="trigger-line"></div>
        
        <div className="strings-container">
          {[6, 5, 4, 3, 2, 1].map(stringNum => (
            <GuitarString key={stringNum} stringNumber={stringNum} />
          ))}
        </div>
        
        <div className="notes-container" ref={notesContainerRef}>
          {visibleNotes.map((note, index) => (
            <NoteElement 
              key={`${note.string}-${note.time}-${index}`}
              note={note}
              currentTime={currentTime}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default TablaturePlayer; 
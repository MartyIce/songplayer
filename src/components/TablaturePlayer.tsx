import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as Tone from 'tone';
import { SongData, StringFretNote, Note } from '../types/SongTypes';
import './TablaturePlayer.css';
import GuitarString from './GuitarString';
import NoteElement from './NoteElement';
import Controls from './Controls';
import VexStaffDisplay from './VexStaffDisplay';
import { convertSongToStringFret } from '../utils/noteConverter';

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
  const [speed, setSpeed] = useState<number>(1);
  const [visibleNotes, setVisibleNotes] = useState<StringFretNote[]>([]);
  
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const synth = useRef<Tone.PolySynth | null>(null);
  const notesContainerRef = useRef<HTMLDivElement>(null);
  
  // Calculate the total duration of the song
  const songDuration = useMemo(() => {
    if (!processedSong.notes.length) return 0;
    
    const lastNote = [...processedSong.notes].sort((a, b) => (b.time + b.duration) - (a.time + a.duration))[0];
    return lastNote.time + lastNote.duration + 1; // Add a small buffer
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
  
  // Animation loop
  const animate = (time: number) => {
    if (!lastTimeRef.current) {
      lastTimeRef.current = time;
    }
    
    const deltaTime = (time - lastTimeRef.current) / 1000;
    lastTimeRef.current = time;
    
    setCurrentTime(prevTime => {
      let newTime = prevTime + deltaTime * speed;
      
      // Check if the song has reached the end and loop back to the beginning
      if (newTime >= songDuration) {
        newTime = 0;
        lastTimeRef.current = 0;
      }
      
      // Track which notes have already been triggered to prevent duplicate playback
      const playedNotesMap = new Map();
      
      // Check if any notes should be played (only when the exact start time is crossed)
      processedSong.notes.forEach((note: Note) => {
        // Generate a unique ID for the note
        const noteId = `${note.time.toFixed(3)}-${'note' in note ? note.note : `${note.string}-${note.fret}`}`;
        
        // A note should be played if:
        // 1. We haven't played it already
        // 2. Its start time is between the previous and current time positions
        // 3. We haven't gone backwards in time (e.g., when looping back to start)
        const shouldPlay = 
          !playedNotesMap.has(noteId) && 
          note.time >= prevTime && 
          note.time < newTime &&
          newTime > prevTime; // Ensure we didn't wrap around
          
        if (shouldPlay) {
          playNote(note);
          playedNotesMap.set(noteId, true);
        }
      });
      
      return newTime;
    });
    
    animationRef.current = requestAnimationFrame(animate);
  };
  
  // Play a note using Tone.js
  const playNote = (note: Note) => {
    if (!synth.current) return;
    
    let noteFrequency: number;
    
    if ('note' in note) {
      // PitchNote - already has the note name
      noteFrequency = Tone.Frequency(note.note).toFrequency();
    } else {
      // StringFretNote - calculate from string and fret
      const baseNotes = ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'];
      const stringIndex = 6 - note.string; // Convert to 0-based index, reversed
      const baseNote = baseNotes[stringIndex];
      
      // Calculate the actual note based on the fret
      noteFrequency = Tone.Frequency(baseNote).transpose(note.fret).toFrequency();
    }
    
    // To ensure exact note durations without overlap, we'll use the precise duration from the note
    // This ensures that if one note ends at time 2.0 and another starts at 2.0, they don't overlap
    synth.current.triggerAttackRelease(noteFrequency, note.duration);
  };
  
  // Generate grid lines for better visual reference
  const renderGridLines = () => {
    const gridLines = [];
    
    // Horizontal lines (for strings)
    for (let i = 1; i <= 6; i++) {
      // Adjust for the new display height (400px / 6 strings)
      const stringHeight = 66.67;
      const yPosition = (i - 1) * stringHeight + (stringHeight / 2);
      
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
  
  // Control functions
  const handlePlay = () => {
    if (!isPlaying) {
      Tone.start();
      lastTimeRef.current = 0;
      animationRef.current = requestAnimationFrame(animate);
      setIsPlaying(true);
    }
  };
  
  const handlePause = () => {
    if (isPlaying && animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      setIsPlaying(false);
    }
  };
  
  const handleStop = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      setIsPlaying(false);
      setCurrentTime(0);
    }
  };
  
  const handleSpeedChange = (newSpeed: number) => {
    setSpeed(newSpeed);
  };
  
  return (
    <div className="tablature-player">
      <Controls 
        isPlaying={isPlaying}
        onPlay={handlePlay}
        onPause={handlePause}
        onStop={handleStop}
        speed={speed}
        onSpeedChange={handleSpeedChange}
        currentTime={currentTime}
        songDuration={songDuration}
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
          {[1, 2, 3, 4, 5, 6].map(stringNum => (
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
import React, { useState, useEffect, useRef } from 'react';
import * as Tone from 'tone';
import { SongData, Note } from '../types/SongTypes';
import './TablaturePlayer.css';
import GuitarString from './GuitarString';
import NoteElement from './NoteElement';
import Controls from './Controls';

interface TablaturePlayerProps {
  song: SongData;
}

const TablaturePlayer: React.FC<TablaturePlayerProps> = ({ song }) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [speed, setSpeed] = useState<number>(1);
  const [visibleNotes, setVisibleNotes] = useState<Note[]>([]);
  
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const synth = useRef<Tone.PolySynth | null>(null);
  const notesContainerRef = useRef<HTMLDivElement>(null);
  
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
    // Show notes that are within the next 5 seconds
    const visibleTimeWindow = 5;
    const visible = song.notes.filter(
      note => note.time >= currentTime && note.time <= currentTime + visibleTimeWindow
    );
    setVisibleNotes(visible);
  }, [currentTime, song.notes]);
  
  // Animation loop
  const animate = (time: number) => {
    if (!lastTimeRef.current) {
      lastTimeRef.current = time;
    }
    
    const deltaTime = (time - lastTimeRef.current) / 1000;
    lastTimeRef.current = time;
    
    setCurrentTime(prevTime => {
      const newTime = prevTime + deltaTime * speed;
      
      // Check if any notes should be played
      song.notes.forEach(note => {
        if (note.time >= prevTime && note.time < newTime) {
          playNote(note);
        }
      });
      
      return newTime;
    });
    
    animationRef.current = requestAnimationFrame(animate);
  };
  
  // Play a note using Tone.js
  const playNote = (note: Note) => {
    if (!synth.current) return;
    
    // Map string and fret to a note
    // Standard tuning: E2, A2, D3, G3, B3, E4 (from 6th to 1st string)
    const baseNotes = ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'];
    const stringIndex = 6 - note.string; // Convert to 0-based index, reversed
    const baseNote = baseNotes[stringIndex];
    
    // Calculate the actual note based on the fret
    const noteObj = Tone.Frequency(baseNote).transpose(note.fret);
    
    synth.current.triggerAttackRelease(noteObj.toFrequency(), note.duration);
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
      />
      
      <div className="tablature-display">
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
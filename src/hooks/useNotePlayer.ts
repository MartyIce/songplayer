import * as Tone from 'tone';
import { useCallback, useRef } from 'react';
import { Note } from '../types/SongTypes';
import { guitarSampler } from '../utils/GuitarSampler';

interface UseNotePlayerProps {
  isMuted: boolean;
  chordsEnabled: boolean;
  chordsVolume: number;
  loopEnabled: boolean;
  loopStart: number;
  loopEnd: number;
  onResetAnimation: () => void;
}

export const useNotePlayer = ({
  isMuted,
  chordsEnabled,
  chordsVolume,
  loopEnabled,
  loopStart,
  loopEnd,
  onResetAnimation,
}: UseNotePlayerProps) => {
  const scheduledNotes = useRef<number[]>([]);

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
      guitarSampler.playNote(noteToPlay, Tone.now(), note.duration * (60 / Tone.Transport.bpm.value), null);
    }
  }, [isMuted]);

  const playChord = useCallback((chord: string, duration: number) => {
    if (!guitarSampler.isReady() || isMuted || !chordsEnabled) {
      return;
    }

    const durationInSeconds = duration * (60 / Tone.Transport.bpm.value);

    // Define common chord shapes
    const chordShapes: { [key: string]: string[] } = {
      'A': ['A2', 'E3', 'A3', 'C#4', 'E4'],
      'Am': ['A2', 'E3', 'A3', 'C4', 'E4'],
      'A7': ['A2', 'E3', 'G3', 'C#4', 'E4'],
      'A#': ['A#2', 'F3', 'A#3', 'D4', 'F4'],
      'A#m': ['A#2', 'F3', 'A#3', 'C#4', 'F4'],
      'A#7': ['A#2', 'F3', 'G#3', 'D4', 'F4'],
      'B': ['B2', 'F#3', 'B3', 'D#4', 'F#4'],
      'Bm': ['B2', 'F#3', 'B3', 'D4', 'F#4'],
      'B7': ['B2', 'F#3', 'A3', 'D#4', 'F#4'],
      'C': ['C3', 'E3', 'G3', 'C4', 'E4'],
      'Cm': ['C3', 'Eb3', 'G3', 'C4', 'Eb4'],
      'C7': ['C3', 'E3', 'Bb3', 'C4', 'E4'],
      'C#': ['C#3', 'F3', 'G#3', 'C#4', 'F4'],
      'C#m': ['C#3', 'E3', 'G#3', 'C#4', 'E4'],
      'C#7': ['C#3', 'F3', 'B3', 'C#4', 'F4'],
      'D': ['D3', 'A3', 'D4', 'F#4'],
      'Dm': ['D3', 'A3', 'D4', 'F4'],
      'D7': ['D3', 'F#3', 'C4', 'D4'],
      'D#': ['D#3', 'A#3', 'D#4', 'G4'],
      'D#m': ['D#3', 'A#3', 'D#4', 'F#4'],
      'D#7': ['D#3', 'G3', 'C#4', 'D#4'],
      'E': ['E2', 'B2', 'E3', 'G#3', 'B3', 'E4'],
      'Em': ['E2', 'B2', 'E3', 'G3', 'B3', 'E4'],
      'E7': ['E2', 'B2', 'D3', 'G#3', 'B3', 'E4'],
      'F': ['F2', 'C3', 'F3', 'A3', 'C4'],
      'Fm': ['F2', 'C3', 'F3', 'Ab3', 'C4'],
      'F7': ['F2', 'C3', 'Eb3', 'A3', 'C4'],
      'F#': ['F#2', 'C#3', 'F#3', 'A#3', 'C#4'],
      'F#m': ['F#2', 'C#3', 'F#3', 'A3', 'C#4'],
      'F#7': ['F#2', 'C#3', 'E3', 'A#3', 'C#4'],
      'G': ['G2', 'B2', 'D3', 'G3', 'B3', 'G4'],
      'Gm': ['G2', 'Bb2', 'D3', 'G3', 'Bb3', 'D4'],
      'G7': ['G2', 'B2', 'F3', 'G3', 'B3', 'D4'],
      'G#': ['G#2', 'C3', 'D#3', 'G#3', 'C4', 'G#4'],
      'G#m': ['G#2', 'B2', 'D#3', 'G#3', 'B3', 'D#4'],
      'G#7': ['G#2', 'C3', 'F#3', 'G#3', 'C4', 'D#4'],
    };

    // Extract the base chord name (e.g., "Am" from "Am7")
    const baseChord = chord.replace(/[0-9]/g, '');
    
    if (chordShapes[baseChord]) {
      // Play each note in the chord with a slight strum effect
      chordShapes[baseChord].forEach((note, index) => {
        const strumDelay = index * 0.02; // 20ms between each note for natural strum sound
        guitarSampler.playNote(note, Tone.now() + strumDelay, durationInSeconds, chordsVolume);
      });
    }
  }, [isMuted, chordsEnabled, chordsVolume]);

  const scheduleChords = useCallback((song: { chords?: { chord: string; measure: number }[]; timeSignature: [number, number] }, startTime: number) => {
    if (!song.chords || !chordsEnabled) return;

    // Calculate beats per measure from time signature
    const beatsPerMeasure = song.timeSignature[0];

    // Schedule chords from the current measure
    song.chords.forEach(({ chord, measure }) => {
      // Convert measure number to beat time (measure numbers start at 1)
      const chordTime = (measure - 1) * beatsPerMeasure;
      
      // Only schedule if the chord is after our start time and within loop bounds if looping
      if (chordTime >= startTime && (!loopEnabled || (chordTime >= loopStart && chordTime < loopEnd))) {
        const id = Tone.Transport.schedule((time) => {
          playChord(chord, beatsPerMeasure);
        }, chordTime * (60 / Tone.Transport.bpm.value));
        scheduledNotes.current.push(id);
      }
    });
  }, [chordsEnabled, loopEnabled, loopStart, loopEnd, playChord]);

  const scheduleNotes = useCallback((song: { notes: Note[]; chords?: { chord: string; measure: number }[]; timeSignature: [number, number] }, startTime: number, songDuration: number) => {
    // Clear any previously scheduled notes
    scheduledNotes.current.forEach(id => Tone.Transport.clear(id));
    scheduledNotes.current = [];

    if (isMuted) return; // Don't schedule notes if muted

    // Schedule each note that comes after startTime
    song.notes
      .filter((note: Note) => {
        if (loopEnabled) {
          return note.time >= startTime && note.time < loopEnd;
        }
        return note.time >= startTime;
      })
      .forEach((note: Note) => {
        const timeInSeconds = note.time * (60 / Tone.Transport.bpm.value);
        const id = Tone.Transport.schedule(time => {
          playNote(note);
        }, timeInSeconds);
        scheduledNotes.current.push(id);
      });

    // Schedule chords if they exist and are enabled
    if (chordsEnabled) {
      scheduleChords(song, startTime);
    }

    // Schedule loop if enabled
    if (loopEnabled) {
      const loopEndTime = loopEnd * (60 / Tone.Transport.bpm.value);
      const loopId = Tone.Transport.schedule(time => {
        // Signal that we're resetting for animation purposes
        onResetAnimation();
        
        // Reset transport position to loop start
        const loopStartSeconds = loopStart * (60 / Tone.Transport.bpm.value);
        Tone.Transport.seconds = loopStartSeconds;
        
        // Reset to loop start point and reschedule notes
        scheduleNotes(song, loopStart, songDuration);
      }, loopEndTime);
      scheduledNotes.current.push(loopId);
    }
  }, [loopEnabled, loopEnd, loopStart, isMuted, playNote, scheduleChords, chordsEnabled, onResetAnimation]);

  const clearScheduledNotes = useCallback(() => {
    scheduledNotes.current.forEach(id => Tone.Transport.clear(id));
    scheduledNotes.current = [];
    guitarSampler.stopAllNotes();
  }, []);

  return {
    playNote,
    playChord,
    scheduleNotes,
    clearScheduledNotes,
  };
}; 
import { useState, useEffect, useRef, useCallback } from 'react';
import * as Tone from 'tone';
import { Note } from '../../types/SongTypes'; // Assuming SongTypes is in src/types
import { STORAGE_KEYS, getFromStorage, saveToStorage } from '../../utils/localStorage';

interface UseMetronomeProps {
  notes: Note[];
  timeSignature?: [number, number];
  clickOffset?: number; // Time in seconds to offset metronome clicks (default: 0)
}

interface UseMetronomeReturn {
  metronomeEnabled: boolean;
  toggleMetronome: (enabled: boolean) => void;
  scheduleMetronomeClicks: (startBeat: number) => void;
  clearScheduledClicks: () => void;
}

export const useMetronome = ({ notes, timeSignature, clickOffset = 0.005 }: UseMetronomeProps): UseMetronomeReturn => {
  // Use state for UI updates
  const [metronomeEnabled, setMetronomeEnabled] = useState(() => {
    const initialValue = getFromStorage(STORAGE_KEYS.METRONOME_ENABLED, false);
    console.log('[useMetronome] Initial metronomeEnabled:', initialValue); // Log initial state
    return initialValue;
  });
  
  // Use refs to always have the current values in callbacks
  const metronomeEnabledRef = useRef(metronomeEnabled);
  const metronomePart = useRef<Tone.Part | null>(null);
  const clickSynth = useRef<Tone.Synth | null>(null);

  // Update ref whenever the state changes
  useEffect(() => {
    metronomeEnabledRef.current = metronomeEnabled;
  }, [metronomeEnabled]);

  const createMetronomePart = useCallback((startOffset = 0) => {
    console.log('[useMetronome] Creating metronome part with offset:', startOffset);
    
    if (!notes?.length || !timeSignature || !clickSynth.current) {
      console.warn('[useMetronome] Missing required data for metronome setup');
      return null;
    }

    const [beatsPerBar] = timeSignature;
    
    // Calculate total beats based on the last note's end time
    const lastNote = [...notes].sort((a, b) => (b.time + b.duration) - (a.time + a.duration))[0];
    const totalBeats = lastNote ? Math.ceil(lastNote.time + lastNote.duration) : 0;
    console.log('[useMetronome] Calculated beatsPerBar:', beatsPerBar, 'totalBeats:', totalBeats);

    if (totalBeats <= 0) {
      return null;
    }

    // Calculate the starting beat based on the current transport time
    const currentBeat = Math.floor(startOffset);
    console.log('[useMetronome] Starting from beat:', currentBeat);

    // Create events starting from the current beat
    const metronomeEvents = Array.from(
      { length: totalBeats - currentBeat }, 
      (_, i) => {
        const absoluteBeat = currentBeat + i;
        return {
          time: `${Math.floor(absoluteBeat / beatsPerBar)}:${absoluteBeat % beatsPerBar}:0`,
          beat: absoluteBeat % beatsPerBar
        };
      }
    );

    const part = new Tone.Part((time, event) => {
      if (!metronomeEnabledRef.current || !clickSynth.current) return;
      
      const isAccent = event.beat === 0;
      console.log('[useMetronome] Triggering click', { time, beat: event.beat, isAccent });
      
      try {
        // Add the small offset to the scheduled time
        const adjustedTime = time + clickOffset;
        
        clickSynth.current.triggerAttackRelease(
          isAccent ? 1200 : 800, // Higher pitch for accented beats
          0.02, // Short duration
          adjustedTime, // Use adjusted time for better synchronization
          isAccent ? 0.5 : 0.3 // Control volume through velocity
        );
      } catch (error) {
        console.error('[useMetronome] Error triggering click:', error);
      }
    }, metronomeEvents);

    part.loop = false;
    return part;
  }, [notes, timeSignature, clickOffset]);

  const clearScheduledClicks = useCallback(() => {
    console.log('[useMetronome] Clearing scheduled clicks');
    if (metronomePart.current) {
      metronomePart.current.stop();
      metronomePart.current.dispose();
      metronomePart.current = null;
    }
  }, []);

  const scheduleMetronomeClicks = useCallback((startBeat: number) => {
    console.log('[useMetronome] Scheduling metronome clicks from beat:', startBeat);
    if (!metronomeEnabled) return;

    // Clear any existing scheduled clicks
    clearScheduledClicks();

    // Create and start new part
    const newPart = createMetronomePart(startBeat);
    if (newPart) {
      metronomePart.current = newPart;
      metronomePart.current.start(0);
    }
  }, [metronomeEnabled, createMetronomePart, clearScheduledClicks]);

  const handleMetronomeChange = useCallback((enabled: boolean) => {
    console.log('[useMetronome] Toggling metronomeEnabled to:', enabled);
    setMetronomeEnabled(enabled);
    metronomeEnabledRef.current = enabled;
    saveToStorage(STORAGE_KEYS.METRONOME_ENABLED, enabled);

    if (enabled) {
      // Schedule clicks from current transport position
      const currentBeat = Tone.Transport.position.toString().split(':');
      const beatPosition = (parseInt(currentBeat[0]) * (timeSignature?.[0] || 4)) + parseInt(currentBeat[1]);
      scheduleMetronomeClicks(beatPosition);
    } else {
      clearScheduledClicks();
    }
  }, [timeSignature, scheduleMetronomeClicks, clearScheduledClicks]);

  // Effect to create and initialize the synth
  useEffect(() => {
    console.log('[useMetronome] Creating clickSynth');
    
    // Create a click synth with a short envelope and higher volume for better audibility
    clickSynth.current = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.05 },
      volume: 0, // Full volume - we'll control it in the trigger
    }).toDestination();
    
    return () => {
      if (clickSynth.current) {
        clickSynth.current.dispose();
        clickSynth.current = null;
      }
    };
  }, []);

  return {
    metronomeEnabled,
    toggleMetronome: handleMetronomeChange,
    scheduleMetronomeClicks,
    clearScheduledClicks
  };
}; 
import { useState, useEffect, useRef, useCallback } from 'react';
import * as Tone from 'tone';
import { Note } from '../../types/SongTypes'; // Assuming SongTypes is in src/types
import { STORAGE_KEYS, getFromStorage, saveToStorage } from '../../utils/localStorage';

interface UseMetronomeProps {
  notes: Note[];
  timeSignature?: [number, number];
  clickOffset?: number; // Time in seconds to offset metronome clicks (default: 0)
}

export const useMetronome = ({ notes, timeSignature, clickOffset = 0.005 }: UseMetronomeProps) => {
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

  const handleMetronomeChange = useCallback((enabled: boolean) => {
    console.log('[useMetronome] Toggling metronomeEnabled to:', enabled); // Log toggle
    setMetronomeEnabled(enabled);
    metronomeEnabledRef.current = enabled;
    saveToStorage(STORAGE_KEYS.METRONOME_ENABLED, enabled);
  }, []);

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
  }, [notes, timeSignature]);

  const startMetronome = useCallback(() => {
    console.log('[useMetronome] Starting metronome');
    
    // Always clean up existing part
    if (metronomePart.current) {
      metronomePart.current.stop();
      metronomePart.current.dispose();
      metronomePart.current = null;
    }

    // Get current transport position in beats
    const currentBeat = Tone.Transport.position.toString().split(':');
    const beatPosition = (parseInt(currentBeat[0]) * timeSignature![0]) + parseInt(currentBeat[1]);
    console.log('[useMetronome] Current transport position in beats:', beatPosition);

    // Create new part starting from current position
    const newPart = createMetronomePart(beatPosition);
    if (newPart) {
      metronomePart.current = newPart;
      try {
        metronomePart.current.start(0);
        console.log('[useMetronome] Metronome started successfully');
      } catch (error) {
        console.error('[useMetronome] Error starting metronome:', error);
      }
    }
  }, [createMetronomePart, timeSignature]);

  const stopMetronome = useCallback(() => {
    console.log('[useMetronome] Stopping metronome');
    if (metronomePart.current) {
      try {
        metronomePart.current.stop();
        metronomePart.current.dispose();
        metronomePart.current = null;
        console.log('[useMetronome] Metronome stopped and disposed');
      } catch (error) {
        console.error('[useMetronome] Error stopping metronome:', error);
      }
    }
  }, []);

  // Effect to manage the metronome part and context state
  useEffect(() => {
    // Listen for transport state changes
    const handleTransportStateChange = () => {
      const state = Tone.Transport.state;
      console.log('[useMetronome] Transport state changed:', state);
      
      if (state === 'started') {
        startMetronome();
      } else if (state === 'stopped' || state === 'paused') {
        stopMetronome();
      }
    };

    // Set up initial state
    if (Tone.Transport.state === 'started') {
      startMetronome();
    }

    // Subscribe to transport state changes
    Tone.Transport.on('start', handleTransportStateChange);
    Tone.Transport.on('stop', handleTransportStateChange);
    Tone.Transport.on('pause', handleTransportStateChange);

    return () => {
      console.log('[useMetronome] Effect cleanup');
      Tone.Transport.off('start', handleTransportStateChange);
      Tone.Transport.off('stop', handleTransportStateChange);
      Tone.Transport.off('pause', handleTransportStateChange);
      stopMetronome();
    };
  }, [startMetronome, stopMetronome]);

  // Cleanup synth on unmount
  useEffect(() => {
    return () => {
      console.log('[useMetronome] Component unmounting, disposing clickSynth');
      if (clickSynth.current) {
        clickSynth.current.dispose();
        clickSynth.current = null;
      }
    };
  }, []);

  return {
    metronomeEnabled,
    toggleMetronome: handleMetronomeChange,
  };
}; 
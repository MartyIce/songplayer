import { useState, useCallback, useEffect } from 'react';
import * as Tone from 'tone';
import { STORAGE_KEYS, saveToStorage, getFromStorage } from '../../utils/localStorage';

interface UseLoopControlProps {
  songDuration: number;
  isPlaying: boolean;
  currentTime: number;
  onResetAnimation: () => void;
  basePixelsPerBeat: number;
  onLoopReset: () => void;
}

interface UseLoopControlReturn {
  loopEnabled: boolean;
  loopStart: number;
  loopEnd: number;
  handleLoopEnabledChange: (enabled: boolean) => void;
  handleLoopPointsChange: (start: number, end: number) => void;
  getLoopMarkerPosition: (time: number) => number;
  checkAndHandleLoopReset: (currentTimeInBeats: number) => boolean;
}

export const useLoopControl = ({
  songDuration,
  isPlaying,
  currentTime,
  onResetAnimation,
  basePixelsPerBeat,
  onLoopReset
}: UseLoopControlProps): UseLoopControlReturn => {
  // Loop state
  const [loopEnabled, setLoopEnabled] = useState(() => getFromStorage(STORAGE_KEYS.LOOP_ENABLED, false));
  const [loopStart, setLoopStart] = useState(() => getFromStorage(STORAGE_KEYS.LOOP_START, 0));
  const [loopEnd, setLoopEnd] = useState(() => {
    const savedLoopEnd = getFromStorage(STORAGE_KEYS.LOOP_END, null);
    return savedLoopEnd !== null ? savedLoopEnd : songDuration;
  });

  // Update loop end when song duration changes
  useEffect(() => {
    const savedLoopEnd = getFromStorage(STORAGE_KEYS.LOOP_END, null);
    if (savedLoopEnd === null) {
      setLoopEnd(songDuration);
    }
  }, [songDuration]);

  const handleLoopEnabledChange = useCallback((enabled: boolean) => {
    setLoopEnabled(enabled);
    saveToStorage(STORAGE_KEYS.LOOP_ENABLED, enabled);

    if (enabled && isPlaying) {
      // If we're playing and the current time is outside the loop boundaries,
      // move playback position to the start of the loop
      if (currentTime < loopStart || currentTime > loopEnd) {
        onResetAnimation();
        Tone.Transport.seconds = loopStart * (60 / Tone.Transport.bpm.value);
        onLoopReset();
      }
    }
  }, [isPlaying, currentTime, loopStart, loopEnd, onResetAnimation, onLoopReset]);

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
        onResetAnimation();
        Tone.Transport.seconds = start * (60 / Tone.Transport.bpm.value);
        onLoopReset();
      }
    }
  }, [isPlaying, loopEnabled, currentTime, onResetAnimation, onLoopReset]);

  const checkAndHandleLoopReset = useCallback((currentTimeInBeats: number) => {
    if (loopEnabled && currentTimeInBeats >= loopEnd) {
      onResetAnimation();
      const loopStartSeconds = loopStart * (60 / Tone.Transport.bpm.value);
      Tone.Transport.seconds = loopStartSeconds;
      onLoopReset();
      return true;
    }
    return false;
  }, [loopEnabled, loopEnd, loopStart, onResetAnimation, onLoopReset]);

  const getLoopMarkerPosition = useCallback((time: number) => {
    return time * basePixelsPerBeat;
  }, [basePixelsPerBeat]);

  return {
    loopEnabled,
    loopStart,
    loopEnd,
    handleLoopEnabledChange,
    handleLoopPointsChange,
    getLoopMarkerPosition,
    checkAndHandleLoopReset
  };
}; 
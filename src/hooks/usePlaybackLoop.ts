import { useEffect } from 'react';
import * as Tone from 'tone';

interface UsePlaybackLoopProps {
  isPlaying: boolean;
  isResetAnimating: boolean;
  currentTime: number;
  songDuration: number;
  loopEnabled: boolean;
  loopEnd: number;
  setCurrentTime: (time: number) => void;
  clearNotes: () => void;
  clearScheduledNotes: () => void;
  scheduleNotes: (song: any, startTime: number, duration: number) => void;
  scheduleMetronomeClicks: (startTime: number) => void;
  metronomeEnabled: boolean;
  processedSong: any;
}

export const usePlaybackLoop = ({
  isPlaying,
  isResetAnimating,
  currentTime,
  songDuration,
  loopEnabled,
  loopEnd,
  setCurrentTime,
  clearNotes,
  clearScheduledNotes,
  scheduleNotes,
  scheduleMetronomeClicks,
  metronomeEnabled,
  processedSong,
}: UsePlaybackLoopProps) => {
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
            clearNotes(); // Clear notes for a clean restart
          }
        } else if (transportTimeInBeats >= songDuration) {
          // For non-loop playback, restart from beginning
          clearNotes();
          clearScheduledNotes();
          Tone.Transport.stop();
          Tone.Transport.seconds = 0;
          setCurrentTime(0);
          scheduleNotes(processedSong, 0, songDuration);
          if (metronomeEnabled) {
            scheduleMetronomeClicks(0);
          }
          Tone.Transport.start();
          lastKnownTime = 0;
          animationFrame = requestAnimationFrame(updateTime);
          return;
        }

        // Store the current time for the next frame
        lastKnownTime = transportTimeInBeats;
        
        setCurrentTime(transportTimeInBeats);
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
  }, [
    isPlaying,
    songDuration,
    loopEnabled,
    loopEnd,
    isResetAnimating,
    currentTime,
    clearNotes,
    clearScheduledNotes,
    scheduleNotes,
    processedSong,
    metronomeEnabled,
    scheduleMetronomeClicks,
    setCurrentTime
  ]);
}; 
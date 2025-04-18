import { useCallback, useEffect, useRef } from 'react';
import * as Tone from 'tone';

interface UseTransportControlProps {
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  currentTime: number;
  setCurrentTime: (time: number) => void;
  songDuration: number;
  loopEnabled: boolean;
  loopStart: number;
  metronomeEnabled: boolean;
  scheduleNotes: (song: any, startTime: number, duration: number) => void;
  scheduleMetronomeClicks: (startTime: number) => void;
  clearScheduledNotes: () => void;
  clearScheduledClicks: () => void;
  processedSong: any;
}

export const useTransportControl = ({
  isPlaying,
  setIsPlaying,
  currentTime,
  setCurrentTime,
  songDuration,
  loopEnabled,
  loopStart,
  metronomeEnabled,
  scheduleNotes,
  scheduleMetronomeClicks,
  clearScheduledNotes,
  clearScheduledClicks,
  processedSong
}: UseTransportControlProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const handleStop = useCallback(() => {
    Tone.Transport.stop();
    clearScheduledNotes();
    clearScheduledClicks();
    Tone.Transport.seconds = 0;
    setCurrentTime(0);
    setIsPlaying(false);
  }, [clearScheduledNotes, clearScheduledClicks, setCurrentTime, setIsPlaying]);

  const handlePause = useCallback(() => {
    if (isPlaying) {
      Tone.Transport.pause();
      clearScheduledNotes();
      clearScheduledClicks();
      setIsPlaying(false);
    }
  }, [isPlaying, clearScheduledNotes, clearScheduledClicks, setIsPlaying]);

  const handlePlay = useCallback(async () => {
    if (!containerRef.current) {
      console.warn('Container not ready yet');
      return;
    }

    try {
      await Tone.start();
      console.log('Tone.js context started');

      if (!isPlaying) {
        Tone.Transport.cancel();
        
        if (currentTime >= songDuration) {
          setCurrentTime(0);
          Tone.Transport.seconds = 0;
        }
        
        if (loopEnabled) {
          setCurrentTime(loopStart);
          Tone.Transport.seconds = loopStart * (60 / Tone.Transport.bpm.value);
        }
        
        scheduleNotes(processedSong, currentTime, songDuration);
        if (metronomeEnabled) {
          scheduleMetronomeClicks(currentTime);
        }
        
        console.log('Starting transport at position:', Tone.Transport.seconds);
        Tone.Transport.start();
        setIsPlaying(true);
        console.log('Transport started, playback began');
      }
    } catch (error) {
      console.error('Error starting playback:', error);
    }
  }, [
    isPlaying,
    currentTime,
    songDuration,
    loopEnabled,
    loopStart,
    scheduleNotes,
    processedSong,
    metronomeEnabled,
    scheduleMetronomeClicks,
    setCurrentTime,
    setIsPlaying
  ]);

  const handlePlayPause = useCallback(async () => {
    if (isPlaying) {
      handlePause();
    } else {
      handlePlay();
    }
  }, [isPlaying, handlePause, handlePlay]);

  // Initialize Tone.Transport
  useEffect(() => {
    return () => {
      Tone.Transport.stop();
      Tone.Transport.cancel();
    };
  }, []);

  return {
    handlePlay,
    handlePause,
    handleStop,
    handlePlayPause,
    containerRef
  };
}; 
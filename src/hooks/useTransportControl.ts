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

  const startPlayback = useCallback(async (startTime: number) => {
    try {
      await Tone.start();
      console.log('Tone.js context started');

      Tone.Transport.cancel();
      clearScheduledNotes();
      clearScheduledClicks();
      
      Tone.Transport.seconds = startTime * (60 / Tone.Transport.bpm.value);
      
      scheduleNotes(processedSong, startTime, songDuration);
      if (metronomeEnabled) {
        scheduleMetronomeClicks(startTime);
      }
      
      console.log('Starting transport at position:', Tone.Transport.seconds);
      Tone.Transport.start();
      setIsPlaying(true);
      console.log('Transport started, playback began');
    } catch (error) {
      console.error('Error starting playback:', error);
    }
  }, [
    scheduleNotes,
    processedSong,
    songDuration,
    metronomeEnabled,
    scheduleMetronomeClicks,
    setIsPlaying,
    clearScheduledNotes,
    clearScheduledClicks
  ]);

  const handlePlay = useCallback(async () => {
    if (!containerRef.current) {
      console.warn('Container not ready yet');
      return;
    }

    if (!isPlaying) {
      if (currentTime >= songDuration) {
        setCurrentTime(0);
        startPlayback(0);
      } else {
        startPlayback(currentTime);
      }
    }
  }, [isPlaying, currentTime, songDuration, setCurrentTime, startPlayback]);

  const restartFromBeginning = useCallback(async () => {
    // Stop the transport first to ensure clean state
    Tone.Transport.stop();
    clearScheduledNotes();
    clearScheduledClicks();
    
    // Reset time and start playback
    setCurrentTime(0);
    await startPlayback(0);
  }, [setCurrentTime, startPlayback, clearScheduledNotes, clearScheduledClicks]);

  const handlePlayPause = useCallback(async () => {
    if (isPlaying) {
      handlePause();
    } else {
      handlePlay();
    }
  }, [isPlaying, handlePause, handlePlay]);

  // Handle song end and auto-restart
  useEffect(() => {
    const handleSongEnd = async () => {
      if (isPlaying && currentTime >= songDuration && !loopEnabled) {
        await restartFromBeginning();
      }
    };

    handleSongEnd();
  }, [isPlaying, currentTime, songDuration, loopEnabled, restartFromBeginning]);

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
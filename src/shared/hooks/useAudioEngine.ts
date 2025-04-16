import * as Tone from 'tone';
import { useCallback, useState } from 'react';
import { STORAGE_KEYS, saveToStorage } from '../../utils/localStorage';
import { Note } from '../../types/SongTypes';

interface UseAudioEngineProps {
  clearScheduledNotes: () => void;
  scheduleNotes: (song: { notes: Note[]; chords?: { chord: string; measure: number }[]; timeSignature: [number, number] }, startTime: number, songDuration: number) => void;
  processedSong: { notes: Note[]; chords?: { chord: string; measure: number }[]; timeSignature: [number, number] };
  currentTime: number;
  songDuration: number;
}

export const useAudioEngine = ({
  clearScheduledNotes,
  scheduleNotes,
  processedSong,
  currentTime,
  songDuration
}: UseAudioEngineProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const handleStop = useCallback(() => {
    Tone.Transport.stop();
    clearScheduledNotes();
    Tone.Transport.seconds = 0;
    setIsPlaying(false);
  }, [clearScheduledNotes]);

  const handleMuteChange = useCallback((muted: boolean) => {
    setIsMuted(muted);
    saveToStorage(STORAGE_KEYS.MUTE, muted);
    
    clearScheduledNotes();
    
    if (!muted && isPlaying) {
      scheduleNotes(processedSong, currentTime, songDuration);
    }
  }, [isPlaying, currentTime, scheduleNotes, clearScheduledNotes, processedSong, songDuration]);

  return {
    handleStop,
    handleMuteChange,
    isPlaying,
    isMuted
  };
};

export default useAudioEngine; 
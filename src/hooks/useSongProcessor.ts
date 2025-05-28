import { useMemo, useEffect, useState, useCallback } from 'react';
import { SongData, StringFretNote, Note } from '../types/SongTypes';
import { convertSongToStringFret } from '../utils/noteConverter';

interface UseSongProcessorProps {
  song: SongData;
  currentTime: number;
  isResetAnimating: boolean;
}

export const useSongProcessor = ({
  song,
  currentTime,
  isResetAnimating
}: UseSongProcessorProps) => {
  const [visibleNotes, setVisibleNotes] = useState<StringFretNote[]>([]);

  // Process song data
  const [originalSong, processedSong] = useMemo(() => {
    if (song.tuning) {
      // If the song has tuning, it's in pitch format and needs conversion
      const converted = convertSongToStringFret(song);
      return [song, converted];
    }
    // If no tuning, it's already in string/fret format
    return [song, song];
  }, [song]);

  // Calculate the total duration of the song in beats
  const songDuration = useMemo(() => {
    if (!processedSong.notes.length) return 0;
    const lastNote = [...processedSong.notes].sort((a, b) => (b.time + b.duration) - (a.time + a.duration))[0];
    return lastNote.time + lastNote.duration;
  }, [processedSong.notes]);

  // Update visible notes based on current time
  useEffect(() => {
    if (isResetAnimating) {
      return;
    }
    
    const visible = processedSong.notes.filter(
      (note: Note) => {
        if ('rest' in note) {
          return false;
        }
        return true;
      }
    ) as StringFretNote[];
    
    setVisibleNotes(visible);
  }, [currentTime, processedSong.notes, isResetAnimating]);

  // Add a function to clear notes
  const clearNotes = useCallback(() => {
    setVisibleNotes([]);
  }, []);

  return {
    originalSong,
    processedSong,
    songDuration,
    visibleNotes,
    clearNotes
  };
}; 
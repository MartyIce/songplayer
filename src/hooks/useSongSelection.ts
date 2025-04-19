import { useEffect } from 'react';
import { STORAGE_KEYS, saveToStorage } from '../utils/localStorage';

export const useSongSelection = (currentSongId: string) => {
  // Save current song ID whenever it changes
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.CURRENT_SONG, currentSongId);
  }, [currentSongId]);
}; 
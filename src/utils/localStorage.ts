// Local storage keys
export const STORAGE_KEYS = {
  TEMPO: 'songplayer_tempo',
  LOOP_ENABLED: 'songplayer_loop_enabled',
  CURRENT_SONG: 'songplayer_current_song',
  GUITAR_TYPE: 'songplayer_guitar_type',
  LOOP_START: 'songplayer_loop_start',
  LOOP_END: 'songplayer_loop_end',
  METRONOME_ENABLED: 'songplayer_metronome_enabled',
  MUTE: 'songplayer_mute',
  NIGHT_MODE: 'songplayer_night_mode'
};

// Save a value to local storage
export const saveToStorage = (key: string, value: any) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Failed to save to localStorage: ${error}`);
  }
};

// Get a value from local storage with default fallback
export const getFromStorage = <T>(key: string, defaultValue: T): T => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.warn(`Failed to get from localStorage: ${error}`);
    return defaultValue;
  }
}; 
// Local storage keys
export const STORAGE_KEYS = {
  TEMPO: 'tempo',
  LOOP_ENABLED: 'loopEnabled',
  CURRENT_SONG: 'currentSong',
  GUITAR_TYPE: 'guitarType',
  LOOP_START: 'loopStart',
  LOOP_END: 'loopEnd',
  METRONOME_ENABLED: 'metronomeEnabled',
  MUTE: 'mute',
  NIGHT_MODE: 'nightMode',
  ZOOM_LEVEL: 'zoomLevel',
  CHORDS_ENABLED: 'chordsEnabled',
  CHORDS_VOLUME: 'chordsVolume',
} as const;

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
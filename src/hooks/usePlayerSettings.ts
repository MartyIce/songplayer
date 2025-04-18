import { useState, useCallback } from 'react';
import * as Tone from 'tone';
import { GuitarType } from '../utils/GuitarSampler';
import { STORAGE_KEYS, saveToStorage, getFromStorage } from '../utils/localStorage';
import { guitarSampler } from '../utils/GuitarSampler';
import { SongData } from '../types/SongTypes';

export const usePlayerSettings = (song: SongData) => {
  // Settings state
  const [bpm, setBpm] = useState<number>(() => getFromStorage(STORAGE_KEYS.TEMPO, song.bpm));
  const [guitarType, setGuitarType] = useState<GuitarType>(() => getFromStorage(STORAGE_KEYS.GUITAR_TYPE, 'acoustic'));
  const [chordsEnabled, setChordsEnabled] = useState(() => getFromStorage(STORAGE_KEYS.CHORDS_ENABLED, true));
  const [chordsVolume, setChordsVolume] = useState(() => getFromStorage(STORAGE_KEYS.CHORDS_VOLUME, 0.7));
  const [isMuted, setIsMuted] = useState(() => getFromStorage(STORAGE_KEYS.MUTE, false));
  const [nightMode, setNightMode] = useState(() => getFromStorage(STORAGE_KEYS.NIGHT_MODE, false));

  // Settings handlers
  const handleBpmChange = useCallback((newBpm: number) => {
    setBpm(newBpm);
    saveToStorage(STORAGE_KEYS.TEMPO, newBpm);
    return newBpm;
  }, []);

  const handleGuitarTypeChange = useCallback((type: GuitarType) => {
    setGuitarType(type);
    saveToStorage(STORAGE_KEYS.GUITAR_TYPE, type);
    return type;
  }, []);

  const handleChordsEnabledChange = useCallback((enabled: boolean) => {
    setChordsEnabled(enabled);
    saveToStorage(STORAGE_KEYS.CHORDS_ENABLED, enabled);
  }, []);

  const handleChordsVolumeChange = useCallback((volume: number) => {
    setChordsVolume(volume);
    saveToStorage(STORAGE_KEYS.CHORDS_VOLUME, volume);
  }, []);

  const handleMuteChange = useCallback((muted: boolean) => {
    setIsMuted(muted);
    saveToStorage(STORAGE_KEYS.MUTE, muted);
  }, []);

  const handleNightModeChange = useCallback((enabled: boolean) => {
    setNightMode(enabled);
    saveToStorage(STORAGE_KEYS.NIGHT_MODE, enabled);
  }, []);

  return {
    // Settings state
    bpm,
    guitarType,
    chordsEnabled,
    chordsVolume,
    isMuted,
    nightMode,

    // Settings handlers
    handleBpmChange,
    handleGuitarTypeChange,
    handleChordsEnabledChange,
    handleChordsVolumeChange,
    handleMuteChange,
    handleNightModeChange,
  };
}; 
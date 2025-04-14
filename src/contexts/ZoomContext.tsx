import React, { createContext, useContext, useState, useCallback } from 'react';
import { STORAGE_KEYS, getFromStorage, saveToStorage } from '../utils/localStorage';

interface ZoomContextType {
  zoomLevel: number;
  setZoomLevel: (level: number | ((prev: number) => number)) => void;
  increaseZoom: () => void;
  decreaseZoom: () => void;
}

const ZoomContext = createContext<ZoomContextType | undefined>(undefined);

export const ZoomProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initialize zoom level from local storage, default to 1 if not found
  const [zoomLevel, setZoomLevel] = useState(() => getFromStorage(STORAGE_KEYS.ZOOM_LEVEL, 1));

  const updateZoomLevel = useCallback((newLevel: number | ((prev: number) => number)) => {
    const nextLevel = typeof newLevel === 'function' ? newLevel(zoomLevel) : newLevel;
    setZoomLevel(nextLevel);
    saveToStorage(STORAGE_KEYS.ZOOM_LEVEL, nextLevel);
  }, [zoomLevel]);

  const increaseZoom = useCallback(() => {
    updateZoomLevel((prev: number) => Math.min(prev + 0.2, 2)); // Max zoom is 2x
  }, [updateZoomLevel]);

  const decreaseZoom = useCallback(() => {
    updateZoomLevel((prev: number) => Math.max(prev - 0.2, 0.4)); // Min zoom is 0.4x
  }, [updateZoomLevel]);

  return (
    <ZoomContext.Provider value={{ 
      zoomLevel, 
      setZoomLevel: updateZoomLevel, 
      increaseZoom, 
      decreaseZoom 
    }}>
      {children}
    </ZoomContext.Provider>
  );
};

export const useZoom = () => {
  const context = useContext(ZoomContext);
  if (context === undefined) {
    throw new Error('useZoom must be used within a ZoomProvider');
  }
  return context;
}; 
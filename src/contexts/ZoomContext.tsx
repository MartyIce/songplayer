import React, { createContext, useContext, useState, useCallback } from 'react';

interface ZoomContextType {
  zoomLevel: number;
  setZoomLevel: (level: number) => void;
  increaseZoom: () => void;
  decreaseZoom: () => void;
}

const ZoomContext = createContext<ZoomContextType | undefined>(undefined);

export const ZoomProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [zoomLevel, setZoomLevel] = useState(1); // 1 is default zoom level

  const increaseZoom = useCallback(() => {
    setZoomLevel(prev => Math.min(prev + 0.2, 2)); // Max zoom is 2x
  }, []);

  const decreaseZoom = useCallback(() => {
    setZoomLevel(prev => Math.max(prev - 0.2, 0.4)); // Min zoom is 0.1x
  }, []);

  return (
    <ZoomContext.Provider value={{ zoomLevel, setZoomLevel, increaseZoom, decreaseZoom }}>
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
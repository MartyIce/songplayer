import React, { useState, useEffect } from 'react';
import './App.css';
import TablaturePlayer from './components/TablaturePlayer';
import { SongData } from './types/SongTypes';
import { convertSongToStringFret } from './utils/noteConverter';
import { STORAGE_KEYS, getFromStorage, saveToStorage } from './utils/localStorage';
import { ZoomProvider } from './contexts/ZoomContext';

// Custom hook to detect mobile devices and orientation
const useMobileDetection = () => {
  const [isMobile, setIsMobile] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      // Use a more reliable detection method - we're considering any device under 1024px as "mobile"
      const mobile = window.innerWidth <= 1024;
      const landscape = window.innerWidth > window.innerHeight;
      
      console.log('Device detection:', { 
        width: window.innerWidth, 
        height: window.innerHeight, 
        isMobile: mobile, 
        isLandscape: landscape 
      });
      
      setIsMobile(mobile);
      setIsLandscape(landscape);
    };
    
    checkMobile(); // Check initially
    window.addEventListener('resize', checkMobile);
    window.addEventListener('orientationchange', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('orientationchange', checkMobile);
    };
  }, []);

  return { isMobile, isLandscape };
};

// Define available songs metadata
const songList = [
  { id: 'roses', name: 'Give Me the Roses While I Live', filename: 'roses.json' },
  { id: 'giuliani-study-1', name: 'Giuliani Study No. 1', filename: 'giuliani-study-1.json' },
  { id: 'scarborough-fair', name: 'Scarborough Fair', filename: 'scarborough-fair.json' },
  { id: 'when-the-swallows', name: 'When The Swallows', filename: 'when-the-swallows.json' },
  { id: 'when-the-swallows-detailed', name: 'When The Swallows (Detailed)', filename: 'when-the-swallows-detailed.json' },
];

function App() {
  const [currentSong, setCurrentSong] = useState<SongData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isMobile, isLandscape } = useMobileDetection();

  // Load initial song
  useEffect(() => {
    // Get the saved song ID from local storage, or use the first song as default
    const savedSongId = getFromStorage(STORAGE_KEYS.CURRENT_SONG, songList[0].id);
    const songToLoad = songList.find(song => song.id === savedSongId) || songList[0];
    loadSong(songToLoad.filename);
  }, []);

  const loadSong = async (filename: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(`${process.env.PUBLIC_URL}/songs/${filename}`);
      if (!response.ok) {
        throw new Error(`Failed to load song: ${response.statusText}`);
      }
      const songData = await response.json();
      
      // Convert the song if it's in note format (has tuning property)
      const processedSong = songData.tuning 
        ? convertSongToStringFret(songData)
        : songData;
      
      setCurrentSong(processedSong);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load song');
      console.error('Error loading song:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSongChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedSong = songList.find(song => song.id === e.target.value);
    if (selectedSong) {
      loadSong(selectedSong.filename);
      saveToStorage(STORAGE_KEYS.CURRENT_SONG, selectedSong.id);
    }
  };

  if (error) {
    return <div className="error-message">Error: {error}</div>;
  }

  // Mobile landscape layout
  if (isMobile && isLandscape) {
    return (
      <ZoomProvider>
        <div className="App App-mobile-landscape">
          <header className="App-header-mobile-landscape">
            <img 
              src={`${process.env.PUBLIC_URL}/string-slinger.png`} 
              alt="String Slinger" 
              className="logo-mobile" 
              style={{ 
                height: '40px', 
                margin: '10px',
                position: 'absolute',
                top: '5px',
                left: '5px'
              }}
            />
          </header>
          <main>
            {currentSong && (
              <>THIS IS MOBILE TAB PLAYER</>
            )}
          </main>
        </div>
      </ZoomProvider>
    );
  }

  // Default desktop layout
  return (
    <ZoomProvider>
      <div className="App">
        <header className="App-header">
          <img src={`${process.env.PUBLIC_URL}/string-slinger.png`} alt="String Slinger" className="logo" />
        </header>
        <main>
          {currentSong && (
            <TablaturePlayer 
              song={currentSong} 
              songList={songList}
              currentSongId={songList.find(song => song.name === currentSong.title)?.id || songList[0].id}
              onSongChange={handleSongChange}
              isLoading={isLoading}
            />
          )}
        </main>
      </div>
    </ZoomProvider>
  );
}

export default App; 
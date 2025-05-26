import React, { useState, useEffect, useMemo } from 'react';
import './App.css';
import TablaturePlayer from './components/TablaturePlayer';
import MobileTablaturePlayer from './components/MobileTablaturePlayer';
import { SongData } from './types/SongTypes';
import { convertSongToStringFret } from './utils/noteConverter';
import { STORAGE_KEYS, getFromStorage, saveToStorage } from './utils/localStorage';
import { ZoomProvider } from './contexts/ZoomContext';
import { SongPopulator, SongListItem } from './utils/songPopulator';

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
const baseSongList: SongListItem[] = [
  { id: 'deep-elem', name: 'Deep Elem Blues', filename: 'deep-elem-blues.json' },
  { id: 'roses', name: 'Give Me the Roses While I Live', filename: 'roses.json' },
  { id: 'giuliani-study-1', name: 'Giuliani Study No. 1', filename: 'giuliani-study-1.json' },
  { id: 'scarborough-fair', name: 'Scarborough Fair', filename: 'scarborough-fair.json' },
  { id: 'when-the-swallows', name: 'When The Swallows', filename: 'when-the-swallows.json' },
  { id: 'when-the-swallows-detailed', name: 'When The Swallows (Detailed)', filename: 'when-the-swallows-detailed.json' },
  { id: 'test-song', name: 'Staff View Test Song', filename: 'test-song.json' },
];

function App() {
  const [currentSong, setCurrentSong] = useState<SongData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isMobile, isLandscape } = useMobileDetection();

  // Generate the complete song list with generated songs
  const songList = useMemo(() => {
    return SongPopulator.populateSongList(baseSongList);
  }, []);

  // Load initial song
  useEffect(() => {
    // Get the saved song ID from local storage, or use the first song as default
    const savedSongId = getFromStorage(STORAGE_KEYS.CURRENT_SONG, songList[0].id);
    const songToLoad = songList.find(song => song.id === savedSongId) || songList[0];
    
    // Make sure the current song ID is saved correctly
    saveToStorage(STORAGE_KEYS.CURRENT_SONG, songToLoad.id);
    
    loadSong(songToLoad);
  }, [songList]);

  const loadSong = async (songItem: SongListItem) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Skip separator items
      if (songItem.name.startsWith('---')) {
        setIsLoading(false);
        return;
      }
      
      let songData: SongData;
      
      if (songItem.data) {
        // Generated song - use the data directly
        songData = songItem.data;
      } else if (songItem.filename) {
        // File-based song - load from file
        const response = await fetch(`${process.env.PUBLIC_URL}/songs/${songItem.filename}`);
        if (!response.ok) {
          throw new Error(`Failed to load song: ${response.statusText}`);
        }
        songData = await response.json();
      } else {
        throw new Error('Invalid song item: no data or filename provided');
      }
      
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
      loadSong(selectedSong);
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
          <main>
            {currentSong && (
              <MobileTablaturePlayer 
                song={currentSong} 
                songList={songList}
                currentSongId={getFromStorage(STORAGE_KEYS.CURRENT_SONG, songList[0].id)}
                onSongChange={handleSongChange}
                isLoading={isLoading}
              />
            )}
          </main>
        </div>
      </ZoomProvider>
    );
  }

  // Default desktop layout (now always rendered)
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
              currentSongId={getFromStorage(STORAGE_KEYS.CURRENT_SONG, songList[0].id)}
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
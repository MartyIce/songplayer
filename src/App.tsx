import React, { useState, useEffect } from 'react';
import './App.css';
import TablaturePlayer from './components/TablaturePlayer';
import { SongData } from './types/SongTypes';
import { convertSongToStringFret } from './utils/noteConverter';

// Define available songs metadata
const songList = [
  { id: 'giuliani-study-1', name: 'Giuliani Study No. 1', filename: 'giuliani-study-1.json' },
  { id: 'scarborough-fair', name: 'Scarborough Fair', filename: 'scarborough-fair.json' },
  { id: 'when-the-swallows', name: 'When The Swallows', filename: 'when-the-swallows.json' },
  { id: 'when-the-swallows-detailed', name: 'When The Swallows (Detailed)', filename: 'when-the-swallows-detailed.json' },
];

function App() {
  const [currentSong, setCurrentSong] = useState<SongData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load initial song
  useEffect(() => {
    loadSong(songList[0].filename);
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
    }
  };

  if (error) {
    return <div className="error-message">Error: {error}</div>;
  }

  return (
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
  );
}

export default App; 
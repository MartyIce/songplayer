import React, { useState } from 'react';
import './App.css';
import TablaturePlayer from './components/TablaturePlayer';
import { SongData } from './types/SongTypes';
import sampleSong from './assets/sample-song.json';
import whenTheSwallows from './assets/when-the-swallows.json';
import whenTheSwallowsDetailed from './assets/when-the-swallows-detailed.json';
import scarboroughFair from './assets/scarborough-fair.json';
import giulianiStudy1 from './assets/giuliani-study-1.json';
import { convertSongToStringFret } from './utils/noteConverter';

function App() {
  const [currentSong, setCurrentSong] = useState<SongData>(giulianiStudy1 as SongData);
  const [availableSongs] = useState<{name: string, data: SongData}[]>([
    // { name: "Sample Song", data: sampleSong as SongData },
    // { name: "When The Swallows", data: whenTheSwallows as SongData },
    // { name: "When The Swallows (Detailed)", data: whenTheSwallowsDetailed as SongData },
    // { name: "Scarborough Fair", data: scarboroughFair as SongData },
    { name: "Giuliani Study No. 1", data: giulianiStudy1 as SongData }
  ]);

  const handleSongChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedSongName = e.target.value;
    const selectedSong = availableSongs.find(song => song.name === selectedSongName);
    if (selectedSong) {
      // Convert the song if it's in note format (has tuning property)
      const songData = selectedSong.data.tuning 
        ? convertSongToStringFret(selectedSong.data)
        : selectedSong.data;
      setCurrentSong(songData);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Guitar Tablature Player</h1>
      </header>
      <main>
        <div className="song-selector">
          <label htmlFor="song-select">Select Song: </label>
          <select 
            id="song-select" 
            onChange={handleSongChange}
            value={availableSongs.find(song => song.data.title === currentSong.title)?.name || "Giuliani Study No. 1"}
          >
            {availableSongs.map(song => (
              <option key={song.name} value={song.name}>
                {song.name}
              </option>
            ))}
          </select>
        </div>
        <TablaturePlayer song={currentSong} />
      </main>
    </div>
  );
}

export default App; 
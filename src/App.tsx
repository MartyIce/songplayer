import React, { useState } from 'react';
import './App.css';
import TablaturePlayer from './components/TablaturePlayer';
import { SongData } from './types/SongTypes';
import sampleSong from './assets/sample-song.json';

function App() {
  const [currentSong, setCurrentSong] = useState<SongData>(sampleSong as SongData);

  return (
    <div className="App">
      <header className="App-header">
        <h1>Guitar Tablature Player</h1>
      </header>
      <main>
        <TablaturePlayer song={currentSong} />
      </main>
    </div>
  );
}

export default App; 
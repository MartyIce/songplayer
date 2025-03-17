export interface Note {
  string: number;  // Guitar string number (1-6)
  fret: number;    // Fret number (0-24)
  time: number;    // Time in seconds when the note should be played
  duration: number; // Duration of the note in seconds
  color?: string;  // Optional color for the note
}

export interface SongData {
  title: string;
  artist?: string;
  bpm: number;
  timeSignature: [number, number]; // [beats per measure, beat unit]
  notes: Note[];
} 
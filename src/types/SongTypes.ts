export interface StringFretNote {
  string: number;
  fret: number;
  time: number;
  duration: number;
  color: string;
}

export interface PitchNote {
  note: string;
  time: number;
  duration: number;
  color: string;
}

export type Note = StringFretNote | PitchNote;

export interface SongData {
  title: string;
  artist: string;
  bpm: number;
  timeSignature: [number, number];
  tuning?: string[];
  notes: Note[];
} 
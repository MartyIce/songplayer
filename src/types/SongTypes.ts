export interface BaseNote {
  time: number;
  duration: number;
  color?: string;
}

export interface PitchNote extends BaseNote {
  note: string;
}

export interface StringFretNote extends BaseNote {
  string: number;
  fret: number;
}

export interface RestNote extends BaseNote {
  rest: true;
}

export type Note = PitchNote | StringFretNote | RestNote;

export interface SongData {
  title: string;
  artist: string;
  bpm: number;
  timeSignature: [number, number];
  tuning?: string[];
  notes: Note[];
} 
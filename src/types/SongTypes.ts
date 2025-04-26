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

export interface ChordData {
  chord: string;
  measure: number;
  time: number;
}

export interface ChordMarker {
  chord: string;
  time: number;
  measure: number;
}

export interface SongData {
  title: string;
  artist: string;
  bpm: number;
  timeSignature: [number, number];
  key?: string;
  tuning?: string[];
  notes: Note[];
  chords?: ChordData[];
} 
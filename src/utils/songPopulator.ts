import { SongData } from '../types/SongTypes';
import { ScaleWithChordsGenerator } from '../generators/ScaleWithChordsGenerator';

export interface SongListItem {
  id: string;
  name: string;
  filename?: string;
  data?: SongData;
}

export class SongPopulator {
  private static readonly KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  /**
   * Generate all scale-based songs (major and minor scales in all keys)
   */
  public static generateScaleSongs(): SongListItem[] {
    const songs: SongListItem[] = [];
    const scaleWChordsGen = new ScaleWithChordsGenerator();

    this.KEYS.forEach(key => {
      // Generate major scale
      const majorSong = scaleWChordsGen.build(key, 'major');
      songs.push({
        id: `generated-${key}-major`,
        name: `${key} Major Scale`,
        data: majorSong
      });

      // Generate minor scale
      const minorSong = scaleWChordsGen.build(key, 'minor');
      songs.push({
        id: `generated-${key}-minor`,
        name: `${key} Minor Scale`,
        data: minorSong
      });
    });

    return songs;
  }

  /**
   * Get all generated songs
   */
  public static getAllGeneratedSongs(): SongListItem[] {
    const songs: SongListItem[] = [];
    
    // Add scale songs
    songs.push(...this.generateScaleSongs());
    
    // Future generators can be added here:
    // songs.push(...this.generateArpeggioSongs());
    // songs.push(...this.generateChordProgressionSongs());
    
    return songs;
  }

  /**
   * Mix up the notes in a generated song
   */
  public static mixupSong(songData: SongData): SongData {
    const generator = new ScaleWithChordsGenerator();
    return generator.mixup(songData);
  }

  /**
   * Combine existing songs with generated songs
   */
  public static populateSongList(existingSongs: SongListItem[]): SongListItem[] {
    const allSongs = [...existingSongs];
    const generatedSongs = this.getAllGeneratedSongs();
    
    // Add a separator for generated songs
    if (generatedSongs.length > 0) {
      allSongs.push({
        id: 'separator-generated',
        name: '--- Generated Songs ---',
        data: undefined
      });
      
      allSongs.push(...generatedSongs);
    }
    
    return allSongs;
  }
} 
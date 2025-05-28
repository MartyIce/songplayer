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
  private static generator = new ScaleWithChordsGenerator();

  /**
   * Generate all scale-based songs (major and minor scales in all keys)
   */
  public static generateScaleSongs(): SongListItem[] {
    const songs: SongListItem[] = [];

    this.KEYS.forEach(key => {
      // Generate major scale
      const majorSong = this.generator.build(key, 'major');
      songs.push({
        id: `generated-${key}-major`,
        name: `${key} Major Scale`,
        data: majorSong
      });

      // Generate minor scale
      const minorSong = this.generator.build(key, 'minor');
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
    return this.generator.mixup(songData);
  }

  /**
   * Calculate all possible positions for a song
   */
  public static calculateAllPositions(songData: SongData, fretSpan: number = 4): void {
    this.generator.calculateAllPositions(songData, fretSpan);
  }

  /**
   * Get the current position for a song
   */
  public static getCurrentPosition(songData: SongData): SongData {
    return this.generator.getCurrentPosition(songData);
  }

  /**
   * Move to the next higher position (up the neck)
   */
  public static moveUpNeck(songData: SongData): SongData {
    return this.generator.moveUpNeck(songData);
  }

  /**
   * Move to the next lower position (down the neck)
   */
  public static moveDownNeck(songData: SongData): SongData {
    return this.generator.moveDownNeck(songData);
  }

  /**
   * Jump to a specific position (1-based index)
   */
  public static jumpToPosition(songData: SongData, positionIndex: number): SongData {
    return this.generator.jumpToPosition(songData, positionIndex);
  }

  /**
   * Get the number of available positions for a song
   */
  public static getPositionCount(songData: SongData): number {
    return this.generator.getPositionCount(songData);
  }

  /**
   * Get the current position index (1-based)
   */
  public static getCurrentPositionIndex(songData: SongData): number {
    return this.generator.getCurrentPositionIndex(songData);
  }

  /**
   * Legacy method: Move notes up the neck using the old approach
   */
  public static moveUpNeckLegacy(songData: SongData, fretSpan: number = 4): SongData {
    return this.generator.moveUpNeckLegacy(songData, fretSpan);
  }

  /**
   * Legacy method: Move notes down the neck using the old approach
   */
  public static moveDownNeckLegacy(songData: SongData, fretSpan: number = 4): SongData {
    return this.generator.moveDownNeckLegacy(songData, fretSpan);
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
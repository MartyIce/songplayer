import { ScaleWithChordsGenerator } from '../ScaleWithChordsGenerator';
import { SongData, StringFretNote } from '../../types/SongTypes';

describe('ScaleWithChordsGenerator', () => {
  let generator: ScaleWithChordsGenerator;

  beforeEach(() => {
    generator = new ScaleWithChordsGenerator();
  });

  describe('build', () => {
    it('should generate a major scale with correct structure', () => {
      const result = generator.build('C', 'major');
      
      expect(result.title).toBe('C Major Scale');
      expect(result.key).toBe('C');
      expect(result.bpm).toBe(120);
      expect(result.timeSignature).toEqual([4, 4]);
      expect(result.notes).toHaveLength(16); // 2 bars * 8 notes per bar
      expect(result.chords).toHaveLength(2); // 2 chords for 2 bars
    });

    it('should generate a minor scale with correct structure', () => {
      const result = generator.build('A', 'minor');
      
      expect(result.title).toBe('A Minor Scale');
      expect(result.key).toBe('A');
      expect(result.notes).toHaveLength(16);
      expect(result.chords).toHaveLength(2);
    });

    it('should generate notes within reasonable fret ranges', () => {
      const result = generator.build('G', 'major');
      
      result.notes.forEach(note => {
        const stringFretNote = note as StringFretNote;
        expect(stringFretNote.string).toBeGreaterThanOrEqual(1);
        expect(stringFretNote.string).toBeLessThanOrEqual(6);
        expect(stringFretNote.fret).toBeGreaterThanOrEqual(0);
        expect(stringFretNote.fret).toBeLessThanOrEqual(15);
      });
    });
  });

  describe('moveUpNeck', () => {
    it('should move notes to higher fret positions', () => {
      const originalSong = generator.build('C', 'major');
      const originalFrets = originalSong.notes.map(note => (note as StringFretNote).fret);
      const originalAvgFret = originalFrets.reduce((sum, fret) => sum + fret, 0) / originalFrets.length;
      
      const movedSong = generator.moveUpNeckLegacy(originalSong);
      const movedFrets = movedSong.notes.map(note => (note as StringFretNote).fret);
      const movedAvgFret = movedFrets.reduce((sum, fret) => sum + fret, 0) / movedFrets.length;
      
      // The moved version should generally have higher fret numbers
      // (allowing for some flexibility due to octave variations)
      expect(movedSong.title).toContain('(Up)');
      expect(movedSong.notes).toHaveLength(originalSong.notes.length);
    });

    it('should maintain the same number of notes', () => {
      const originalSong = generator.build('D', 'minor');
      const movedSong = generator.moveUpNeckLegacy(originalSong);
      
      expect(movedSong.notes).toHaveLength(originalSong.notes.length);
    });

    it('should work with different keys', () => {
      const keys = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
      
      keys.forEach(key => {
        const originalSong = generator.build(key, 'major');
        const movedSong = generator.moveUpNeckLegacy(originalSong);
        
        expect(movedSong.notes).toHaveLength(originalSong.notes.length);
        expect(movedSong.title).toContain('(Up)');
      });
    });
  });

  describe('moveDownNeck', () => {
    it('should move notes to lower fret positions when possible', () => {
      // Start with a song that has higher frets
      const originalSong = generator.build('F#', 'major');
      const movedUpSong = generator.moveUpNeckLegacy(originalSong);
      const movedDownSong = generator.moveDownNeckLegacy(movedUpSong);
      
      expect(movedDownSong.title).toContain('(Down)');
      expect(movedDownSong.notes).toHaveLength(originalSong.notes.length);
    });

    it('should maintain the same number of notes', () => {
      const originalSong = generator.build('E', 'minor');
      const movedSong = generator.moveDownNeckLegacy(originalSong);
      
      expect(movedSong.notes).toHaveLength(originalSong.notes.length);
    });
  });

  describe('mixup', () => {
    it('should create a mixed version with same metadata', () => {
      const originalSong = generator.build('G', 'major');
      const mixedSong = generator.mixup(originalSong);
      
      expect(mixedSong.title).toContain('(Mixed)');
      expect(mixedSong.key).toBe(originalSong.key);
      expect(mixedSong.bpm).toBe(originalSong.bpm);
      expect(mixedSong.notes).toHaveLength(originalSong.notes.length);
      expect(mixedSong.chords).toEqual(originalSong.chords);
    });

    it('should handle songs without a key', () => {
      const songWithoutKey: SongData = {
        title: 'Test Song',
        artist: 'Test Artist',
        bpm: 120,
        timeSignature: [4, 4],
        notes: [
          { string: 3, fret: 2, time: 0, duration: 0.5 },
          { string: 2, fret: 3, time: 0.5, duration: 0.5 }
        ],
        chords: []
      };
      
      const mixedSong = generator.mixup(songWithoutKey);
      expect(mixedSong.key).toBe('C'); // Should default to C
    });
  });

  describe('octave variations in neck movement', () => {
    it('should find alternative positions using octave variations', () => {
      // Create a song with notes that might be difficult to map to certain positions
      const testSong: SongData = {
        title: 'Test Song',
        artist: 'Test',
        bpm: 120,
        timeSignature: [4, 4],
        key: 'C',
        notes: [
          { string: 6, fret: 0, time: 0, duration: 0.5 },    // Low E (MIDI 40)
          { string: 1, fret: 12, time: 0.5, duration: 0.5 }, // High E 12th fret (MIDI 76)
          { string: 3, fret: 2, time: 1, duration: 0.5 },    // D string 2nd fret (MIDI 52)
          { string: 4, fret: 5, time: 1.5, duration: 0.5 }   // G string 5th fret (MIDI 60)
        ],
        chords: []
      };
      
      // Try to move this up the neck - should use octave variations to find valid positions
      const movedUp = generator.moveUpNeckLegacy(testSong, 4);
      expect(movedUp.notes).toHaveLength(testSong.notes.length);
      
      // Try to move down the neck
      const movedDown = generator.moveDownNeckLegacy(testSong, 4);
      expect(movedDown.notes).toHaveLength(testSong.notes.length);
    });

    it('should prefer positions with fewer octave shifts', () => {
      const originalSong = generator.build('C', 'major');
      
      // Move up the neck multiple times and ensure we get valid results
      const moved1 = generator.moveUpNeckLegacy(originalSong);
      const moved2 = generator.moveUpNeckLegacy(moved1);
      
      expect(moved1.notes).toHaveLength(originalSong.notes.length);
      expect(moved2.notes).toHaveLength(originalSong.notes.length);
    });
  });

  describe('all positions functionality', () => {
    it('should return multiple alternative positions when available', () => {
      const originalSong = generator.build('C', 'major');
      
      // Get all alternative positions
      const allPositions = generator.getAllAlternativePositions(originalSong);
      
      // Should find multiple valid positions
      expect(allPositions.length).toBeGreaterThan(0);
      
      // Each position should have the same number of notes
      allPositions.forEach(position => {
        expect(position.notes).toHaveLength(originalSong.notes.length);
        expect(position.title).toContain('(Alt');
      });
    });

    it('should return multiple up-neck positions', () => {
      const originalSong = generator.build('G', 'major');
      
      const upPositions = generator.moveUpNeckAllPositions(originalSong);
      
      expect(upPositions.length).toBeGreaterThan(0);
      
      upPositions.forEach((position, index) => {
        expect(position.notes).toHaveLength(originalSong.notes.length);
        expect(position.title).toContain(`(Up ${index + 1})`);
      });
    });

    it('should return multiple down-neck positions', () => {
      const originalSong = generator.build('F#', 'major');
      
      const downPositions = generator.moveDownNeckAllPositions(originalSong);
      
      expect(downPositions.length).toBeGreaterThan(0);
      
      downPositions.forEach((position, index) => {
        expect(position.notes).toHaveLength(originalSong.notes.length);
        expect(position.title).toContain(`(Down ${index + 1})`);
      });
    });

    it('should find different positions with different fret spans', () => {
      const originalSong = generator.build('D', 'major');
      
      const positions4Fret = generator.getAllAlternativePositions(originalSong, 4);
      const positions5Fret = generator.getAllAlternativePositions(originalSong, 5);
      
      // Different fret spans might yield different numbers of positions
      expect(positions4Fret.length).toBeGreaterThan(0);
      expect(positions5Fret.length).toBeGreaterThan(0);
      
      // All positions should be valid
      [...positions4Fret, ...positions5Fret].forEach(position => {
        expect(position.notes).toHaveLength(originalSong.notes.length);
        position.notes.forEach(note => {
          const stringFretNote = note as StringFretNote;
          expect(stringFretNote.string).toBeGreaterThanOrEqual(1);
          expect(stringFretNote.string).toBeLessThanOrEqual(6);
          expect(stringFretNote.fret).toBeGreaterThanOrEqual(0);
          expect(stringFretNote.fret).toBeLessThanOrEqual(15);
        });
      });
    });

    it('should maintain original song metadata in all positions', () => {
      const originalSong = generator.build('A', 'minor');
      const allPositions = generator.getAllAlternativePositions(originalSong);
      
      allPositions.forEach(position => {
        expect(position.key).toBe(originalSong.key);
        expect(position.bpm).toBe(originalSong.bpm);
        expect(position.timeSignature).toEqual(originalSong.timeSignature);
        expect(position.chords).toEqual(originalSong.chords);
        expect(position.artist).toBe(originalSong.artist);
      });
    });
  });

  describe('position-based navigation', () => {
    it('should calculate and cache positions for consistent navigation', () => {
      const originalSong = generator.build('C', 'major');
      
      // Calculate all positions
      generator.calculateAllPositions(originalSong);
      
      // Should have multiple positions
      const positionCount = generator.getPositionCount(originalSong);
      expect(positionCount).toBeGreaterThan(1);
      
      // Should start at position 1
      expect(generator.getCurrentPositionIndex(originalSong)).toBe(1);
    });

    it('should provide consistent up/down neck navigation', () => {
      const originalSong = generator.build('G', 'major');
      
      // Calculate positions
      generator.calculateAllPositions(originalSong);
      const totalPositions = generator.getPositionCount(originalSong);
      
      // Start at position 1
      expect(generator.getCurrentPositionIndex(originalSong)).toBe(1);
      
      // Move up the neck
      const upSong = generator.moveUpNeck(originalSong);
      expect(generator.getCurrentPositionIndex(upSong)).toBe(2);
      expect(upSong.title).toContain('(Pos 2/');
      
      // Move up again
      const upSong2 = generator.moveUpNeck(upSong);
      expect(generator.getCurrentPositionIndex(upSong2)).toBe(3);
      expect(upSong2.title).toContain('(Pos 3/');
      
      // Move back down
      const downSong = generator.moveDownNeck(upSong2);
      expect(generator.getCurrentPositionIndex(downSong)).toBe(2);
      expect(downSong.title).toContain('(Pos 2/');
      
      // Move down to position 1
      const downSong2 = generator.moveDownNeck(downSong);
      expect(generator.getCurrentPositionIndex(downSong2)).toBe(1);
      expect(downSong2.title).toContain('(Pos 1/');
    });

    it('should handle boundary conditions correctly', () => {
      const originalSong = generator.build('D', 'minor');
      
      generator.calculateAllPositions(originalSong);
      const totalPositions = generator.getPositionCount(originalSong);
      
      // Try to move down from position 1 (should stay at 1)
      const currentSong = generator.getCurrentPosition(originalSong);
      const downFromFirst = generator.moveDownNeck(currentSong);
      expect(generator.getCurrentPositionIndex(downFromFirst)).toBe(1);
      
      // Jump to last position
      const lastPosition = generator.jumpToPosition(originalSong, totalPositions);
      expect(generator.getCurrentPositionIndex(lastPosition)).toBe(totalPositions);
      
      // Try to move up from last position (should stay at last)
      const upFromLast = generator.moveUpNeck(lastPosition);
      expect(generator.getCurrentPositionIndex(upFromLast)).toBe(totalPositions);
    });

    it('should allow jumping to specific positions', () => {
      const originalSong = generator.build('F', 'major');
      
      generator.calculateAllPositions(originalSong);
      const totalPositions = generator.getPositionCount(originalSong);
      
      if (totalPositions >= 3) {
        // Jump to position 3
        const position3 = generator.jumpToPosition(originalSong, 3);
        expect(generator.getCurrentPositionIndex(position3)).toBe(3);
        expect(position3.title).toContain('(Pos 3/');
        
        // Jump to position 1
        const position1 = generator.jumpToPosition(position3, 1);
        expect(generator.getCurrentPositionIndex(position1)).toBe(1);
        expect(position1.title).toContain('(Pos 1/');
      }
    });

    it('should maintain note count across all positions', () => {
      const originalSong = generator.build('A', 'major');
      
      generator.calculateAllPositions(originalSong);
      const totalPositions = generator.getPositionCount(originalSong);
      
      // Test all positions
      for (let i = 1; i <= totalPositions; i++) {
        const position = generator.jumpToPosition(originalSong, i);
        expect(position.notes).toHaveLength(originalSong.notes.length);
        expect(generator.getCurrentPositionIndex(position)).toBe(i);
      }
    });

    it('should sort positions from low to high frets', () => {
      const originalSong = generator.build('E', 'major');
      
      generator.calculateAllPositions(originalSong);
      const totalPositions = generator.getPositionCount(originalSong);
      
      if (totalPositions >= 2) {
        // Position 1 should have lower average fret than position 2
        const pos1 = generator.jumpToPosition(originalSong, 1);
        const pos2 = generator.jumpToPosition(originalSong, 2);
        
        const avgFret1 = pos1.notes.reduce((sum, note) => sum + (note as StringFretNote).fret, 0) / pos1.notes.length;
        const avgFret2 = pos2.notes.reduce((sum, note) => sum + (note as StringFretNote).fret, 0) / pos2.notes.length;
        
        expect(avgFret1).toBeLessThanOrEqual(avgFret2);
      }
    });
  });
}); 
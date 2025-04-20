#!/usr/bin/env python3
"""
Song Adjustment Tool - Manipulate measures in song JSON files

This script allows you to modify song structure by:
1. Adding a new measure (with a note) and shifting subsequent measures
2. Shifting measures starting from a specific index
3. Removing a measure completely
4. Shifting all notes after a specific time point by a time offset

Usage examples:
  # Add a new measure at index 2 with note G4 lasting 1 beat
  python adjust_song.py add song.json 2 --note G4 --duration 1
  
  # Shift all measures starting from index 3 forward by one
  python adjust_song.py shift song.json 3
  
  # Remove measure at index 4
  python adjust_song.py remove song.json 4
  
  # Shift all notes starting at time 4.0 by 2.5 beats
  python adjust_song.py timeshift song.json --start-time 4.0 --offset 2.5
  
  # Save the result to a different file
  python adjust_song.py add song.json 2 --note G4 --duration 1 --output new_song.json
"""

import json
import argparse
from pathlib import Path
from typing import List, Dict, Any, Union

def load_song(filepath: str) -> Dict[str, Any]:
    """Load a song from a JSON file"""
    with open(filepath, 'r') as f:
        return json.load(f)

def save_song(song: Dict[str, Any], filepath: str):
    """Save a song to a JSON file with proper formatting"""
    with open(filepath, 'w') as f:
        # Write metadata with 2-space indentation
        f.write('{\n')
        f.write('  "title": ' + json.dumps(song["title"]) + ',\n')
        f.write('  "artist": ' + json.dumps(song["artist"]) + ',\n')
        f.write('  "bpm": ' + json.dumps(song["bpm"]) + ',\n')
        f.write('  "timeSignature": ' + json.dumps(song["timeSignature"]) + ',\n')
        f.write('  "tuning": ' + json.dumps(song["tuning"]) + ',\n')
        f.write('  "notes": [\n')
        
        # Write notes in compact format
        for i, note in enumerate(song["notes"]):
            # Format note data in compact single-line format
            if 'rest' in note:
                note_str = f'    {{ "rest": true, "time": {note["time"]}, "duration": {note["duration"]}, "measure": {note["measure"]} }}'
            else:
                note_str = f'    {{ "note": "{note["note"]}", "time": {note["time"]}, "duration": {note["duration"]}, "measure": {note["measure"]} }}'
            
            # Add comma if not the last note
            if i < len(song["notes"]) - 1:
                note_str += ','
            
            f.write(note_str + '\n')
        
        # Close array and object
        f.write('  ]\n')
        f.write('}\n')

def get_beats_per_measure(song: Dict[str, Any]) -> float:
    """Get the number of beats per measure from the time signature"""
    return song["timeSignature"][0]

def shift_measures(song: Dict[str, Any], measure_index: int) -> Dict[str, Any]:
    """
    Shift all measures at and after the given index forward by one measure.
    
    Args:
        song: The song data dictionary
        measure_index: 0-based index of the first measure to shift
        
    Returns:
        Updated song dictionary with shifted measures
    """
    beats_per_measure = get_beats_per_measure(song)
    
    # Create a new list for adjusted notes
    adjusted_notes = []
    
    # Add notes before the shift point unchanged
    for note in song["notes"]:
        if note["measure"] < measure_index + 1:
            adjusted_notes.append(note)
        else:
            # Shift notes at and after the measure point
            adjusted_note = note.copy()
            adjusted_note["time"] += beats_per_measure
            adjusted_note["measure"] += 1
            adjusted_notes.append(adjusted_note)
    
    # Update the song with adjusted notes
    song["notes"] = adjusted_notes
    return song

def add_measure_with_note(song: Dict[str, Any], measure_index: int, new_note: Dict[str, Any]) -> Dict[str, Any]:
    """
    Add a new measure with a specific note and shift subsequent measures.
    
    Args:
        song: The song data dictionary
        measure_index: 0-based index where to insert the new measure
        new_note: Dictionary containing note data (without time and measure)
        
    Returns:
        Updated song dictionary with new measure and note
    """
    # First shift everything forward
    song = shift_measures(song, measure_index)
    
    # Then insert the new note at the correct position
    beats_per_measure = get_beats_per_measure(song)
    new_note["time"] = measure_index * beats_per_measure
    new_note["measure"] = measure_index + 1
    
    # Insert the new note in the correct position
    insertion_index = 0
    for i, note in enumerate(song["notes"]):
        if note["measure"] > measure_index + 1:
            insertion_index = i
            break
        elif i == len(song["notes"]) - 1:
            insertion_index = len(song["notes"])
    
    song["notes"].insert(insertion_index, new_note)
    return song

def remove_measure(song: Dict[str, Any], measure_index: int) -> Dict[str, Any]:
    """
    Remove a measure at the specified index and adjust subsequent measures.
    
    Args:
        song: The song data dictionary
        measure_index: 0-based index of the measure to remove
        
    Returns:
        Updated song dictionary with measure removed and subsequent measures shifted
    """
    beats_per_measure = get_beats_per_measure(song)
    
    # Create a new list for adjusted notes
    adjusted_notes = []
    
    # Add notes before the removal point unchanged
    for note in song["notes"]:
        if note["measure"] < measure_index + 1:
            adjusted_notes.append(note)
        elif note["measure"] > measure_index + 1:
            # Adjust timing and measure number for notes after the removed measure
            adjusted_note = note.copy()
            adjusted_note["time"] -= beats_per_measure
            adjusted_note["measure"] -= 1
            adjusted_notes.append(adjusted_note)
    
    # Update the song with adjusted notes
    song["notes"] = adjusted_notes
    return song

def shift_by_time(song: Dict[str, Any], start_time: float, time_offset: float) -> Dict[str, Any]:
    """
    Shift all notes starting at or after a specific time point by a time offset.
    
    Args:
        song: The song data dictionary
        start_time: Time point in beats after which notes should be shifted
        time_offset: Amount to shift notes by (in beats, can be positive or negative)
        
    Returns:
        Updated song dictionary with time-shifted notes
    """
    # Create a new list for adjusted notes
    adjusted_notes = []
    
    # Get beats per measure for recalculating measure numbers
    beats_per_measure = get_beats_per_measure(song)
    
    # Process each note
    for note in song["notes"]:
        if note["time"] >= start_time:
            # Shift notes at or after the time point
            adjusted_note = note.copy()
            adjusted_note["time"] += time_offset
            
            # Recalculate measure number based on new time
            adjusted_note["measure"] = int(adjusted_note["time"] / beats_per_measure) + 1
            
            adjusted_notes.append(adjusted_note)
        else:
            # Keep notes before the shift point unchanged
            adjusted_notes.append(note)
    
    # Update the song with adjusted notes
    song["notes"] = adjusted_notes
    return song

def main():
    parser = argparse.ArgumentParser(
        description='Adjust measures in a song JSON file',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Add a new measure at index 2 with note G4 lasting 1 beat
  python adjust_song.py add song.json 2 --note G4 --duration 1
  
  # Shift all measures starting from index 3 forward by one
  python adjust_song.py shift song.json 3
  
  # Remove measure at index 4
  python adjust_song.py remove song.json 4
  
  # Shift all notes starting at time 4.0 by 2.5 beats
  python adjust_song.py timeshift song.json --start-time 4.0 --offset 2.5
  
  # Save the result to a different file
  python adjust_song.py add song.json 2 --note G4 --duration 1 --output new_song.json
        """
    )
    
    parser.add_argument('action', choices=['add', 'shift', 'remove', 'timeshift'], 
                       help='Action to perform: add (insert measure with note), shift (move measures), remove (delete measure), timeshift (shift by time offset)')
    parser.add_argument('file', help='Path to the song JSON file to modify')
    parser.add_argument('measure', type=int, nargs='?', help='Measure index (0-based) to operate on (not used with timeshift)')
    parser.add_argument('--note', help='Note to add (e.g. "G4", "A#3") - required for add action')
    parser.add_argument('--duration', type=float, help='Note duration in beats - required for add action')
    parser.add_argument('--output', help='Output file path (defaults to overwriting input file)')
    parser.add_argument('--rest', action='store_true', help='Add a rest instead of a note (for add action)')
    parser.add_argument('--start-time', type=float, help='Starting time point (in beats) for timeshift action')
    parser.add_argument('--offset', type=float, help='Time offset (in beats) to shift notes by (can be positive or negative)')
    
    args = parser.parse_args()
    
    # Load the song
    song = load_song(args.file)
    
    if args.action == 'add':
        if not args.measure:
            parser.error("Measure index is required for add action")
        if args.rest:
            if not args.duration:
                parser.error("--duration is required for adding a rest")
            new_note = {
                "rest": True,
                "duration": args.duration
            }
        else:
            if not args.note or not args.duration:
                parser.error("--note and --duration are required for add action")
            new_note = {
                "note": args.note,
                "duration": args.duration
            }
        song = add_measure_with_note(song, args.measure, new_note)
    elif args.action == 'shift':
        if not args.measure:
            parser.error("Measure index is required for shift action")
        song = shift_measures(song, args.measure)
    elif args.action == 'remove':
        if not args.measure:
            parser.error("Measure index is required for remove action")
        song = remove_measure(song, args.measure)
    elif args.action == 'timeshift':
        if args.start_time is None or args.offset is None:
            parser.error("--start-time and --offset are required for timeshift action")
        song = shift_by_time(song, args.start_time, args.offset)
    
    # Save the modified song
    output_path = args.output if args.output else args.file
    save_song(song, output_path)
    print(f"Song successfully modified and saved to {output_path}")

if __name__ == "__main__":
    main() 
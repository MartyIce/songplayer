#!/usr/bin/env python3

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
    """Shift all measures at and after the given index forward by one measure"""
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
    """Add a new measure with a specific note and shift subsequent measures"""
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
    """Remove a measure at the specified index and adjust subsequent measures"""
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

def main():
    parser = argparse.ArgumentParser(description='Adjust measures in a song JSON file')
    parser.add_argument('action', choices=['add', 'shift', 'remove'], 
                       help='Action to perform (add: add note and shift, shift: just shift, remove: remove measure)')
    parser.add_argument('file', help='Path to the song JSON file')
    parser.add_argument('measure', type=int, help='Measure index (0-based)')
    parser.add_argument('--note', help='Note to add (e.g. "G4") - only needed for add action')
    parser.add_argument('--duration', type=float, help='Note duration in beats - only needed for add action')
    parser.add_argument('--output', help='Output file path (defaults to overwriting input)')
    
    args = parser.parse_args()
    
    # Load the song
    song = load_song(args.file)
    
    if args.action == 'add':
        if not args.note or not args.duration:
            parser.error("--note and --duration are required for add action")
        new_note = {
            "note": args.note,
            "duration": args.duration
        }
        song = add_measure_with_note(song, args.measure, new_note)
    elif args.action == 'shift':
        song = shift_measures(song, args.measure)
    else:  # remove
        song = remove_measure(song, args.measure)
    
    # Save the modified song
    output_path = args.output if args.output else args.file
    save_song(song, output_path)

if __name__ == "__main__":
    main() 
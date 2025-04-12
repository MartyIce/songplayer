#!/usr/bin/env python3

import os
import glob
import subprocess
import zipfile
import shutil
import urllib.request
import json
import xml.etree.ElementTree as ET
import argparse
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple

def parse_duration(duration: str, divisions: int) -> float:
    """Convert MusicXML duration to beats"""
    return float(duration) / divisions

def get_note_info(note_elem: ET.Element, divisions: int) -> Optional[Dict[str, Any]]:
    """Extract note information from a MusicXML note element"""
    # Check if it's a rest
    is_rest = note_elem.find('rest') is not None
    
    # Get duration
    duration_elem = note_elem.find('duration')
    if duration_elem is None:
        return None
    duration = parse_duration(duration_elem.text, divisions)
    
    # For rests
    if is_rest:
        return {
            "rest": True,
            "duration": duration
        }
    
    # Get pitch information
    pitch_elem = note_elem.find('pitch')
    if pitch_elem is None:
        return None
        
    step = pitch_elem.find('step').text
    octave = pitch_elem.find('octave').text
    
    # Handle accidentals
    alter_elem = pitch_elem.find('alter')
    alter = 0 if alter_elem is None else int(alter_elem.text)
    
    # Convert pitch to note name
    accidental = ''
    if alter == 1:
        accidental = '#'
    elif alter == -1:
        accidental = 'b'
    elif alter == 2:
        accidental = '##'
    elif alter == -2:
        accidental = 'bb'
    
    note = f"{step}{accidental}{octave}"
    
    return {
        "note": note,
        "duration": duration
    }

def combine_parts(xml_files: List[Path]) -> Dict[str, Any]:
    """Combine multiple XML files into a single song structure"""
    combined_notes = []
    current_time = 0.0
    
    # Sort files by their movement number (extracted from filename)
    sorted_files = sorted(xml_files, key=lambda x: int(x.stem.split('mvt')[-1]) if 'mvt' in x.stem else 0)
    
    metadata = {
        "title": "",
        "artist": "",
        "bpm": 90,  # Default value
        "timeSignature": [4, 4],  # Default value
        "tuning": ["E2", "A2", "D3", "G3", "B3", "E4"]  # Standard guitar tuning
    }
    
    for xml_file in sorted_files:
        try:
            tree = ET.parse(xml_file)
            root = tree.getroot()
            
            # Handle different XML namespaces
            ns = {'m': root.tag.split('}')[0].strip('{')} if '}' in root.tag else ''
            ns_prefix = f"{{{ns}}}" if ns else ''
            
            # Get metadata from first file
            if xml_file == sorted_files[0]:
                # Try to get title
                title_elem = root.find(f".//{ns_prefix}work-title")
                if title_elem is not None:
                    metadata["title"] = title_elem.text
                
                # Try to get composer
                composer_elem = root.find(f".//{ns_prefix}creator[@type='composer']")
                if composer_elem is not None:
                    metadata["artist"] = composer_elem.text
                
                # Try to get time signature
                time_elem = root.find(f".//{ns_prefix}time")
                if time_elem is not None:
                    beats = time_elem.find(f"{ns_prefix}beats")
                    beat_type = time_elem.find(f"{ns_prefix}beat-type")
                    if beats is not None and beat_type is not None:
                        metadata["timeSignature"] = [int(beats.text), int(beat_type.text)]
            
            # Get divisions per quarter note
            divisions_elem = root.find(f".//{ns_prefix}divisions")
            if divisions_elem is None:
                print(f"Warning: No divisions element found in {xml_file}")
                continue
            divisions = int(divisions_elem.text)
            
            # Process each part
            for part in root.findall(f".//{ns_prefix}part"):
                measure_time = current_time
                
                for measure in part.findall(f"{ns_prefix}measure"):
                    # Process notes in the measure
                    for note_elem in measure.findall(f"{ns_prefix}note"):
                        note_info = get_note_info(note_elem, divisions)
                        if note_info:
                            note_info["time"] = measure_time
                            combined_notes.append(note_info)
                            measure_time += note_info["duration"]
                
                current_time = measure_time
            
        except Exception as e:
            print(f"Error processing {xml_file}: {e}")
            continue
    
    return {**metadata, "notes": combined_notes}

def convert_to_json(xml_dir: Path, output_dir: Path):
    """Convert XML files to internal JSON format"""
    # Group XML files by base name (without mvt number)
    xml_groups = {}
    for xml_file in xml_dir.glob("*.xml"):
        base_name = xml_file.stem.split(".mvt")[0] if ".mvt" in xml_file.stem else xml_file.stem
        if base_name not in xml_groups:
            xml_groups[base_name] = []
        xml_groups[base_name].append(xml_file)
    
    # Process each group
    for base_name, xml_files in xml_groups.items():
        try:
            print(f"Converting {base_name} to JSON format...")
            song_data = combine_parts(xml_files)
            
            # Group notes by time
            notes_by_time = {}
            for note in song_data["notes"]:
                # Round time to nearest 0.5 to fix floating point precision
                time = round(note["time"] * 2) / 2
                # Round duration to nearest 0.5 or 0.333333 (for triplets)
                duration = note["duration"]
                if abs(duration - round(duration * 3) / 3) < 0.01:  # Close to a triplet
                    duration = round(duration * 3) / 3
                else:
                    duration = round(duration * 2) / 2
                
                note["time"] = time
                note["duration"] = duration
                
                # Group notes that occur at exactly the same time
                if time not in notes_by_time:
                    notes_by_time[time] = []
                notes_by_time[time].append(note)
            
            # Sort notes and format them
            formatted_notes = []
            last_time = -1
            for time in sorted(notes_by_time.keys()):
                notes = notes_by_time[time]
                
                # Add empty line between groups if there's a gap
                if last_time >= 0:
                    formatted_notes.append("\n")
                
                # Sort notes at same time by pitch (higher pitch first)
                notes.sort(key=lambda x: float('-inf') if 'rest' in x else int(x['note'][-1]) * 12 + {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}[x['note'][0]], reverse=True)
                
                # Add all notes that occur at this time
                for note in notes:
                    if 'rest' in note:
                        formatted_note = { "rest": True, "time": time, "duration": note["duration"] }
                    else:
                        formatted_note = { "note": note["note"], "time": time, "duration": note["duration"] }
                    formatted_notes.append(formatted_note)
                
                last_time = time
            
            # Save to JSON file with normalized filename and condensed format
            json_filename = base_name.lower().replace(" ", "-") + ".json"
            json_path = output_dir / json_filename
            
            # Format the metadata part with consistent order and format
            metadata = {
                "title": "Study No. 1" if "study" in base_name.lower() else song_data["title"],
                "artist": song_data["artist"],
                "bpm": 92,  # Standard tempo for studies
                "timeSignature": [3, 4],  # Common time signature for guitar studies
                "tuning": song_data["tuning"]
            }
            
            # Custom JSON formatting
            with open(json_path, 'w') as f:
                # Write metadata part
                f.write('{\n')
                f.write('  "title": ' + json.dumps(metadata["title"]) + ',\n')
                f.write('  "artist": ' + json.dumps(metadata["artist"]) + ',\n')
                f.write('  "bpm": ' + json.dumps(metadata["bpm"]) + ',\n')
                f.write('  "timeSignature": ' + json.dumps(metadata["timeSignature"]) + ',\n')
                f.write('  "tuning": ' + json.dumps(metadata["tuning"]) + ',\n')
                f.write('  "notes": [\n')
                
                # Write notes
                first_group = True
                for time in sorted(notes_by_time.keys()):
                    notes = notes_by_time[time]
                    
                    # Add blank line between groups
                    if not first_group:
                        f.write('\n')
                    first_group = False
                    
                    # Sort notes at same time by pitch (higher pitch first)
                    notes.sort(key=lambda x: float('-inf') if 'rest' in x else int(x['note'][-1]) * 12 + {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}[x['note'][0]], reverse=True)
                    
                    # Write all notes at this time
                    for i, note in enumerate(notes):
                        if i > 0:
                            f.write(',\n')
                        if 'rest' in note:
                            note_str = '    { "rest": true, "time": ' + str(note["time"]) + ', "duration": ' + str(note["duration"]) + ' }'
                        else:
                            note_str = '    { "note": "' + note["note"] + '", "time": ' + str(note["time"]) + ', "duration": ' + str(note["duration"]) + ' }'
                        f.write(note_str)
                    
                    # Add comma after group if not last group
                    if time != max(notes_by_time.keys()):
                        f.write(',')
                
                # Close array and object
                f.write('\n  ]\n')
                f.write('}\n')
            
            print(f"Successfully converted {base_name}")
            
        except Exception as e:
            print(f"Error converting {base_name}: {e}")
            continue

def get_audiveris_jar():
    """Get the path to the Audiveris executable"""
    audiveris_path = Path("audiveris/app/build/distributions")
    
    # First check if we have an extracted directory
    version_dirs = [d for d in audiveris_path.glob("app-*") if d.is_dir()]
    
    # If no extracted directory found, look for zip/tar files
    if not version_dirs:
        archives = list(audiveris_path.glob("app-*.zip")) + list(audiveris_path.glob("app-*.tar"))
        if not archives:
            raise FileNotFoundError("Audiveris distribution not found")
            
        # Extract the latest archive
        latest_archive = max(archives)
        extract_dir = latest_archive.with_suffix('')
        
        if latest_archive.suffix == '.zip':
            with zipfile.ZipFile(latest_archive, 'r') as zip_ref:
                zip_ref.extractall(audiveris_path)
        else:
            import tarfile
            with tarfile.open(latest_archive, 'r') as tar_ref:
                tar_ref.extractall(audiveris_path)
                
        version_dirs = [extract_dir]
    
    latest_dir = max(version_dirs)
    executable = latest_dir / "bin" / "Audiveris"
    
    if not executable.exists():
        raise FileNotFoundError(f"Audiveris executable not found at {executable}")
    
    return executable

def extract_xml_from_mxl(mxl_path, xml_dir):
    """Extract the XML content from an MXL file"""
    xml_filename = Path(mxl_path).stem + ".xml"
    xml_path = xml_dir / xml_filename
    
    with zipfile.ZipFile(mxl_path, 'r') as zip_ref:
        # MXL files typically contain a container.xml and the actual score
        # We want the score XML file, which is usually named score.xml
        for filename in zip_ref.namelist():
            if filename.endswith('.xml') and not filename.startswith('META-INF') and filename != 'container.xml':
                with zip_ref.open(filename) as source, open(xml_path, 'wb') as target:
                    shutil.copyfileobj(source, target)
                break

def process_image(image_path, audiveris_exec, output_dir, xml_dir, force_replace=False):
    """Process a single image with Audiveris"""
    image_name = Path(image_path).stem
    output_path = output_dir / image_name
    
    # Skip if already processed and not forcing replacement
    if not force_replace and list(output_dir.glob(f"{image_name}*.mxl")):
        print(f"Skipping {image_name} - already processed (use --force to reprocess)")
        return
    
    print(f"Processing {image_name}...")
    
    # Clean up any existing files if force replacing
    if force_replace:
        # Remove existing MXL files
        for mxl_file in output_dir.glob(f"{image_name}*.mxl"):
            mxl_file.unlink()
        # Remove existing XML files
        for xml_file in xml_dir.glob(f"{image_name}*.xml"):
            xml_file.unlink()
        # Remove existing JSON files
        for json_file in (Path(__file__).parent.parent / "public" / "songs").glob(f"{image_name.lower()}.json"):
            json_file.unlink()
    
    # Run Audiveris
    try:
        subprocess.run([
            str(audiveris_exec),
            "-batch",
            "-export",
            str(image_path)
        ], check=True)
        
        # Move generated MXL files to output directory
        for mxl_file in Path(image_path).parent.glob(f"{image_name}*.mxl"):
            new_path = output_dir / mxl_file.name
            shutil.move(str(mxl_file), str(new_path))
            
            # Extract XML from MXL
            extract_xml_from_mxl(new_path, xml_dir)
        
        # Move all log files from images directory to output directory
        for log_file in Path(image_path).parent.glob("*.log"):
            new_log_path = output_dir / log_file.name
            shutil.move(str(log_file), str(new_log_path))
            
        # Clean up Audiveris temporary files
        omr_file = Path(image_path).parent / f"{image_name}.omr"
        if omr_file.exists():
            omr_file.unlink()
            
    except subprocess.CalledProcessError as e:
        print(f"Error processing {image_name}: {e}")
    except Exception as e:
        print(f"Unexpected error processing {image_name}: {e}")

def setup_tesseract_languages():
    """Set up English language data for Tesseract OCR"""
    # Define the tessdata directory in the user's Application Support
    tessdata_dir = Path.home() / "Library" / "Application Support" / "AudiverisLtd" / "audiveris" / "tessdata"
    tessdata_dir.mkdir(parents=True, exist_ok=True)
    
    # Check if English language data exists
    eng_traineddata = tessdata_dir / "eng.traineddata"
    if not eng_traineddata.exists():
        print("Downloading English language data for OCR...")
        url = "https://github.com/tesseract-ocr/tessdata/raw/main/eng.traineddata"
        urllib.request.urlretrieve(url, eng_traineddata)
        print("English language data installed successfully")

def main():
    # Parse command line arguments
    parser = argparse.ArgumentParser(description='Process sheet music images with Audiveris')
    parser.add_argument('--force', action='store_true', help='Force reprocessing of all images')
    args = parser.parse_args()
    
    # Setup paths
    base_dir = Path(__file__).parent.parent
    images_dir = base_dir / "src" / "assets" / "images"
    output_dir = base_dir / "src" / "assets" / "audiveris_output"
    xml_dir = base_dir / "src" / "assets" / "sheetxml"
    songs_dir = base_dir / "public" / "songs"
    
    # Ensure directories exist
    output_dir.mkdir(exist_ok=True)
    xml_dir.mkdir(exist_ok=True)
    songs_dir.mkdir(exist_ok=True)
    
    # Set up Tesseract language data
    setup_tesseract_languages()
    
    # Get Audiveris executable
    try:
        audiveris_exec = get_audiveris_jar()
    except FileNotFoundError as e:
        print(f"Error: {e}")
        return
    
    # Make Audiveris executable
    os.chmod(audiveris_exec, 0o755)
    
    # Process all images
    image_files = list(images_dir.glob("*.jpg")) + list(images_dir.glob("*.png"))
    
    if not image_files:
        print("No image files found in the images directory")
        return
    
    for image_path in image_files:
        process_image(image_path, audiveris_exec, output_dir, xml_dir, args.force)
    
    # Convert processed XML files to JSON
    print("\nConverting XML files to JSON format...")
    convert_to_json(xml_dir, songs_dir)

if __name__ == "__main__":
    main() 
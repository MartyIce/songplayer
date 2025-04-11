#!/usr/bin/env python3

import os
import glob
import subprocess
import zipfile
import shutil
import urllib.request
from pathlib import Path

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

def process_image(image_path, audiveris_exec, output_dir, xml_dir):
    """Process a single image with Audiveris"""
    image_name = Path(image_path).stem
    output_path = output_dir / image_name
    
    # Skip if already processed
    if list(output_dir.glob(f"{image_name}*.mxl")):
        print(f"Skipping {image_name} - already processed")
        return
    
    print(f"Processing {image_name}...")
    
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
    # Setup paths
    base_dir = Path(__file__).parent.parent
    images_dir = base_dir / "src" / "assets" / "images"
    output_dir = base_dir / "src" / "assets" / "audiveris_output"
    xml_dir = base_dir / "src" / "assets" / "sheetxml"
    
    # Ensure directories exist
    output_dir.mkdir(exist_ok=True)
    xml_dir.mkdir(exist_ok=True)
    
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
        process_image(image_path, audiveris_exec, output_dir, xml_dir)

if __name__ == "__main__":
    main() 
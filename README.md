# Guitar Tablature Player

A React-based animated guitar tablature player, similar to a simplified Guitar Hero. This application allows you to visualize guitar tabs with notes sliding from right to left, playing sounds when they reach the trigger point.

## Features

- Visual representation of guitar strings
- Animated notes that slide to the left
- Sound playback when notes reach the trigger point
- Adjustable playback speed
- Support for loading JSON files that represent song notes

## Getting Started

### Prerequisites

- Node.js (v14 or later)
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Start the development server:

```bash
npm start
```

The application will be available at http://localhost:3000

## Song Data Format

Songs are represented as JSON files with the following structure:

```json
{
  "title": "Song Title",
  "artist": "Artist Name",
  "bpm": 120,
  "timeSignature": [4, 4],
  "notes": [
    { "string": 6, "fret": 0, "time": 0, "duration": 0.5 },
    { "string": 5, "fret": 2, "time": 0.5, "duration": 0.5 },
    ...
  ]
}
```

- `string`: Guitar string number (1-6, where 1 is the thinnest string)
- `fret`: Fret number (0-24)
- `time`: Time in seconds when the note should be played
- `duration`: Duration of the note in seconds
- `color` (optional): Custom color for the note

## Development

### Logging Configuration

The fret position calculation algorithm includes detailed logging that can be controlled via environment variables. This is useful for debugging and understanding how the algorithm works, but can be overwhelming in the browser console.

To control logging, add these environment variables to your `.env` file:

```bash
# Note Finder Logging Configuration
# Set to 'true' to enable specific logging categories, 'false' or omit to disable

# Attempt logs: "--- Attempt X: Testing fret box..."
REACT_APP_LOG_ATTEMPT=false

# Valid position logs: "✓ Successfully mapped..." "✓ Position validation passed"
REACT_APP_LOG_VALID=false

# Invalid position logs: "✗ Failed to map..." "✗ Invalid: negative fret"
REACT_APP_LOG_INVALID=false

# String-specific logs: "String 4 (open=55): fret would be 7"
REACT_APP_LOG_STRING=false

# Position summary logs: "Position 1: Avg fret 2.5, Range 0-5, Strings: S3:4 S4:8"
REACT_APP_LOG_POSITION=true

# Scoring logs: "Score: 15.25 (lower is better)" "Direction (up) score: 5.0"
REACT_APP_LOG_SCORING=false

# Mapping logs: "Note: String 3, Fret 2 → MIDI 52" "MIDI 52 → String 4, Fret 7"
REACT_APP_LOG_MAPPING=false

# Caching logs: "Cached 12 unique positions for C Major Scale"
REACT_APP_LOG_CACHING=true

# General logs: "=== CALCULATING ALL POSITIONS FOR: C Major Scale ==="
REACT_APP_LOG_GENERAL=true
```

**Default Settings:**
- `position`, `caching`, and `general` logs are enabled by default
- All other logs are disabled by default to prevent console spam
- You can enable specific categories as needed for debugging

**Recommended for Normal Use:**
```bash
REACT_APP_LOG_GENERAL=true
REACT_APP_LOG_CACHING=true
REACT_APP_LOG_POSITION=true
```

**For Deep Debugging:**
```bash
REACT_APP_LOG_ATTEMPT=true
REACT_APP_LOG_VALID=true
REACT_APP_LOG_INVALID=true
REACT_APP_LOG_STRING=true
REACT_APP_LOG_SCORING=true
REACT_APP_LOG_MAPPING=true
```

### Conditional Logging

For advanced debugging, you can enable detailed logging only when specific conditions are met. This is useful when you want to debug a particular scenario without being overwhelmed by logs from all positions.

**Enable conditional logging:**
```bash
REACT_APP_CONDITIONAL_LOG_ENABLED=true
```

**Condition Examples:**

Log everything when start fret is 5:
```bash
REACT_APP_CONDITIONAL_LOG_ENABLED=true
REACT_APP_CONDITIONAL_LOG_START_FRET=5
REACT_APP_CONDITIONAL_LOG_ENABLE_ALL=true
```

Log only when position uses string 1 (high E):
```bash
REACT_APP_CONDITIONAL_LOG_ENABLED=true
REACT_APP_CONDITIONAL_LOG_CONTAINS_STRING=1
REACT_APP_CONDITIONAL_LOG_ENABLE_ALL=true
```

Log when average fret is above 7:
```bash
REACT_APP_CONDITIONAL_LOG_ENABLED=true
REACT_APP_CONDITIONAL_LOG_AVG_FRET_ABOVE=7
REACT_APP_CONDITIONAL_LOG_ENABLE_ALL=true
```

Log specific categories for positions using strings 1 and 2:
```bash
REACT_APP_CONDITIONAL_LOG_ENABLED=true
REACT_APP_CONDITIONAL_LOG_CONTAINS_STRINGS=[1,2]
REACT_APP_CONDITIONAL_LOG_ENABLE_ALL=false
REACT_APP_CONDITIONAL_LOG_CATEGORIES=["string","valid","scoring"]
```

**Available Conditions:**
- `REACT_APP_CONDITIONAL_LOG_START_FRET=5` - When fret box starts at fret 5
- `REACT_APP_CONDITIONAL_LOG_END_FRET=9` - When fret box ends at fret 9  
- `REACT_APP_CONDITIONAL_LOG_FRET_RANGE=[5,12]` - When fret box is within range
- `REACT_APP_CONDITIONAL_LOG_CONTAINS_STRING=1` - When position uses string 1
- `REACT_APP_CONDITIONAL_LOG_CONTAINS_STRINGS=[1,2]` - When position uses strings 1 AND 2
- `REACT_APP_CONDITIONAL_LOG_AVG_FRET_ABOVE=7` - When average fret > 7
- `REACT_APP_CONDITIONAL_LOG_AVG_FRET_BELOW=3` - When average fret < 3
- `REACT_APP_CONDITIONAL_LOG_POSITION_INDEX=2` - When it's the 3rd position (0-indexed)
- `REACT_APP_CONDITIONAL_LOG_SONG_TITLE="Major"` - When song title contains "Major"

**Conditional Logging Options:**
- `REACT_APP_CONDITIONAL_LOG_ENABLE_ALL=true` - Enable all log categories when conditions match
- `REACT_APP_CONDITIONAL_LOG_CATEGORIES=["string","scoring"]` - Enable only specific categories

When conditional logging is active, logs will be prefixed with `[CONDITIONAL]` to distinguish them from normal logs.

## Technologies Used

- React
- TypeScript
- Tone.js for audio synthesis

## License

MIT 
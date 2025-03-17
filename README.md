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

## Technologies Used

- React
- TypeScript
- Tone.js for audio synthesis

## License

MIT 
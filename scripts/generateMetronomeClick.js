const fs = require('fs');
const { Tone } = require('tone');

// Create an offline context
const context = new Tone.OfflineContext(2, 0.1, 44100);

// Create a short click sound
const click = new Tone.Oscillator({
  frequency: 1000,
  type: 'sine',
  volume: -6,
}).connect(context.destination);

// Create an envelope for the click
const env = new Tone.AmplitudeEnvelope({
  attack: 0.001,
  decay: 0.05,
  sustain: 0,
  release: 0.05,
}).connect(click.output);

// Schedule the click
click.start(0);
env.triggerAttackRelease(0.05, 0);

// Render the audio
context.render().then((buffer) => {
  // Convert to WAV
  const wav = buffer.toArray();
  
  // Save the file
  fs.writeFileSync('public/samples/metronome/click.wav', Buffer.from(wav));
  
  console.log('Metronome click sound generated successfully!');
}).catch((err) => {
  console.error('Error generating metronome click:', err);
}); 
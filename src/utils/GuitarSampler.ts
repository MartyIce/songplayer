import * as Tone from 'tone';

export type GuitarType = 'acoustic' | 'electric' | 'nylon';

export class GuitarSampler {
    private sampler: Tone.Sampler | null = null;
    private isLoaded: boolean = false;
    private currentType: GuitarType = 'acoustic';
    private activeNotes: Set<string> = new Set();

    // Define key samples for each guitar type - Tone.js will interpolate between these
    private notesByType = {
        acoustic: {
            'E2': 'E2.[mp3|ogg]',  // Low E
            'A2': 'A2.[mp3|ogg]',  // Low A
            'D3': 'D3.[mp3|ogg]',  // D
            'G3': 'G3.[mp3|ogg]',  // G
            'B3': 'B3.[mp3|ogg]',  // B
            'E4': 'E4.[mp3|ogg]',  // High E
            'A4': 'A4.[mp3|ogg]',  // One octave up from low A
            'D5': 'D5.[mp3|ogg]'   // Highest common note
        },
        electric: {
            'E2': 'E2.[mp3|ogg]',  // Low E
            'A2': 'A2.[mp3|ogg]',  // Low A
            'D#3': 'Ds3.[mp3|ogg]', // Around D
            'A3': 'A3.[mp3|ogg]',   // Middle A
            'D#4': 'Ds4.[mp3|ogg]', // Middle register
            'A4': 'A4.[mp3|ogg]',   // High A
            'D#5': 'Ds5.[mp3|ogg]', // High register
            'A5': 'A5.[mp3|ogg]'    // Highest A
        },
        nylon: {
            'E2': 'E2.[mp3|ogg]',  // Low E
            'A2': 'A2.[mp3|ogg]',  // Low A
            'D3': 'D3.[mp3|ogg]',  // D
            'G3': 'G3.[mp3|ogg]',  // G
            'B3': 'B3.[mp3|ogg]',  // B
            'E4': 'E4.[mp3|ogg]',  // High E
            'A4': 'A4.[mp3|ogg]',  // One octave up
            'E5': 'E5.[mp3|ogg]'   // Highest E
        }
    };

    constructor() {
        this.initializeSampler('acoustic');
    }

    private getBaseUrl(type: GuitarType): string {
        return `/samples/guitar-${type}/`;
    }

    public async switchGuitar(type: GuitarType) {
        this.stopAllNotes(); // Stop any playing notes before switching
        this.isLoaded = false;
        if (this.sampler) {
            this.sampler.dispose();
        }
        this.currentType = type;
        await this.initializeSampler(type);
    }

    private initializeSampler(type: GuitarType) {
        // Create a loading indicator
        const progress = document.createElement('div');
        progress.id = 'loading-progress';
        progress.style.position = 'fixed';
        progress.style.top = '50%';
        progress.style.left = '50%';
        progress.style.transform = 'translate(-50%, -50%)';
        progress.style.padding = '20px';
        progress.style.background = 'rgba(0,0,0,0.8)';
        progress.style.color = 'white';
        progress.style.borderRadius = '8px';
        progress.style.zIndex = '1000';
        progress.textContent = `Loading ${type} guitar samples...`;
        document.body.appendChild(progress);

        // Initialize the sampler with our notes
        this.sampler = new Tone.Sampler({
            urls: this.notesByType[type],
            baseUrl: this.getBaseUrl(type),
            onload: () => {
                this.isLoaded = true;
                console.log(`${type} guitar samples loaded successfully`);
                progress.remove();
            },
            onerror: (error) => {
                console.error(`Error loading ${type} guitar samples:`, error);
                progress.textContent = `Error loading ${type} guitar samples. Please refresh.`;
                setTimeout(() => progress.remove(), 3000);
            }
        }).toDestination();
    }

    public playNote(note: string, time: number, duration: number) {
        if (this.sampler && this.isLoaded) {
            this.sampler.triggerAttackRelease(note, duration, time);
            this.activeNotes.add(note);
            // Remove note from active notes after duration
            Tone.Transport.schedule(() => {
                this.activeNotes.delete(note);
            }, time + duration);
        }
    }

    public stopAllNotes() {
        if (this.sampler) {
            // Release all active notes
            this.activeNotes.forEach(note => {
                this.sampler?.triggerRelease(note, Tone.now());
            });
            this.activeNotes.clear();
            
            // Also call releaseAll as a safety measure
            this.sampler.releaseAll();
        }
    }

    public isReady(): boolean {
        return this.isLoaded && this.sampler !== null;
    }

    public getCurrentType(): GuitarType {
        return this.currentType;
    }
}

export const guitarSampler = new GuitarSampler(); 
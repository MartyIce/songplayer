import * as Tone from 'tone';

export type GuitarType = 'acoustic' | 'electric' | 'nylon';

class GuitarSampler {
    private sampler: Tone.Sampler | null = null;
    private isLoaded: boolean = false;
    private currentType: GuitarType = 'acoustic';

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
        this.initializeSampler();
    }

    private getBaseUrl(type: GuitarType): string {
        return `/samples/guitar-${type}/`;
    }

    public async switchGuitar(type: GuitarType) {
        this.currentType = type;
        this.isLoaded = false;
        if (this.sampler) {
            this.sampler.dispose();
        }
        await this.initializeSampler();
    }

    private initializeSampler() {
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
        progress.textContent = `Loading ${this.currentType} guitar samples...`;
        document.body.appendChild(progress);

        // Initialize the sampler with our notes
        this.sampler = new Tone.Sampler({
            urls: this.notesByType[this.currentType],
            baseUrl: this.getBaseUrl(this.currentType),
            onload: () => {
                this.isLoaded = true;
                console.log(`${this.currentType} guitar samples loaded successfully`);
                progress.remove();
            },
            onerror: (error) => {
                console.error(`Error loading ${this.currentType} guitar samples:`, error);
                progress.textContent = `Error loading ${this.currentType} guitar samples. Please refresh.`;
                setTimeout(() => progress.remove(), 3000);
            }
        }).toDestination();
    }

    public async playNote(note: string, time: number, duration: number) {
        if (!this.isLoaded || !this.sampler) {
            console.warn('Sampler not loaded yet');
            return;
        }

        try {
            // Let Tone.js handle the pitch shifting automatically
            this.sampler.triggerAttackRelease(note, duration, time);
        } catch (error) {
            console.error('Error playing note:', note, error);
        }
    }

    public isReady(): boolean {
        return this.isLoaded;
    }

    public getCurrentType(): GuitarType {
        return this.currentType;
    }
}

export const guitarSampler = new GuitarSampler(); 
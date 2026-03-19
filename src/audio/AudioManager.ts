import type { Rarity } from '../types/content';
import type { BgmTrack, SceneTheme } from '../types/environment';

const nowMs = (): number => performance.now();

type DragonSound = 'breath' | 'huff' | 'idle' | 'rumble';

interface AmbientProfile {
  ambientFreq: number;
  ambientLfoRate: number;
  ambientLfoDepth: number;
  ambientFilterType: BiquadFilterType;
  ambientFilterFreq: number;
  noiseFilterType: BiquadFilterType;
  noiseFilterFreq: number;
  noiseGain: number;
  ambientGain: number;
}

interface MusicPattern {
  bpm: number;
  wave: OscillatorType;
  gain: number;
  notes: Array<number | null>;
}

const AMBIENT_PROFILES: Record<SceneTheme, AmbientProfile> = {
  cave: {
    ambientFreq: 42,
    ambientLfoRate: 0.08,
    ambientLfoDepth: 4,
    ambientFilterType: 'lowpass',
    ambientFilterFreq: 220,
    noiseFilterType: 'lowpass',
    noiseFilterFreq: 180,
    noiseGain: 0.08,
    ambientGain: 0.15,
  },
  castle: {
    ambientFreq: 55,
    ambientLfoRate: 0.11,
    ambientLfoDepth: 5,
    ambientFilterType: 'bandpass',
    ambientFilterFreq: 360,
    noiseFilterType: 'highpass',
    noiseFilterFreq: 440,
    noiseGain: 0.045,
    ambientGain: 0.12,
  },
  mountain: {
    ambientFreq: 48,
    ambientLfoRate: 0.06,
    ambientLfoDepth: 6,
    ambientFilterType: 'lowpass',
    ambientFilterFreq: 280,
    noiseFilterType: 'highpass',
    noiseFilterFreq: 620,
    noiseGain: 0.06,
    ambientGain: 0.13,
  },
  forest: {
    ambientFreq: 66,
    ambientLfoRate: 0.14,
    ambientLfoDepth: 4.2,
    ambientFilterType: 'bandpass',
    ambientFilterFreq: 420,
    noiseFilterType: 'bandpass',
    noiseFilterFreq: 520,
    noiseGain: 0.05,
    ambientGain: 0.13,
  },
  ocean: {
    ambientFreq: 38,
    ambientLfoRate: 0.09,
    ambientLfoDepth: 7,
    ambientFilterType: 'lowpass',
    ambientFilterFreq: 170,
    noiseFilterType: 'lowpass',
    noiseFilterFreq: 140,
    noiseGain: 0.1,
    ambientGain: 0.16,
  },
};

const MUSIC_PATTERNS: Record<Exclude<BgmTrack, 'off' | 'scene'>, MusicPattern> = {
  embersong: {
    bpm: 74,
    wave: 'triangle',
    gain: 0.046,
    notes: [0, 7, 12, 7, 3, 10, 12, 10, 5, 12, 15, 12, 7, 10, 12, null],
  },
  courtyard: {
    bpm: 88,
    wave: 'sine',
    gain: 0.04,
    notes: [0, 4, 7, 12, 7, 4, 2, 7, 11, 14, 11, 7, 4, 7, 9, null],
  },
  wilds: {
    bpm: 68,
    wave: 'triangle',
    gain: 0.044,
    notes: [0, 5, 7, 10, 7, 5, 3, 8, 10, 15, 10, 8, 5, 8, 10, null],
  },
  abyssal: {
    bpm: 62,
    wave: 'sawtooth',
    gain: 0.035,
    notes: [0, 3, 7, 10, 7, 3, 2, 5, 8, 12, 8, 5, 3, 7, 8, null],
  },
};

const DEFAULT_TRACK_BY_SCENE: Record<SceneTheme, Exclude<BgmTrack, 'off' | 'scene'>> = {
  cave: 'embersong',
  castle: 'courtyard',
  mountain: 'wilds',
  forest: 'wilds',
  ocean: 'abyssal',
};

const semitoneToFreq = (semitoneOffset: number, root = 164.81): number => root * 2 ** (semitoneOffset / 12);

export class AudioManager {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private musicGain: GainNode | null = null;

  private ambientOsc: OscillatorNode | null = null;
  private ambientLfo: OscillatorNode | null = null;
  private ambientLfoGain: GainNode | null = null;
  private ambientFilter: BiquadFilterNode | null = null;

  private noiseNode: AudioBufferSourceNode | null = null;
  private noiseFilter: BiquadFilterNode | null = null;
  private noiseGain: GainNode | null = null;

  private musicTimer: number | null = null;
  private musicStep = 0;

  private unlocked = false;
  private muted = true;
  private sceneTheme: SceneTheme = 'cave';
  private musicTrack: BgmTrack = 'off';

  private lastCollisionAt = 0;
  private lastHoverAt = 0;

  constructor(initialMuted: boolean) {
    this.muted = initialMuted;
  }

  get isMuted(): boolean {
    return this.muted;
  }

  async unlock(): Promise<void> {
    if (this.unlocked) {
      if (this.context?.state === 'suspended') {
        await this.context.resume();
      }
      return;
    }

    const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) {
      return;
    }

    this.context = new Ctx();

    this.masterGain = this.context.createGain();
    this.masterGain.gain.value = this.muted ? 0 : 0.68;
    this.masterGain.connect(this.context.destination);

    this.ambientGain = this.context.createGain();
    this.ambientGain.gain.value = this.muted ? 0 : 0.15;
    this.ambientGain.connect(this.masterGain);

    this.musicGain = this.context.createGain();
    this.musicGain.gain.value = this.muted ? 0 : 0.2;
    this.musicGain.connect(this.masterGain);

    this.unlocked = true;
    await this.context.resume();

    this.startAmbient();
    this.applyAmbientProfile();
    this.restartMusic();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (!this.masterGain || !this.ambientGain || !this.musicGain || !this.context) {
      return;
    }

    this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.68, this.context.currentTime, 0.08);
    this.ambientGain.gain.setTargetAtTime(muted ? 0 : AMBIENT_PROFILES[this.sceneTheme].ambientGain, this.context.currentTime, 0.2);
    this.musicGain.gain.setTargetAtTime(muted ? 0 : 0.2, this.context.currentTime, 0.18);
  }

  setSceneTheme(theme: SceneTheme): void {
    this.sceneTheme = theme;
    if (!this.unlocked) {
      return;
    }
    this.applyAmbientProfile();
    if (this.musicTrack === 'scene') {
      this.restartMusic();
    }
  }

  setMusicTrack(track: BgmTrack): void {
    this.musicTrack = track;
    if (!this.unlocked) {
      return;
    }
    this.restartMusic();
  }

  startAmbient(): void {
    if (!this.context || !this.ambientGain || this.ambientOsc) {
      return;
    }

    const osc = this.context.createOscillator();
    osc.type = 'triangle';

    const lfo = this.context.createOscillator();
    lfo.type = 'sine';

    const lfoGain = this.context.createGain();
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    const filter = this.context.createBiquadFilter();
    osc.connect(filter);
    filter.connect(this.ambientGain);

    const noiseBuffer = this.context.createBuffer(1, this.context.sampleRate * 2, this.context.sampleRate);
    const channel = noiseBuffer.getChannelData(0);
    for (let i = 0; i < channel.length; i += 1) {
      channel[i] = (Math.random() * 2 - 1) * 0.4;
    }

    const noiseSource = this.context.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    const noiseFilter = this.context.createBiquadFilter();
    const noiseGain = this.context.createGain();

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.ambientGain);

    osc.start();
    lfo.start();
    noiseSource.start();

    this.ambientOsc = osc;
    this.ambientLfo = lfo;
    this.ambientLfoGain = lfoGain;
    this.ambientFilter = filter;
    this.noiseNode = noiseSource;
    this.noiseFilter = noiseFilter;
    this.noiseGain = noiseGain;
  }

  stopAmbient(): void {
    this.ambientOsc?.stop();
    this.ambientLfo?.stop();
    this.noiseNode?.stop();

    this.ambientOsc = null;
    this.ambientLfo = null;
    this.ambientLfoGain = null;
    this.ambientFilter = null;
    this.noiseNode = null;
    this.noiseFilter = null;
    this.noiseGain = null;
  }

  playCollision(impact: number): void {
    if (!this.context || this.muted) {
      return;
    }

    const time = nowMs();
    if (time - this.lastCollisionAt < 70) {
      return;
    }
    this.lastCollisionAt = time;

    const intensity = Math.max(0.08, Math.min(1, impact));
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = this.sceneTheme === 'castle' ? 'sine' : 'triangle';
    osc.frequency.value = 110 + intensity * 220;

    gain.gain.setValueAtTime(0.001, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.07 * intensity, this.context.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start();
    osc.stop(this.context.currentTime + 0.16);
  }

  playSelect(rarity: Rarity): void {
    if (!this.context || this.muted) {
      return;
    }

    const freqByRarity: Record<Rarity, number> = {
      common: 220,
      uncommon: 280,
      rare: 330,
      epic: 440,
      legendary: 520,
    };

    const osc = this.context.createOscillator();
    const gain = this.context.createGain();

    osc.type = rarity === 'legendary' ? 'sawtooth' : 'sine';
    osc.frequency.setValueAtTime(freqByRarity[rarity], this.context.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freqByRarity[rarity] * 1.4, this.context.currentTime + 0.09);

    gain.gain.setValueAtTime(0.001, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, this.context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + 0.22);

    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start();
    osc.stop(this.context.currentTime + 0.23);
  }

  playHover(): void {
    if (!this.context || this.muted) {
      return;
    }

    const time = nowMs();
    if (time - this.lastHoverAt < 130) {
      return;
    }
    this.lastHoverAt = time;

    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = 'sine';
    osc.frequency.value = this.sceneTheme === 'ocean' ? 540 : 660;

    gain.gain.setValueAtTime(0.001, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.015, this.context.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start();
    osc.stop(this.context.currentTime + 0.09);
  }

  playDragon(kind: DragonSound): void {
    if (!this.context || this.muted) {
      return;
    }

    const cfg: Record<DragonSound, { freq: number; duration: number; gain: number; type: OscillatorType }> = {
      breath: { freq: 90, duration: 0.45, gain: 0.05, type: 'triangle' },
      huff: { freq: 60, duration: 0.32, gain: 0.08, type: 'sawtooth' },
      idle: { freq: 120, duration: 0.24, gain: 0.035, type: 'sine' },
      rumble: { freq: 46, duration: 0.8, gain: 0.1, type: 'triangle' },
    };

    const config = cfg[kind];
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    const filter = this.context.createBiquadFilter();

    osc.type = config.type;
    osc.frequency.setValueAtTime(config.freq, this.context.currentTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, config.freq * 0.65), this.context.currentTime + config.duration);

    filter.type = 'lowpass';
    filter.frequency.value = this.sceneTheme === 'ocean' ? 300 : 420;

    gain.gain.setValueAtTime(0.001, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(config.gain, this.context.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + config.duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);

    osc.start();
    osc.stop(this.context.currentTime + config.duration + 0.02);
  }

  destroy(): void {
    this.stopMusic();
    this.stopAmbient();
    if (this.context) {
      this.context.close();
    }
    this.context = null;
    this.masterGain = null;
    this.ambientGain = null;
    this.musicGain = null;
    this.unlocked = false;
  }

  private applyAmbientProfile(): void {
    if (!this.context || !this.ambientGain) {
      return;
    }

    const profile = AMBIENT_PROFILES[this.sceneTheme];
    const time = this.context.currentTime;

    this.ambientGain.gain.setTargetAtTime(this.muted ? 0 : profile.ambientGain, time, 0.24);

    if (this.ambientOsc) {
      this.ambientOsc.frequency.setTargetAtTime(profile.ambientFreq, time, 0.2);
    }
    if (this.ambientLfo) {
      this.ambientLfo.frequency.setTargetAtTime(profile.ambientLfoRate, time, 0.3);
    }
    if (this.ambientLfoGain) {
      this.ambientLfoGain.gain.setTargetAtTime(profile.ambientLfoDepth, time, 0.3);
    }
    if (this.ambientFilter) {
      this.ambientFilter.type = profile.ambientFilterType;
      this.ambientFilter.frequency.setTargetAtTime(profile.ambientFilterFreq, time, 0.28);
    }
    if (this.noiseFilter) {
      this.noiseFilter.type = profile.noiseFilterType;
      this.noiseFilter.frequency.setTargetAtTime(profile.noiseFilterFreq, time, 0.28);
    }
    if (this.noiseGain) {
      this.noiseGain.gain.setTargetAtTime(profile.noiseGain, time, 0.28);
    }
  }

  private restartMusic(): void {
    this.stopMusic();

    if (!this.context || !this.musicGain || this.musicTrack === 'off') {
      return;
    }

    this.musicStep = 0;
    const track = this.musicTrack === 'scene' ? DEFAULT_TRACK_BY_SCENE[this.sceneTheme] : this.musicTrack;
    const pattern = MUSIC_PATTERNS[track];
    const intervalMs = Math.max(180, Math.round((60_000 / pattern.bpm) / 2));

    this.musicTimer = window.setInterval(() => {
      this.playMusicStep(pattern);
    }, intervalMs);
  }

  private stopMusic(): void {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  private playMusicStep(pattern: MusicPattern): void {
    if (!this.context || !this.musicGain || this.muted) {
      this.musicStep += 1;
      return;
    }

    const note = pattern.notes[this.musicStep % pattern.notes.length];
    this.musicStep += 1;

    if (note === null) {
      return;
    }

    const osc = this.context.createOscillator();
    const pad = this.context.createOscillator();
    const gain = this.context.createGain();
    const filter = this.context.createBiquadFilter();

    const freq = semitoneToFreq(note, this.sceneTheme === 'ocean' ? 146.83 : 164.81);

    osc.type = pattern.wave;
    osc.frequency.setValueAtTime(freq, this.context.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.998, this.context.currentTime + 0.32);

    pad.type = 'sine';
    pad.frequency.setValueAtTime(freq * 0.5, this.context.currentTime);

    filter.type = 'lowpass';
    filter.frequency.value = this.sceneTheme === 'castle' ? 1800 : 1450;

    gain.gain.setValueAtTime(0.001, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(pattern.gain, this.context.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + 0.42);

    osc.connect(filter);
    pad.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);

    osc.start();
    pad.start();
    osc.stop(this.context.currentTime + 0.45);
    pad.stop(this.context.currentTime + 0.45);
  }
}

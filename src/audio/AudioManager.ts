import type { Rarity } from '../types/content';

const nowMs = (): number => performance.now();

type DragonSound = 'breath' | 'huff' | 'idle' | 'rumble';

export class AudioManager {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private ambientOsc: OscillatorNode | null = null;
  private noiseNode: AudioBufferSourceNode | null = null;
  private unlocked = false;
  private muted = true;
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
    this.masterGain.gain.value = this.muted ? 0 : 0.65;
    this.masterGain.connect(this.context.destination);

    this.ambientGain = this.context.createGain();
    this.ambientGain.gain.value = this.muted ? 0 : 0.15;
    this.ambientGain.connect(this.masterGain);

    this.unlocked = true;
    await this.context.resume();
    this.startAmbient();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (!this.masterGain || !this.ambientGain) {
      return;
    }
    this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.65, this.context!.currentTime, 0.08);
    this.ambientGain.gain.setTargetAtTime(muted ? 0 : 0.15, this.context!.currentTime, 0.2);
  }

  startAmbient(): void {
    if (!this.context || !this.ambientGain || this.ambientOsc) {
      return;
    }

    const osc = this.context.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = 42;

    const lfo = this.context.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.08;

    const lfoGain = this.context.createGain();
    lfoGain.gain.value = 4;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 220;

    osc.connect(filter);
    filter.connect(this.ambientGain);

    osc.start();
    lfo.start();

    const noiseBuffer = this.context.createBuffer(1, this.context.sampleRate * 2, this.context.sampleRate);
    const channel = noiseBuffer.getChannelData(0);
    for (let i = 0; i < channel.length; i += 1) {
      channel[i] = (Math.random() * 2 - 1) * 0.4;
    }

    const noiseSource = this.context.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    const noiseFilter = this.context.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = 180;

    const noiseGain = this.context.createGain();
    noiseGain.gain.value = 0.08;

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.ambientGain);

    noiseSource.start();

    this.ambientOsc = osc;
    this.noiseNode = noiseSource;
  }

  stopAmbient(): void {
    this.ambientOsc?.stop();
    this.noiseNode?.stop();
    this.ambientOsc = null;
    this.noiseNode = null;
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
    osc.type = 'triangle';
    osc.frequency.value = 120 + intensity * 220;

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
    osc.frequency.value = 660;
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
    filter.frequency.value = 420;

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
    this.stopAmbient();
    if (this.context) {
      this.context.close();
    }
    this.context = null;
    this.masterGain = null;
    this.ambientGain = null;
    this.unlocked = false;
  }
}

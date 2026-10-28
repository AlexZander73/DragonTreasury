export class TreasurySound {
  private context?: AudioContext;
  private master?: GainNode;
  private sources: AudioScheduledSourceNode[] = [];
  async start() {
    this.stop();
    const context = new AudioContext(); this.context = context;
    const master = context.createGain(); master.gain.value = .055; master.connect(context.destination); this.master = master;
    const buffer = context.createBuffer(1, context.sampleRate * 3, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noise = context.createBufferSource(); noise.buffer = buffer; noise.loop = true;
    const filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 240;
    noise.connect(filter); filter.connect(master); noise.start(); this.sources.push(noise);
    const drone = context.createOscillator(); drone.type = 'sine'; drone.frequency.value = 65.4;
    const gain = context.createGain(); gain.gain.value = .25;
    drone.connect(gain); gain.connect(master); drone.start(); this.sources.push(drone);
    await context.resume();
  }
  chime() {
    if (!this.context || !this.master) return;
    const oscillator = this.context.createOscillator(); const gain = this.context.createGain(); const now = this.context.currentTime;
    oscillator.frequency.setValueAtTime(660, now); oscillator.frequency.exponentialRampToValueAtTime(440, now + .5);
    gain.gain.setValueAtTime(.4, now); gain.gain.exponentialRampToValueAtTime(.001, now + .65);
    oscillator.connect(gain); gain.connect(this.master); oscillator.start(); oscillator.stop(now + .7);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
  setHidden(hidden: boolean) { if (this.context) void (hidden ? this.context.suspend() : this.context.resume()).catch(() => {}); }
  stop() { this.sources.forEach(source => { try { source.stop(); } catch { /* already stopped */ } }); this.sources = []; if (this.context) void this.context.close().catch(() => {}); this.context = undefined; this.master = undefined; }
}

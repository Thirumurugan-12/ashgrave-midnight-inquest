// Atmosphere made in the browser: rain, a church bell, a sting for a broken lie.
// No audio files. Off until the player turns it on (browsers need a click first).

class Sound {
  on = false;
  private ctx?: AudioContext;
  private rain?: AudioBufferSourceNode;
  private master?: GainNode;

  unlock(): void {
    if (!this.ctx) this.ctx = new AudioContext();
    void this.ctx.resume();
  }

  toggle(): void {
    this.unlock();
    this.on = !this.on;
    if (this.on) this.startRain();
    else this.stopRain();
  }

  private startRain(): void {
    const ctx = this.ctx!;
    this.master = ctx.createGain();
    this.master.gain.value = 0.18;
    this.master.connect(ctx.destination);
    const buf = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      // Brown-ish noise reads as steady rain.
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      data[i] = last * 3.5;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1400;
    src.connect(lp).connect(this.master);
    src.start();
    this.rain = src;
  }

  private stopRain(): void {
    this.rain?.stop();
    this.rain = undefined;
    this.master?.disconnect();
  }

  private tone(freq: number, dur: number, gain: number, type: OscillatorType = "sine", delay = 0): void {
    if (!this.on || !this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + dur);
  }

  bell(): void {
    for (const [f, g] of [[196, 0.3], [392, 0.12], [523, 0.08], [784, 0.04]] as const) this.tone(f, 4.5, g);
  }

  sting(): void {
    this.tone(110, 1.2, 0.25, "sawtooth");
    this.tone(116.5, 1.2, 0.2, "sawtooth", 0.02);
    this.tone(55, 1.6, 0.3, "sine");
  }
}

export const sound = new Sound();

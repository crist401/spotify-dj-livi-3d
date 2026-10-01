/**
 * Audio Engine for Spotify DJ Livi ESP32 Device
 * Provides Web Audio API synthesized music, sound effects, FFT spectrum analyzer,
 * and Web Speech API Spanish DJ Livi voice synthesis.
 */

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.analyser = null;
    this.isPlaying = false;
    this.volume = 0.7; // 0.0 to 1.0
    this.tempo = 110;
    this.step = 0;
    this.timerId = null;
    this.currentTrackName = "DJ Livi Flow • Session 01";
    this.currentArtist = "Spotify AI DJ (ESP32 Edition)";
    
    // Voice Synth (DJ Livi)
    this.speechSynth = window.speechSynthesis;
    this.selectedVoice = null;
    this.isSpeaking = false;
    
    this.initVoices();
  }

  init() {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContextClass();
    
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 64;
    this.analyser.smoothingTimeConstant = 0.8;

    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
  }

  initVoices() {
    if (!this.speechSynth) return;
    const updateVoices = () => {
      const voices = this.speechSynth.getVoices();
      // Try to find a Spanish voice (Spain, Mexico, Latin America)
      this.selectedVoice = voices.find(v => v.lang.startsWith('es') || v.lang.includes('ES') || v.lang.includes('MX')) || voices[0];
    };
    updateVoices();
    if (this.speechSynth.onvoiceschanged !== undefined) {
      this.speechSynth.onvoiceschanged = updateVoices;
    }
  }

  setVolume(val) {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
    }
  }

  getFrequencyData() {
    if (!this.analyser) {
      return new Uint8Array(32).fill(0);
    }
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    return data;
  }

  playClickSound(type = 'normal') {
    this.init();
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    if (type === 'power-on') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
      gain.gain.setValueAtTime(0.2 * this.volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    } else if (type === 'power-off') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(660, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.2);
      gain.gain.setValueAtTime(0.2 * this.volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (type === 'volume') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600 + (this.volume * 400), now);
      gain.gain.setValueAtTime(0.15 * this.volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.06);
    } else {
      // Standard button mechanical click
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.04);
      gain.gain.setValueAtTime(0.12 * this.volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.05);
    }
  }

  // Synthesized Beat & Melody generator
  startMusic() {
    this.init();
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    this.isPlaying = true;
    this.step = 0;

    const interval = (60 / this.tempo) / 4 * 1000; // 16th notes
    if (this.timerId) clearInterval(this.timerId);

    const bassScale = [110, 110, 130.81, 146.83, 164.81, 146.83, 130.81, 98];
    const leadScale = [440, 523.25, 587.33, 659.25, 783.99, 880];

    this.timerId = setInterval(() => {
      if (!this.isPlaying || !this.ctx) return;
      const now = this.ctx.currentTime;

      // Kick drum on 1, 5, 9, 13
      if (this.step % 4 === 0) {
        this.triggerKick(now);
      }

      // Snare / Clap on 4, 12
      if (this.step % 8 === 4) {
        this.triggerSnare(now);
      }

      // Hi-hat on every 2 steps
      if (this.step % 2 === 0) {
        this.triggerHiHat(now, this.step % 4 === 2);
      }

      // Synth Bassline
      if (this.step % 2 === 0) {
        const note = bassScale[Math.floor(this.step / 2) % bassScale.length];
        this.triggerBass(note, now);
      }

      // Lead Melody
      if (Math.random() > 0.4) {
        const leadNote = leadScale[Math.floor(Math.random() * leadScale.length)];
        this.triggerLead(leadNote, now);
      }

      this.step = (this.step + 1) % 32;
    }, interval);
  }

  stopMusic() {
    this.isPlaying = false;
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  triggerKick(time) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.frequency.setValueAtTime(140, time);
    osc.frequency.exponentialRampToValueAtTime(35, time + 0.12);
    gain.gain.setValueAtTime(0.8, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(time);
    osc.stop(time + 0.18);
  }

  triggerSnare(time) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, time);
    gain.gain.setValueAtTime(0.35, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(time);
    osc.stop(time + 0.12);
  }

  triggerHiHat(time, accent = false) {
    // Noise simulated with high freq square
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'highpass' in osc ? 'sine' : 'square';
    osc.frequency.setValueAtTime(6000 + (Math.random() * 2000), time);
    gain.gain.setValueAtTime(accent ? 0.2 : 0.08, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(time);
    osc.stop(time + 0.05);
  }

  triggerBass(freq, time) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(0.25, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(time);
    osc.stop(time + 0.18);
  }

  triggerLead(freq, time) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(0.12, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.25);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(time);
    osc.stop(time + 0.25);
  }

  // DJ Livi Speech Quotes in Spanish
  speakLivi(text, callback) {
    if (!this.speechSynth) {
      if (callback) callback();
      return;
    }
    this.speechSynth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    if (this.selectedVoice) {
      utterance.voice = this.selectedVoice;
    }
    utterance.lang = 'es-ES';
    utterance.pitch = 1.05;
    utterance.rate = 1.0;
    utterance.volume = this.volume;

    this.isSpeaking = true;

    utterance.onend = () => {
      this.isSpeaking = false;
      if (callback) callback();
    };

    utterance.onerror = () => {
      this.isSpeaking = false;
      if (callback) callback();
    };

    this.speechSynth.speak(utterance);
  }

  getRandomDJComment() {
    const quotes = [
      "¡Hola! Soy DJ Livi. Aquí tienes una mezcla fresca seleccionada para tu dispositivo ESP32.",
      "Subamos el ritmo con lo mejor de tu biblioteca de Spotify.",
      "Preparé estos sonidos electrónicos ideales para programar y crear.",
      "¡Qué buena vibra! Sintonizando la siguiente pista con la potencia del ESP32."
    ];
    return quotes[Math.floor(Math.random() * quotes.length)];
  }
}

export const audioEngine = new AudioEngine();

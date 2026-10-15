/**
 * Neon Coin Dash - YouTube Playables Game
 * A fast, polished, responsive 2D/2.5D arcade runner built with HTML5 Canvas & Vanilla JS.
 * Fully compliant with YouTube Playables SDK v1 specifications.
 */

(function () {
  'use strict';

  /* ==========================================================================
     1. YOUTUBE PLAYABLES SDK BRIDGE
     Handles official SDK APIs with graceful offline/local development fallback.
     ========================================================================== */
  class PlayablesBridge {
    constructor() {
      this.isAvailable = typeof window.YTPlayables !== 'undefined';
      this.hasSignaledFirstFrame = false;
      this.hasSignaledGameReady = false;
      this.audioEnabled = true;
      this.storageKey = 'neon_coin_dash_save';

      console.log(`[YTPlayables] SDK detected: ${this.isAvailable}`);
    }

    init(onPauseCb, onResumeCb, onAudioChangeCb) {
      if (this.isAvailable) {
        try {
          // Listen to YouTube pause and resume events
          if (typeof window.YTPlayables.onPause === 'function') {
            window.YTPlayables.onPause(() => {
              console.log('[YTPlayables] onPause received');
              if (onPauseCb) onPauseCb();
            });
          }

          if (typeof window.YTPlayables.onResume === 'function') {
            window.YTPlayables.onResume(() => {
              console.log('[YTPlayables] onResume received');
              if (onResumeCb) onResumeCb();
            });
          }

          // Initial audio state from YouTube
          if (typeof window.YTPlayables.isAudioEnabled === 'function') {
            this.audioEnabled = window.YTPlayables.isAudioEnabled();
          }

          // Listen to YouTube audio enable/mute toggles
          if (typeof window.YTPlayables.onAudioEnabledChange === 'function') {
            window.YTPlayables.onAudioEnabledChange((enabled) => {
              console.log(`[YTPlayables] Audio enabled changed: ${enabled}`);
              this.audioEnabled = enabled;
              if (onAudioChangeCb) onAudioChangeCb(enabled);
            });
          }
        } catch (err) {
          console.warn('[YTPlayables] Error initializing SDK listeners:', err);
        }
      } else {
        // Fallback: standard page visibility change for local dev
        document.addEventListener('visibilitychange', () => {
          if (document.hidden) {
            if (onPauseCb) onPauseCb();
          } else {
            if (onResumeCb) onResumeCb();
          }
        });
      }
    }

    firstFrameReady() {
      if (this.hasSignaledFirstFrame) return;
      this.hasSignaledFirstFrame = true;

      if (this.isAvailable && typeof window.YTPlayables.firstFrameReady === 'function') {
        try {
          window.YTPlayables.firstFrameReady();
          console.log('[YTPlayables] firstFrameReady() dispatched successfully');
        } catch (e) {
          console.warn('[YTPlayables] firstFrameReady call failed:', e);
        }
      } else {
        console.log('[DevFallback] firstFrameReady() signaled (local)');
      }
    }

    gameReady() {
      if (this.hasSignaledGameReady) return;
      this.hasSignaledGameReady = true;

      if (this.isAvailable && typeof window.YTPlayables.gameReady === 'function') {
        try {
          window.YTPlayables.gameReady();
          console.log('[YTPlayables] gameReady() dispatched successfully');
        } catch (e) {
          console.warn('[YTPlayables] gameReady call failed:', e);
        }
      } else {
        console.log('[DevFallback] gameReady() signaled (local)');
      }
    }

    sendScore(score) {
      const sanitizedScore = Math.floor(Math.max(0, score || 0));
      console.log(`[YTPlayables] Submitting score: ${sanitizedScore}`);

      if (this.isAvailable && typeof window.YTPlayables.sendScore === 'function') {
        try {
          window.YTPlayables.sendScore({ value: sanitizedScore });
        } catch (e) {
          console.warn('[YTPlayables] sendScore failed:', e);
        }
      }
    }

    async saveData(dataObj) {
      const serialized = JSON.stringify(dataObj);
      if (this.isAvailable && typeof window.YTPlayables.saveData === 'function') {
        try {
          await window.YTPlayables.saveData(serialized);
          return true;
        } catch (e) {
          console.warn('[YTPlayables] saveData error, falling back to local storage:', e);
        }
      }

      try {
        localStorage.setItem(this.storageKey, serialized);
        return true;
      } catch (err) {
        console.warn('LocalStorage save failed:', err);
        return false;
      }
    }

    async loadData() {
      if (this.isAvailable && typeof window.YTPlayables.loadData === 'function') {
        try {
          const data = await window.YTPlayables.loadData();
          if (data) return JSON.parse(data);
        } catch (e) {
          console.warn('[YTPlayables] loadData error, trying local storage fallback:', e);
        }
      }

      try {
        const item = localStorage.getItem(this.storageKey);
        if (item) return JSON.parse(item);
      } catch (err) {
        console.warn('LocalStorage load failed:', err);
      }
      return null;
    }
  }

  /* ==========================================================================
     2. SYNTHESIZED SOUND SYSTEM (Web Audio API)
     Zero external audio files required. Completely self-contained.
     ========================================================================== */
  class SoundManager {
    constructor(bridge) {
      this.bridge = bridge;
      this.ctx = null;
      this.isMuted = false;
      this.isInitialized = false;
      this.masterGain = null;
      this.bgmOsc = null;
      this.bgmGain = null;
      this.bgmStep = 0;
      this.bgmTimer = null;
    }

    init() {
      if (this.isInitialized) return;
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
        this.isInitialized = true;
      } catch (e) {
        console.warn('Web Audio API not supported:', e);
      }
    }

    ensureContext() {
      if (!this.isInitialized) {
        this.init();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    }

    canPlay() {
      return (
        this.isInitialized &&
        this.ctx &&
        !this.isMuted &&
        this.bridge.audioEnabled &&
        this.ctx.state === 'running'
      );
    }

    toggleMute() {
      this.isMuted = !this.isMuted;
      if (this.isMuted) {
        this.stopBgm();
      } else if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return this.isMuted;
    }

    // Play sparkling coin chime with frequency scaling based on combo
    playCoin(combo = 1) {
      if (!this.canPlay()) return;
      const now = this.ctx.currentTime;
      const baseFreq = 880 + Math.min(combo * 90, 800);

      // Tone 1
      const osc1 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(baseFreq, now);
      osc1.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + 0.12);

      gain1.gain.setValueAtTime(0.25, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc1.connect(gain1);
      gain1.connect(this.masterGain);
      osc1.start(now);
      osc1.stop(now + 0.18);

      // Harmonics for a magical crystalline sparkle
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(baseFreq * 2, now + 0.04);
      osc2.frequency.exponentialRampToValueAtTime(baseFreq * 2.5, now + 0.16);

      gain2.gain.setValueAtTime(0.15, now + 0.04);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      osc2.connect(gain2);
      gain2.connect(this.masterGain);
      osc2.start(now + 0.04);
      osc2.stop(now + 0.2);
    }

    // Futuristic cyber whoosh when changing lanes
    playLaneSwitch() {
      if (!this.canPlay()) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(240, now);
      osc.frequency.exponentialRampToValueAtTime(480, now + 0.08);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, now);
      filter.frequency.exponentialRampToValueAtTime(300, now + 0.09);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.1);
    }

    // Heavy neon arcade crash explosion
    playCrash() {
      if (!this.canPlay()) return;
      const now = this.ctx.currentTime;

      // Low frequency sub punch
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(28, now + 0.4);

      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.45);

      // Noise burst for shatter effect
      const bufferSize = this.ctx.sampleRate * 0.25;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(1000, now);
      noiseFilter.frequency.exponentialRampToValueAtTime(200, now + 0.25);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.35, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.masterGain);

      noise.start(now);
      noise.stop(now + 0.25);
    }

    // High energy near-miss beep
    playNearMiss() {
      if (!this.canPlay()) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.exponentialRampToValueAtTime(1600, now + 0.08);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.09);
    }

    // Speed tier up celebration sound
    playSpeedUp() {
      if (!this.canPlay()) return;
      const now = this.ctx.currentTime;
      const notes = [440, 554.37, 659.25, 880];
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const start = now + idx * 0.05;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.18, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.12);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(start);
        osc.stop(start + 0.12);
      });
    }

    // Clean UI button tap
    playClick() {
      if (!this.canPlay()) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.04);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.05);
    }

    // Minimalistic neon synth bass pulse for adrenaline
    startBgm() {
      if (!this.canPlay() || this.bgmTimer) return;
      const bassNotes = [110, 110, 130.81, 146.83, 110, 110, 164.81, 146.83];
      this.bgmStep = 0;

      this.bgmTimer = setInterval(() => {
        if (!this.canPlay()) return;
        const note = bassNotes[this.bgmStep % bassNotes.length];
        this.bgmStep++;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(note, now);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(450, now);
        filter.frequency.exponentialRampToValueAtTime(120, now + 0.18);

        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.2);
      }, 220);
    }

    stopBgm() {
      if (this.bgmTimer) {
        clearInterval(this.bgmTimer);
        this.bgmTimer = null;
      }
    }
  }

  /* ==========================================================================
     3. PARTICLES & VISUAL EFFECTS
     Sparks, trails, explosions, screen shakes, floating text.
     ========================================================================== */
  class ParticleSystem {
    constructor() {
      this.particles = [];
      this.floatingTexts = [];
    }

    // Emit trail behind the glowing player orb
    emitTrail(x, y, radius) {
      if (Math.random() < 0.4) return;
      this.particles.push({
        x: x + (Math.random() - 0.5) * radius * 0.7,
        y: y + (Math.random() - 0.5) * radius * 0.4,
        vx: (Math.random() - 0.5) * 20,
        vy: 50 + Math.random() * 60,
        size: Math.random() * 4 + 2,
        color: '#00f5ff',
        alpha: 0.7,
        decay: 2.2,
      });
    }

    // Gold sparkle burst when collecting a coin
    emitCoinBurst(x, y) {
      const count = 18;
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
        const speed = Math.random() * 180 + 70;
        this.particles.push({
          x: x,
          y: y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: Math.random() * 4.5 + 2,
          color: Math.random() > 0.3 ? '#ffd700' : '#ffffff',
          alpha: 1.0,
          decay: 2.0 + Math.random() * 0.8,
        });
      }
    }

    // Intense crash explosion with red/cyan neon shards
    emitCrashExplosion(x, y) {
      const count = 35;
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 260 + 80;
        this.particles.push({
          x: x,
          y: y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: Math.random() * 6 + 3,
          color: Math.random() > 0.4 ? '#ff0055' : '#00f5ff',
          alpha: 1.0,
          decay: 1.4 + Math.random() * 0.6,
        });
      }
    }

    // Floating score flair popup
    addFloatingText(text, x, y, color = '#ffd700', scale = 1.0) {
      this.floatingTexts.push({
        text,
        x,
        y,
        color,
        scale,
        alpha: 1.0,
        vy: -75,
        life: 0.8,
        maxLife: 0.8,
      });
    }

    update(dt) {
      // Update particles
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.alpha -= p.decay * dt;
        if (p.alpha <= 0) {
          this.particles.splice(i, 1);
        }
      }

      // Update floating texts
      for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
        const ft = this.floatingTexts[i];
        ft.y += ft.vy * dt;
        ft.life -= dt;
        ft.alpha = Math.max(0, ft.life / ft.maxLife);
        if (ft.life <= 0) {
          this.floatingTexts.splice(i, 1);
        }
      }
    }

    draw(ctx) {
      // Draw particles
      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Draw floating score texts
      for (let i = 0; i < this.floatingTexts.length; i++) {
        const ft = this.floatingTexts[i];
        ctx.save();
        ctx.globalAlpha = ft.alpha;
        ctx.font = `bold ${Math.round(20 * ft.scale)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = ft.color;
        ctx.shadowColor = ft.color;
        ctx.shadowBlur = 10;
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.restore();
      }
    }

    reset() {
      this.particles = [];
      this.floatingTexts = [];
    }
  }

  /* ==========================================================================
     4. GAME ENGINE & STATE MANAGEMENT
     ========================================================================== */
  const GameState = {
    MENU: 'MENU',
    PLAYING: 'PLAYING',
    PAUSED: 'PAUSED',
    GAMEOVER: 'GAMEOVER',
  };

  class NeonCoinDash {
    constructor() {
      this.canvas = document.getElementById('gameCanvas');
      this.ctx = this.canvas.getContext('2d');
      this.btnLeft = document.getElementById('btn-left');
      this.btnRight = document.getElementById('btn-right');

      this.bridge = new PlayablesBridge();
      this.sound = new SoundManager(this.bridge);
      this.particles = new ParticleSystem();

      // Viewport & Scale setup
      this.width = 720;
      this.height = 1280;
      this.dpr = 1;

      // Track layout
      this.trackWidth = 440;
      this.trackLeft = 0;
      this.trackRight = 0;
      this.laneCenters = [0, 0, 0]; // Lanes: 0=Left, 1=Center, 2=Right
      this.playerLane = 1;
      this.targetPlayerX = 0;
      this.playerX = 0;
      this.playerY = 0;
      this.playerRadius = 26;
      this.playerBank = 0; // Dynamic tilt when lane switching

      // Progression & Scoring
      this.state = GameState.MENU;
      this.score = 0;
      this.coinsCollected = 0;
      this.bestScore = 0;
      this.combo = 0;
      this.multiplier = 1;
      this.streakTimer = 0;
      this.isNewHighScore = false;

      // Dynamic Speed & Spawning
      this.baseSpeed = 420;
      this.currentSpeed = this.baseSpeed;
      this.maxSpeed = 920;
      this.gameTime = 0;
      this.spawnTimer = 0;
      this.waveCounter = 0;

      // Game Entities
      this.entities = []; // Coins & Obstacles
      this.stars = []; // Parallax background stars
      this.gridOffset = 0;

      // Camera Shake
      this.shakeDuration = 0;
      this.shakeIntensity = 0;

      // Interactive UI hitboxes
      this.uiButtons = {
        play: { x: 0, y: 0, w: 0, h: 0 },
        retry: { x: 0, y: 0, w: 0, h: 0 },
        pause: { x: 0, y: 0, w: 0, h: 0 },
        mute: { x: 0, y: 0, w: 0, h: 0 },
      };

      // Input tracking
      this.touchStartX = 0;
      this.touchStartY = 0;
      this.touchStartTime = 0;

      // Time accumulator
      this.lastTime = performance.now();

      this.init();
    }

    async init() {
      // 1. Setup Canvas and responsiveness
      this.resizeCanvas();
      window.addEventListener('resize', () => this.resizeCanvas());
      window.addEventListener('orientationchange', () => {
        setTimeout(() => this.resizeCanvas(), 100);
      });

      // 2. Setup background starfield
      this.initStarfield();

      // 3. Setup SDK events
      this.bridge.init(
        () => this.handlePauseTrigger(),
        () => this.handleResumeTrigger(),
        (enabled) => this.handleAudioEnabledChange(enabled)
      );

      // 4. Setup Input event handlers
      this.bindInputs();

      // 5. Load saved data (best score)
      const saved = await this.bridge.loadData();
      if (saved && typeof saved.bestScore === 'number') {
        this.bestScore = saved.bestScore;
      }

      // 6. Signal that the game is fully loaded, interactive, and ready
      this.bridge.gameReady();

      // 7. Start main game animation loop
      requestAnimationFrame((t) => this.loop(t));
    }

    initStarfield() {
      this.stars = [];
      const count = 55;
      for (let i = 0; i < count; i++) {
        this.stars.push({
          x: Math.random() * this.width,
          y: Math.random() * this.height,
          radius: Math.random() * 1.6 + 0.6,
          speed: Math.random() * 50 + 25,
          alpha: Math.random() * 0.7 + 0.3,
        });
      }
    }

    resizeCanvas() {
      const container = document.getElementById('game-container');
      const winW = container.clientWidth || window.innerWidth;
      const winH = container.clientHeight || window.innerHeight;

      this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);

      this.width = winW;
      this.height = winH;

      this.canvas.width = Math.round(this.width * this.dpr);
      this.canvas.height = Math.round(this.height * this.dpr);

      // Recalculate track geometry dynamically to fit any aspect ratio
      const isLandscape = this.width > this.height;
      if (isLandscape) {
        this.trackWidth = Math.min(this.width * 0.48, 520);
      } else {
        this.trackWidth = Math.min(this.width * 0.88, 480);
      }

      this.trackLeft = (this.width - this.trackWidth) / 2;
      this.trackRight = this.trackLeft + this.trackWidth;

      const laneW = this.trackWidth / 3;
      this.laneCenters = [
        this.trackLeft + laneW * 0.5,
        this.trackLeft + laneW * 1.5,
        this.trackLeft + laneW * 2.5,
      ];

      this.playerY = this.height * 0.78;
      this.playerRadius = Math.max(18, Math.min(30, laneW * 0.22));

      // Re-anchor player X based on current lane
      this.targetPlayerX = this.laneCenters[this.playerLane];
      if (this.playerX === 0) {
        this.playerX = this.targetPlayerX;
      }

      // Update UI button coordinates for responsive clicks
      this.updateUIButtonLayout();
    }

    updateUIButtonLayout() {
      const size = 44;
      const margin = 20;

      // Top Right: Sound Mute Button
      this.uiButtons.mute = {
        x: this.width - margin - size,
        y: margin,
        w: size,
        h: size,
      };

      // Top Right adjacent: Pause Button
      this.uiButtons.pause = {
        x: this.width - margin * 2 - size * 2,
        y: margin,
        w: size,
        h: size,
      };

      // Center Start/Play Button on Menu
      const playW = Math.min(260, this.width * 0.7);
      const playH = 64;
      this.uiButtons.play = {
        x: (this.width - playW) / 2,
        y: this.height * 0.72,
        w: playW,
        h: playH,
      };

      // Center Retry Button on Game Over
      this.uiButtons.retry = {
        x: (this.width - playW) / 2,
        y: this.height * 0.72,
        w: playW,
        h: playH,
      };
    }

    bindInputs() {
      // 1. Keyboard Controls
      window.addEventListener('keydown', (e) => {
        this.sound.ensureContext();

        if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
          e.preventDefault();
          this.movePlayer(-1);
        } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
          e.preventDefault();
          this.movePlayer(1);
        } else if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault();
          if (this.state === GameState.MENU) {
            this.startGame();
          } else if (this.state === GameState.GAMEOVER) {
            this.restartGame();
          } else if (this.state === GameState.PAUSED) {
            this.resumeGame();
          }
        } else if (e.code === 'Escape' || e.code === 'KeyP') {
          e.preventDefault();
          if (this.state === GameState.PLAYING) {
            this.pauseGame();
          } else if (this.state === GameState.PAUSED) {
            this.resumeGame();
          }
        } else if (e.code === 'KeyM') {
          e.preventDefault();
          this.sound.toggleMute();
        }
      });

      // 2. Touch Controls via Canvas Tap / Swipe
      this.canvas.addEventListener(
        'touchstart',
        (e) => {
          this.sound.ensureContext();
          if (e.touches.length > 0) {
            const touch = e.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            this.touchStartX = touch.clientX - rect.left;
            this.touchStartY = touch.clientY - rect.top;
            this.touchStartTime = performance.now();
          }
        },
        { passive: true }
      );

      this.canvas.addEventListener(
        'touchend',
        (e) => {
          if (e.changedTouches.length > 0) {
            const touch = e.changedTouches[0];
            const rect = this.canvas.getBoundingClientRect();
            const endX = touch.clientX - rect.left;
            const endY = touch.clientY - rect.top;

            const dx = endX - this.touchStartX;
            const dy = endY - this.touchStartY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const duration = performance.now() - this.touchStartTime;

            // Check if user clicked a UI button
            if (this.handleUIClick(endX, endY)) {
              return;
            }

            // Swipe detection (quick horizontal flick)
            if (dist > 35 && duration < 350 && Math.abs(dx) > Math.abs(dy)) {
              if (dx < 0) {
                this.movePlayer(-1);
              } else {
                this.movePlayer(1);
              }
              return;
            }

            // Tap detection
            this.handleTapInteraction(endX, endY);
          }
        },
        { passive: true }
      );

      // 3. Mouse Click Handling
      this.canvas.addEventListener('click', (e) => {
        this.sound.ensureContext();
        const rect = this.canvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        if (this.handleUIClick(clickX, clickY)) {
          return;
        }

        this.handleTapInteraction(clickX, clickY);
      });

      // 4. On-screen accessible touch buttons (bottom-left / bottom-right)
      if (this.btnLeft) {
        this.btnLeft.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          this.sound.ensureContext();
          this.movePlayer(-1);
        });
      }
      if (this.btnRight) {
        this.btnRight.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          this.sound.ensureContext();
          this.movePlayer(1);
        });
      }
    }

    handleUIClick(x, y) {
      // Check Mute button
      const m = this.uiButtons.mute;
      if (x >= m.x && x <= m.x + m.w && y >= m.y && y <= m.y + m.h) {
        this.sound.playClick();
        this.sound.toggleMute();
        return true;
      }

      // Check Pause button (in gameplay or pause state)
      const p = this.uiButtons.pause;
      if (
        (this.state === GameState.PLAYING || this.state === GameState.PAUSED) &&
        x >= p.x &&
        x <= p.x + p.w &&
        y >= p.y &&
        y <= p.y + p.h
      ) {
        this.sound.playClick();
        if (this.state === GameState.PLAYING) {
          this.pauseGame();
        } else {
          this.resumeGame();
        }
        return true;
      }

      // Check Menu Play Button
      if (this.state === GameState.MENU) {
        const btn = this.uiButtons.play;
        if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
          this.sound.playClick();
          this.startGame();
          return true;
        }
      }

      // Check Game Over Retry Button
      if (this.state === GameState.GAMEOVER) {
        const btn = this.uiButtons.retry;
        if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
          this.sound.playClick();
          this.restartGame();
          return true;
        }
      }

      return false;
    }

    handleTapInteraction(x, y) {
      if (this.state === GameState.MENU) {
        this.startGame();
        return;
      }

      if (this.state === GameState.GAMEOVER) {
        this.restartGame();
        return;
      }

      if (this.state === GameState.PAUSED) {
        this.resumeGame();
        return;
      }

      if (this.state === GameState.PLAYING) {
        // Direct lane tap or left/right half screen tap
        if (x < this.trackLeft + this.trackWidth / 3) {
          this.setLane(0);
        } else if (x > this.trackRight - this.trackWidth / 3) {
          this.setLane(2);
        } else if (x >= this.trackLeft && x <= this.trackRight) {
          this.setLane(1);
        } else {
          // Off track: left side moves left, right side moves right
          if (x < this.width / 2) {
            this.movePlayer(-1);
          } else {
            this.movePlayer(1);
          }
        }
      }
    }

    movePlayer(direction) {
      if (this.state !== GameState.PLAYING) return;
      const targetLane = Math.max(0, Math.min(2, this.playerLane + direction));
      if (targetLane !== this.playerLane) {
        this.playerLane = targetLane;
        this.targetPlayerX = this.laneCenters[this.playerLane];
        this.playerBank = direction * 0.45; // Bank tilt
        this.sound.playLaneSwitch();
      }
    }

    setLane(targetLane) {
      if (this.state !== GameState.PLAYING) return;
      if (targetLane >= 0 && targetLane <= 2 && targetLane !== this.playerLane) {
        const dir = targetLane > this.playerLane ? 1 : -1;
        this.playerLane = targetLane;
        this.targetPlayerX = this.laneCenters[this.playerLane];
        this.playerBank = dir * 0.45;
        this.sound.playLaneSwitch();
      }
    }

    startGame() {
      this.sound.ensureContext();
      this.sound.startBgm();

      this.score = 0;
      this.coinsCollected = 0;
      this.combo = 0;
      this.multiplier = 1;
      this.streakTimer = 0;
      this.isNewHighScore = false;

      this.currentSpeed = this.baseSpeed;
      this.gameTime = 0;
      this.spawnTimer = 0;
      this.waveCounter = 0;

      this.playerLane = 1;
      this.targetPlayerX = this.laneCenters[1];
      this.playerX = this.targetPlayerX;

      this.entities = [];
      this.particles.reset();

      this.state = GameState.PLAYING;

      // FIRST 10 SECONDS HOOK:
      // Immediately spawn 3 consecutive gold coins in the center lane!
      // This gives the player instant gratification within 1.5 - 3 seconds.
      const startDist = -180;
      for (let i = 0; i < 3; i++) {
        this.entities.push({
          type: 'coin',
          lane: 1,
          x: this.laneCenters[1],
          y: startDist - i * 160,
          radius: 18,
          rotation: Math.random() * Math.PI,
          collected: false,
        });
      }

      // Add welcoming floating prompt
      this.particles.addFloatingText('DASH!', this.laneCenters[1], this.playerY - 60, '#00f5ff', 1.4);
    }

    restartGame() {
      this.startGame();
    }

    pauseGame() {
      if (this.state === GameState.PLAYING) {
        this.state = GameState.PAUSED;
        this.sound.stopBgm();
      }
    }

    resumeGame() {
      if (this.state === GameState.PAUSED) {
        this.state = GameState.PLAYING;
        this.sound.startBgm();
        this.lastTime = performance.now();
      }
    }

    handlePauseTrigger() {
      this.pauseGame();
    }

    handleResumeTrigger() {
      // YouTube resumed: game transitions to paused state so player can tap when ready
      if (this.state === GameState.PLAYING) {
        this.state = GameState.PAUSED;
      }
    }

    handleAudioEnabledChange(enabled) {
      if (!enabled) {
        this.sound.stopBgm();
      } else if (this.state === GameState.PLAYING) {
        this.sound.startBgm();
      }
    }

    triggerShake(duration = 0.35, intensity = 14) {
      this.shakeDuration = duration;
      this.shakeIntensity = intensity;
    }

    gameOver() {
      this.state = GameState.GAMEOVER;
      this.sound.stopBgm();
      this.sound.playCrash();
      this.triggerShake(0.5, 20);

      // Shatter explosion
      this.particles.emitCrashExplosion(this.playerX, this.playerY);

      // Check high score
      if (this.score > this.bestScore) {
        this.bestScore = this.score;
        this.isNewHighScore = true;
        this.bridge.saveData({
          bestScore: this.bestScore,
          totalCoins: (this.coinsCollected || 0),
          updatedAt: Date.now(),
        });
      }

      // Send score to YouTube Playables
      this.bridge.sendScore(this.score);
    }

    /* ==========================================================================
       SPAWNING & PROGRESSION ENGINE
       ========================================================================== */
    updateSpawning(dt) {
      this.spawnTimer += dt;
      this.gameTime += dt;

      // Smooth gradual speed ramp over time
      const speedGrowth = Math.min(1.0, this.gameTime / 90);
      this.currentSpeed = this.baseSpeed + (this.maxSpeed - this.baseSpeed) * speedGrowth;

      // Dynamic spawn intervals that adapt to current speed
      const spawnInterval = Math.max(0.65, 1.45 - speedGrowth * 0.6);

      if (this.spawnTimer >= spawnInterval) {
        this.spawnTimer = 0;
        this.waveCounter++;
        this.spawnPatternWave();
      }
    }

    spawnPatternWave() {
      const lanes = [0, 1, 2];
      const coinProb = 0.55;

      // Early game tuning: safe, fun, and fast
      if (this.waveCounter === 1) {
        // Wave 1: First obstacle on Left lane, Coin on Right lane
        this.spawnObstacle(0);
        this.spawnCoin(2);
        return;
      }

      if (this.waveCounter === 2) {
        // Wave 2: Double coin lane
        this.spawnCoin(0);
        this.spawnCoin(1);
        return;
      }

      // Fair Obstacle Spawning: NEVER block all 3 lanes simultaneously!
      // Max 1 or 2 obstacles per wave, guaranteeing at least one safe escape route
      const obstacleCount = (Math.random() < 0.45 && this.gameTime > 12) ? 2 : 1;
      const shuffledLanes = [...lanes].sort(() => Math.random() - 0.5);

      for (let i = 0; i < obstacleCount; i++) {
        const lane = shuffledLanes[i];
        this.spawnObstacle(lane);
      }

      // Spawn coins in the remaining open lanes
      for (let i = obstacleCount; i < shuffledLanes.length; i++) {
        const lane = shuffledLanes[i];
        if (Math.random() < coinProb) {
          this.spawnCoin(lane);
        }
      }
    }

    spawnObstacle(lane) {
      this.entities.push({
        type: 'obstacle',
        lane: lane,
        x: this.laneCenters[lane],
        y: -120,
        radius: 24,
        pulse: 0,
        scoredNearMiss: false,
      });
    }

    spawnCoin(lane) {
      this.entities.push({
        type: 'coin',
        lane: lane,
        x: this.laneCenters[lane],
        y: -120,
        radius: 18,
        rotation: Math.random() * Math.PI,
        collected: false,
      });
    }

    /* ==========================================================================
       MAIN LOOP & UPDATES
       ========================================================================== */
    loop(timestamp) {
      const dt = Math.min((timestamp - this.lastTime) / 1000, 0.1);
      this.lastTime = timestamp;

      this.update(dt);
      this.render();

      // Official YouTube Playables Requirement:
      // Signal firstFrameReady() as soon as the first frame is rendered on canvas.
      if (!this.bridge.hasSignaledFirstFrame) {
        this.bridge.firstFrameReady();
      }

      requestAnimationFrame((t) => this.loop(t));
    }

    update(dt) {
      // Starfield background parallax
      for (let i = 0; i < this.stars.length; i++) {
        const star = this.stars[i];
        star.y += (star.speed + (this.state === GameState.PLAYING ? this.currentSpeed * 0.25 : 20)) * dt;
        if (star.y > this.height) {
          star.y = -10;
          star.x = Math.random() * this.width;
        }
      }

      // Update Screen Shake
      if (this.shakeDuration > 0) {
        this.shakeDuration -= dt;
      }

      // Update Particles
      this.particles.update(dt);

      if (this.state !== GameState.PLAYING) {
        return;
      }

      // Grid scrolling
      this.gridOffset = (this.gridOffset + this.currentSpeed * dt) % 60;

      // Player Smooth Lane Interpolation (Lerp with dampening)
      const lerpSpeed = 16.0;
      this.playerX += (this.targetPlayerX - this.playerX) * Math.min(1.0, dt * lerpSpeed);
      this.playerBank += (0 - this.playerBank) * Math.min(1.0, dt * 10.0);

      // Emit player neon trail
      this.particles.emitTrail(this.playerX, this.playerY + this.playerRadius * 0.8, this.playerRadius);

      // Update combo timer
      if (this.combo > 0) {
        this.streakTimer -= dt;
        if (this.streakTimer <= 0) {
          this.combo = 0;
          this.multiplier = 1;
        }
      }

      // Spawning
      this.updateSpawning(dt);

      // Passive score over distance
      this.score += Math.round(this.currentSpeed * dt * 0.1);

      // Update & check collisions for all entities
      for (let i = this.entities.length - 1; i >= 0; i--) {
        const ent = this.entities[i];
        ent.y += this.currentSpeed * dt;

        // Keep entity X synchronized with lane center
        ent.x = this.laneCenters[ent.lane];

        // Entity-specific animation updates
        if (ent.type === 'coin') {
          ent.rotation += dt * 4.0;
        } else if (ent.type === 'obstacle') {
          ent.pulse = (ent.pulse + dt * 6.0) % (Math.PI * 2);
        }

        // Collision Check with Player
        const dx = ent.x - this.playerX;
        const dy = ent.y - this.playerY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const hitDistance = ent.radius + this.playerRadius - 6;

        if (dist < hitDistance) {
          if (ent.type === 'coin' && !ent.collected) {
            ent.collected = true;
            this.collectCoin(ent);
            this.entities.splice(i, 1);
            continue;
          } else if (ent.type === 'obstacle') {
            this.gameOver();
            return;
          }
        }

        // Near-Miss Reward: Player dodged past an obstacle in an adjacent lane closely!
        if (ent.type === 'obstacle' && !ent.scoredNearMiss && ent.y > this.playerY && ent.y < this.playerY + 40) {
          const laneDiff = Math.abs(ent.lane - this.playerLane);
          if (laneDiff === 1) {
            ent.scoredNearMiss = true;
            this.score += 50;
            this.sound.playNearMiss();
            this.particles.addFloatingText('NEAR MISS! +50', ent.x, ent.y, '#00f5ff', 0.9);
          }
        }

        // Remove off-screen entities
        if (ent.y > this.height + 100) {
          this.entities.splice(i, 1);
        }
      }
    }

    collectCoin(coin) {
      this.coinsCollected++;
      this.combo++;
      this.streakTimer = 2.4; // 2.4 seconds to collect the next coin to keep streak
      this.multiplier = Math.min(5, 1 + Math.floor(this.combo / 3));

      const points = 100 * this.multiplier;
      this.score += points;

      this.sound.playCoin(this.combo);
      this.particles.emitCoinBurst(coin.x, coin.y);

      const text = this.multiplier > 1 ? `+${points} (x${this.multiplier})` : `+${points}`;
      this.particles.addFloatingText(text, coin.x, coin.y - 15, '#ffd700', 1.0 + (this.multiplier - 1) * 0.15);

      // Milestone speed pulse
      if (this.coinsCollected % 20 === 0) {
        this.sound.playSpeedUp();
        this.particles.addFloatingText('SPEED UP!', this.width / 2, this.height * 0.4, '#00f5ff', 1.5);
      }
    }

    /* ==========================================================================
       RENDERER & GRAPHICS (Canvas Only, No External Assets)
       ========================================================================== */
    render() {
      const ctx = this.ctx;

      // Handle DevicePixelRatio scaling
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

      // Apply Trauma Screen Shake
      if (this.shakeDuration > 0) {
        const shakeX = (Math.random() * 2 - 1) * this.shakeIntensity;
        const shakeY = (Math.random() * 2 - 1) * this.shakeIntensity;
        ctx.translate(shakeX, shakeY);
      }

      // 1. Dark Navy Deep Space Backdrop
      ctx.fillStyle = '#050814';
      ctx.fillRect(0, 0, this.width, this.height);

      // Radial neon dusk glow at the horizon
      const horizonY = this.height * 0.12;
      const grad = ctx.createRadialGradient(
        this.width / 2,
        horizonY + 60,
        10,
        this.width / 2,
        horizonY + 60,
        this.width * 0.7
      );
      grad.addColorStop(0, 'rgba(121, 40, 202, 0.25)');
      grad.addColorStop(0.5, 'rgba(0, 245, 255, 0.1)');
      grad.addColorStop(1, 'rgba(5, 8, 20, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, this.width, this.height);

      // 2. Parallax Starfield
      this.renderStarfield(ctx);

      // 3. Neon Cyber Track & Perspective Grid
      this.renderTrack(ctx, horizonY);

      // 4. Entities (Coins & Red Obstacles)
      this.renderEntities(ctx);

      // 5. Player Glowing Orb
      if (this.state === GameState.PLAYING || this.state === GameState.PAUSED) {
        this.renderPlayer(ctx);
      }

      // 6. Particle Layer
      this.particles.draw(ctx);

      // 7. HUD & Screen Overlays
      this.renderHUD(ctx);

      if (this.state === GameState.MENU) {
        this.renderMenuScreen(ctx);
      } else if (this.state === GameState.PAUSED) {
        this.renderPauseScreen(ctx);
      } else if (this.state === GameState.GAMEOVER) {
        this.renderGameOverScreen(ctx);
      }
    }

    renderStarfield(ctx) {
      for (let i = 0; i < this.stars.length; i++) {
        const s = this.stars[i];
        ctx.fillStyle = `rgba(255, 255, 255, ${s.alpha})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    renderTrack(ctx, horizonY) {
      const topW = this.trackWidth * 0.35;
      const topL = (this.width - topW) / 2;
      const topR = topL + topW;

      const botL = this.trackLeft;
      const botR = this.trackRight;
      const botY = this.height + 40;

      // Track roadbed gradient fill
      const roadGrad = ctx.createLinearGradient(0, horizonY, 0, this.height);
      roadGrad.addColorStop(0, 'rgba(12, 20, 50, 0.2)');
      roadGrad.addColorStop(0.8, 'rgba(10, 24, 60, 0.7)');
      roadGrad.addColorStop(1, 'rgba(14, 32, 75, 0.9)');

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(topL, horizonY);
      ctx.lineTo(topR, horizonY);
      ctx.lineTo(botR, botY);
      ctx.lineTo(botL, botY);
      ctx.closePath();
      ctx.fillStyle = roadGrad;
      ctx.fill();

      // Outer Glowing Borders
      ctx.strokeStyle = '#00f5ff';
      ctx.shadowColor = '#00f5ff';
      ctx.shadowBlur = 14;
      ctx.lineWidth = 3;

      // Left border
      ctx.beginPath();
      ctx.moveTo(topL, horizonY);
      ctx.lineTo(botL, botY);
      ctx.stroke();

      // Right border
      ctx.beginPath();
      ctx.moveTo(topR, horizonY);
      ctx.lineTo(botR, botY);
      ctx.stroke();

      // Moving Horizontal Grid Lines (Perspective Illusion)
      ctx.shadowBlur = 4;
      ctx.strokeStyle = 'rgba(0, 245, 255, 0.2)';
      ctx.lineWidth = 1.5;

      const numGrid = 16;
      for (let i = 0; i < numGrid; i++) {
        const progress = ((i * (60 / numGrid) + (this.gridOffset % (60 / numGrid))) / 60);
        const p2 = Math.pow(progress, 2.2); // Exponential spacing for 3D depth
        const curY = horizonY + (botY - horizonY) * p2;
        const curL = topL + (botL - topL) * p2;
        const curR = topR + (botR - topR) * p2;

        ctx.beginPath();
        ctx.moveTo(curL, curY);
        ctx.lineTo(curR, curY);
        ctx.stroke();
      }

      // Glowing Lane Dividers
      ctx.setLineDash([16, 20]);
      ctx.lineDashOffset = -this.gridOffset * 1.5;
      ctx.strokeStyle = 'rgba(0, 245, 255, 0.4)';
      ctx.lineWidth = 2;
      ctx.shadowBlur = 6;

      const laneW = this.trackWidth / 3;
      const topLaneW = topW / 3;

      // Divider 1 (between Lane 0 and 1)
      ctx.beginPath();
      ctx.moveTo(topL + topLaneW, horizonY);
      ctx.lineTo(botL + laneW, botY);
      ctx.stroke();

      // Divider 2 (between Lane 1 and 2)
      ctx.beginPath();
      ctx.moveTo(topL + topLaneW * 2, horizonY);
      ctx.lineTo(botL + laneW * 2, botY);
      ctx.stroke();

      ctx.restore();
    }

    renderEntities(ctx) {
      for (let i = 0; i < this.entities.length; i++) {
        const ent = this.entities[i];
        if (ent.y < -50 || ent.y > this.height + 50) continue;

        if (ent.type === 'coin') {
          this.renderCoin(ctx, ent);
        } else if (ent.type === 'obstacle') {
          this.renderObstacle(ctx, ent);
        }
      }
    }

    renderCoin(ctx, coin) {
      ctx.save();
      ctx.translate(coin.x, coin.y);

      // Dynamic 3D spinning coin width
      const scaleX = Math.abs(Math.cos(coin.rotation));
      ctx.scale(Math.max(0.18, scaleX), 1.0);

      // Golden Halo Glow
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 15;

      // Outer Coin Edge
      ctx.beginPath();
      ctx.arc(0, 0, coin.radius, 0, Math.PI * 2);
      ctx.fillStyle = '#ffaa00';
      ctx.fill();

      // Inner Coin Body
      ctx.beginPath();
      ctx.arc(0, 0, coin.radius * 0.85, 0, Math.PI * 2);
      const coinGrad = ctx.createLinearGradient(-coin.radius, -coin.radius, coin.radius, coin.radius);
      coinGrad.addColorStop(0, '#fff490');
      coinGrad.addColorStop(0.5, '#ffd700');
      coinGrad.addColorStop(1, '#ff9900');
      ctx.fillStyle = coinGrad;
      ctx.fill();

      // Center Diamond / Star Emblem
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.beginPath();
      const r = coin.radius * 0.45;
      ctx.moveTo(0, -r);
      ctx.lineTo(r * 0.6, 0);
      ctx.lineTo(0, r);
      ctx.lineTo(-r * 0.6, 0);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }

    renderObstacle(ctx, obs) {
      ctx.save();
      ctx.translate(obs.x, obs.y);

      // Pulsing crimson hazard aura
      const pulseSize = Math.sin(obs.pulse) * 4;
      const totalR = obs.radius + pulseSize;

      ctx.shadowColor = '#ff0055';
      ctx.shadowBlur = 18;

      // Danger Warning Triangle / Diamond Hazard Spike
      ctx.fillStyle = '#ff0055';
      ctx.beginPath();
      ctx.moveTo(0, -totalR);
      ctx.lineTo(totalR * 0.9, totalR * 0.8);
      ctx.lineTo(-totalR * 0.9, totalR * 0.8);
      ctx.closePath();
      ctx.fill();

      // Inner Dark Core with Danger Cross
      ctx.fillStyle = '#2a0510';
      ctx.beginPath();
      const innerR = totalR * 0.6;
      ctx.moveTo(0, -innerR);
      ctx.lineTo(innerR * 0.85, innerR * 0.75);
      ctx.lineTo(-innerR * 0.85, innerR * 0.75);
      ctx.closePath();
      ctx.fill();

      // Neon glowing exclamation mark or warning stripe
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.rect(-2.5, -innerR * 0.3, 5, innerR * 0.6);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, innerR * 0.5, 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    renderPlayer(ctx) {
      ctx.save();
      ctx.translate(this.playerX, this.playerY);

      // Dynamic banking tilt when changing lanes
      ctx.rotate(this.playerBank);

      const r = this.playerRadius;

      // 1. Intense Cyan Outer Glow
      ctx.shadowColor = '#00f5ff';
      ctx.shadowBlur = 24;

      // 2. Shield Ring
      ctx.strokeStyle = 'rgba(0, 245, 255, 0.7)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, r + 4, 0, Math.PI * 2);
      ctx.stroke();

      // 3. Glowing Orb Core Gradient
      const orbGrad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
      orbGrad.addColorStop(0, '#ffffff');
      orbGrad.addColorStop(0.3, '#70f9ff');
      orbGrad.addColorStop(0.8, '#00f5ff');
      orbGrad.addColorStop(1, '#0083a3');

      ctx.fillStyle = orbGrad;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();

      // 4. Center High-Tech Energy Ring
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    }

    /* ==========================================================================
       UI SCREENS & OVERLAYS
       ========================================================================== */
    renderHUD(ctx) {
      // 1. Top HUD Bar: Score and Coins
      ctx.save();
      ctx.font = 'bold 22px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0, 245, 255, 0.6)';
      ctx.shadowBlur = 8;
      ctx.textAlign = 'left';

      // Score
      ctx.fillText(`${this.score}`, 22, 42);

      // Mini Coin Icon + Count
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(28, 72, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '16px sans-serif';
      ctx.fillText(`${this.coinsCollected}`, 44, 78);

      // Multiplier Badge (if combo active)
      if (this.combo > 1 && this.state === GameState.PLAYING) {
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 16px sans-serif';
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 10;
        ctx.fillText(`x${this.multiplier} COMBO (${this.combo})`, 22, 104);
      }

      // Best Score indicator (top center)
      ctx.textAlign = 'center';
      ctx.font = '13px sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fillText(`BEST: ${Math.max(this.score, this.bestScore)}`, this.width / 2, 38);

      // 2. Sound Mute Button (Top Right)
      const m = this.uiButtons.mute;
      ctx.fillStyle = 'rgba(8, 18, 45, 0.7)';
      ctx.strokeStyle = 'rgba(0, 245, 255, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(m.x + m.w / 2, m.y + m.h / 2, m.w / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Sound Icon
      ctx.fillStyle = '#00f5ff';
      ctx.textAlign = 'center';
      ctx.font = '18px sans-serif';
      const soundText = (!this.sound.isMuted && this.bridge.audioEnabled) ? '🔊' : '🔇';
      ctx.fillText(soundText, m.x + m.w / 2, m.y + m.h / 2 + 6);

      // 3. Pause Button (Top Right adjacent)
      if (this.state === GameState.PLAYING || this.state === GameState.PAUSED) {
        const p = this.uiButtons.pause;
        ctx.fillStyle = 'rgba(8, 18, 45, 0.7)';
        ctx.strokeStyle = 'rgba(0, 245, 255, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(p.x + p.w / 2, p.y + p.h / 2, p.w / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#00f5ff';
        ctx.font = '16px sans-serif';
        const pauseText = this.state === GameState.PAUSED ? '▶' : '❚❚';
        ctx.fillText(pauseText, p.x + p.w / 2, p.y + p.h / 2 + 5);
      }

      ctx.restore();
    }

    renderMenuScreen(ctx) {
      // Backdrop vignette
      ctx.save();
      ctx.fillStyle = 'rgba(5, 8, 20, 0.75)';
      ctx.fillRect(0, 0, this.width, this.height);

      // Neon Game Title
      const titleY = this.height * 0.28;
      ctx.textAlign = 'center';

      // Title Glow
      ctx.shadowColor = '#00f5ff';
      ctx.shadowBlur = 24;
      ctx.fillStyle = '#00f5ff';
      ctx.font = '900 42px sans-serif';
      ctx.fillText('NEON COIN', this.width / 2, titleY);

      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 24;
      ctx.fillStyle = '#ffd700';
      ctx.font = '900 46px sans-serif';
      ctx.fillText('DASH', this.width / 2, titleY + 50);

      // Subtitle
      ctx.shadowBlur = 8;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.font = '15px sans-serif';
      ctx.fillText('FAST ARCADER FOR YOUTUBE PLAYABLES', this.width / 2, titleY + 92);

      // Tutorial Guide Card
      const cardY = this.height * 0.47;
      const cardW = Math.min(320, this.width * 0.84);
      const cardH = 110;
      const cardX = (this.width - cardW) / 2;

      ctx.fillStyle = 'rgba(12, 24, 60, 0.8)';
      ctx.strokeStyle = 'rgba(0, 245, 255, 0.4)';
      ctx.lineWidth = 1.5;
      this.drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 12);
      ctx.fill();
      ctx.stroke();

      ctx.font = '14px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.fillText('◀  ▶  Swipe / Tap / Arrow keys to switch lanes', cardX + 20, cardY + 34);
      ctx.fillText('🟡  Collect gold coins for combo multipliers', cardX + 20, cardY + 64);
      ctx.fillText('🔺  Dodge red hazard spikes to survive', cardX + 20, cardY + 94);

      // Best Score Display
      if (this.bestScore > 0) {
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText(`🏆 BEST SCORE: ${this.bestScore}`, this.width / 2, cardY + cardH + 34);
      }

      // Neon Start Button
      const btn = this.uiButtons.play;
      ctx.shadowColor = '#00f5ff';
      ctx.shadowBlur = 18;
      ctx.fillStyle = 'rgba(0, 245, 255, 0.2)';
      ctx.strokeStyle = '#00f5ff';
      ctx.lineWidth = 2.5;
      this.drawRoundedRect(ctx, btn.x, btn.y, btn.w, btn.h, 32);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PLAY NOW', btn.x + btn.w / 2, btn.y + btn.h / 2 + 7);

      ctx.restore();
    }

    renderPauseScreen(ctx) {
      ctx.save();
      ctx.fillStyle = 'rgba(5, 8, 20, 0.8)';
      ctx.fillRect(0, 0, this.width, this.height);

      ctx.textAlign = 'center';
      ctx.shadowColor = '#00f5ff';
      ctx.shadowBlur = 20;
      ctx.fillStyle = '#00f5ff';
      ctx.font = '900 38px sans-serif';
      ctx.fillText('GAME PAUSED', this.width / 2, this.height * 0.42);

      ctx.shadowBlur = 8;
      ctx.fillStyle = '#ffffff';
      ctx.font = '17px sans-serif';
      ctx.fillText('Tap anywhere or press Space to resume', this.width / 2, this.height * 0.50);

      ctx.restore();
    }

    renderGameOverScreen(ctx) {
      ctx.save();
      ctx.fillStyle = 'rgba(5, 8, 20, 0.88)';
      ctx.fillRect(0, 0, this.width, this.height);

      ctx.textAlign = 'center';

      // Title
      ctx.shadowColor = '#ff0055';
      ctx.shadowBlur = 24;
      ctx.fillStyle = '#ff0055';
      ctx.font = '900 42px sans-serif';
      ctx.fillText('GAME OVER', this.width / 2, this.height * 0.28);

      // High score celebration badge
      if (this.isNewHighScore) {
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 16;
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 18px sans-serif';
        ctx.fillText('★ NEW HIGH SCORE! ★', this.width / 2, this.height * 0.35);
      }

      // Stats Card
      const cardY = this.height * 0.40;
      const cardW = Math.min(300, this.width * 0.82);
      const cardH = 150;
      const cardX = (this.width - cardW) / 2;

      ctx.fillStyle = 'rgba(12, 24, 60, 0.85)';
      ctx.strokeStyle = 'rgba(0, 245, 255, 0.4)';
      ctx.lineWidth = 1.5;
      this.drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 14);
      ctx.fill();
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.font = '14px sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.fillText('FINAL SCORE', this.width / 2, cardY + 32);

      ctx.font = 'bold 36px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#00f5ff';
      ctx.shadowBlur = 12;
      ctx.fillText(`${this.score}`, this.width / 2, cardY + 70);

      ctx.shadowBlur = 0;
      ctx.font = '15px sans-serif';
      ctx.fillStyle = '#ffd700';
      ctx.fillText(`🟡 Coins Collected: ${this.coinsCollected}`, this.width / 2, cardY + 106);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.fillText(`🏆 Best Score: ${this.bestScore}`, this.width / 2, cardY + 132);

      // Instant Retry Button
      const btn = this.uiButtons.retry;
      ctx.shadowColor = '#00f5ff';
      ctx.shadowBlur = 20;
      ctx.fillStyle = 'rgba(0, 245, 255, 0.25)';
      ctx.strokeStyle = '#00f5ff';
      ctx.lineWidth = 2.5;
      this.drawRoundedRect(ctx, btn.x, btn.y, btn.w, btn.h, 32);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PLAY AGAIN', btn.x + btn.w / 2, btn.y + btn.h / 2 + 7);

      ctx.restore();
    }

    drawRoundedRect(ctx, x, y, w, h, radius) {
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + w - radius, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
      ctx.lineTo(x + w, y + h - radius);
      ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
      ctx.lineTo(x + radius, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
    }
  }

  // Launch game on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new NeonCoinDash());
  } else {
    new NeonCoinDash();
  }
})();

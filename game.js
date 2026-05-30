// game.js - Code Red: Survival - COMPLETE WITH A* PATHFINDING
(function() {
  "use strict";

  // SUPABASE CONFIGURATION
  const SUPABASE_URL = 'https://fkbnpjbbiijlprdhjnad.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZrYm5wamJiaWlqbHByZGhqbmFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0ODI0NTQsImV4cCI6MjA3NzA1ODQ1NH0.a_qtutu3Lnbr4CIu_21gpqofiOjF_ihuaUE782weutk';

  // Performance detection
  const detectPerformance = () => {
    const cores = navigator.hardwareConcurrency || 2;
    const memory = navigator.deviceMemory || 2;
    const isHighEnd = cores >= 8 && memory >= 8;
    
    return {
      isHighEnd,
      mapSize: isHighEnd ? 500 : 100,
      pathRecalcInterval: isHighEnd ? 0.125 : 0.85
    };
  };

  const perf = detectPerformance();
  
  const CONFIG = {
    tileSize: 32,
    mapW: perf.mapSize,
    mapH: perf.mapSize,
    maxEnemies: 15,
    maxParticles: 100,
    maxBullets: 200,
    spawnDelay: 5.0,
    pathRecalcInterval: perf.pathRecalcInterval
  };

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function randRange(a, b) { return a + Math.random() * (b - a); }
  function dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }
  function createSeededRandom(seed) {
    let s = seed >>> 0;
    return function() {
      s = (Math.imul(1664525, s) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }
  function createSeededRandom(seed) {
    let state = (Number(seed) || 1) >>> 0;
    return () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    };
  }

  const Log = {
    info: (...a) => console.info("[GAME]", ...a),
    warn: (...a) => console.warn("[GAME]", ...a),
    error: (...a) => console.error("[GAME]", ...a)
  };

  Log.info(`Performance: ${perf.isHighEnd ? 'HIGH-END' : 'STANDARD'} - Map: ${CONFIG.mapW}x${CONFIG.mapH} - Path recalc: ${CONFIG.pathRecalcInterval}s`);

  // Developer Console
  class DevConsole {
    constructor() {
      this.isOpen = false;
      this.history = [];
      this.historyIndex = -1;
      this.commands = new Map();
      this.cheatsUsed = false;
      this.setupCommands();
      this.createConsoleUI();
    }

    createConsoleUI() {
      this.overlay = document.createElement('div');
      this.overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:10000;display:none;font-family:monospace;';

      this.panel = document.createElement('div');
      this.panel.style.cssText = 'position:absolute;bottom:50px;left:50px;right:50px;height:300px;background:#1a1a1a;border:2px solid #00d9ff;border-radius:8px;padding:10px;display:flex;flex-direction:column;';

      this.output = document.createElement('div');
      this.output.style.cssText = 'flex:1;background:#0a0a0a;border:1px solid #333;border-radius:4px;padding:8px;overflow-y:auto;color:#00ff00;font-size:14px;white-space:pre-wrap;margin-bottom:8px;';

      this.input = document.createElement('input');
      this.input.style.cssText = 'background:#0a0a0a;border:1px solid #00d9ff;border-radius:4px;padding:8px;color:#fff;font-family:monospace;font-size:14px;outline:none;';
      this.input.placeholder = 'Type "help" for commands';

      this.panel.appendChild(this.output);
      this.panel.appendChild(this.input);
      this.overlay.appendChild(this.panel);
      document.body.appendChild(this.overlay);

      this.input.addEventListener('keydown', (e) => this.handleInput(e));
      this.overlay.addEventListener('click', (e) => {
        if (e.target === this.overlay) this.close();
      });
    }

    handleInput(e) {
      e.stopPropagation();
      if (e.key === 'Enter') {
        const command = this.input.value.trim();
        if (command) {
          this.executeCommand(command);
          this.history.push(command);
          this.historyIndex = this.history.length;
          this.input.value = '';
        }
      } else if (e.key === 'Escape') {
        this.close();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (this.historyIndex > 0) {
          this.historyIndex--;
          this.input.value = this.history[this.historyIndex] || '';
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (this.historyIndex < this.history.length - 1) {
          this.historyIndex++;
          this.input.value = this.history[this.historyIndex] || '';
        } else {
          this.historyIndex = this.history.length;
          this.input.value = '';
        }
      }
    }

    log(message) {
      this.output.textContent += message + '\n';
      this.output.scrollTop = this.output.scrollHeight;
    }

    executeCommand(command) {
      this.log('> ' + command);
      const parts = command.split(' ');
      const cmd = parts[0].toLowerCase();
      const args = parts.slice(1);

      if (this.commands.has(cmd)) {
        try {
          this.cheatsUsed = true;
          if (window.game && window.game.world) {
            window.game.world.cheatsUsed = true;
          }
          const result = this.commands.get(cmd)(args);
          if (result) this.log(result);
        } catch (error) {
          this.log('Error: ' + error.message);
        }
      } else {
        this.log('Unknown command: ' + cmd);
      }
    }

    setupCommands() {
      this.commands.set('help', () => {
        this.log('Commands: spawn <type> [count], clear, heal, coins <amount>, skip');
        return null;
      });

      this.commands.set('spawn', (args) => {
        if (!window.game || !window.game.world) return 'Game not ready';
        const type = args[0] || 'basic';
        const count = parseInt(args[1]) || 1;
        for (let i = 0; i < count; i++) {
          window.game.world.spawnEnemy(type);
        }
        return 'Spawned ' + count + ' ' + type;
      });

      this.commands.set('clear', () => {
        if (!window.game || !window.game.world) return 'Game not ready';
        const count = window.game.world.enemies.length;
        window.game.world.enemies = [];
        return 'Cleared ' + count + ' enemies';
      });

      this.commands.set('heal', () => {
        if (!window.game || !window.game.world) return 'Game not ready';
        window.game.world.player.hp = window.game.world.player.maxHp;
        return 'Healed';
      });

      this.commands.set('coins', (args) => {
        if (!window.game || !window.game.world) return 'Game not ready';
        const amount = parseInt(args[0]) || 100;
        window.game.world.player.coins += amount;
        return 'Added ' + amount + ' coins';
      });

      this.commands.set('skip', () => {
        if (!window.game || !window.game.world) return 'Game not ready';
        if (!window.game.world.isRunning) return 'No wave active';
        window.game.world.endWave();
        const w = window.game.world;
        if (!w.cheatsUsed) {
          Leaderboard.addScore(w.userName, w.wave, w.difficulty, w.player.kills);
        }
        return 'Skipped to next wave';
      });
    }

    open() {
      this.isOpen = true;
      this.overlay.style.display = 'block';
      this.input.focus();
      this.log('Developer Console. Type "help"');
    }

    close() {
      this.isOpen = false;
      this.overlay.style.display = 'none';
    }

    toggle() {
      if (this.isOpen) this.close();
      else this.open();
    }
  }

  // Audio - iOS compatible
  let audioCtx = null;
  let audioInitialized = false;
  
  function initAudioContext() {
    if (audioInitialized && audioCtx) return audioCtx;
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioInitialized = true;
      // Resume audio context if suspended (iOS requirement)
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().then(() => {
          Log.info("Audio context resumed");
        }).catch(e => {
          Log.warn("Audio resume failed:", e);
        });
      }
    } catch (e) {
      Log.warn("Audio not available:", e);
    }
    return audioCtx;
  }

  function playSound(freq, duration) {
    if (!audioCtx) {
      audioCtx = initAudioContext();
    if (!audioCtx) return;
    }
    
    // Resume if suspended (iOS requirement)
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(e => {});
    }
    
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.value = freq;
      gain.gain.value = 0.05;
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
      // Silently fail on audio errors
    }
  }

  function sfxShoot() { playSound(900, 0.05); }
  function sfxHit() { playSound(1200, 0.06); }
  function sfxPickup() { playSound(1600, 0.06); }
  function sfxExplosion() { playSound(100, 0.2); }
  function sfxDash() { playSound(600, 0.08); }
  function sfxReloadSuccess() { playSound(1800, 0.1); }
  function sfxMelee() { playSound(300, 0.1); }
  function sfxTrap() { playSound(500, 0.15); }
  function sfxRevive() { playSound(1400, 0.2); }

  // Save
  const Save = {
    key: "codered-save",
    load() {
      try {
        const data = localStorage.getItem(this.key);
        return data ? JSON.parse(data) : { coins: 0, bestWave: 0, difficulty: "Normal" };
      } catch (e) { return { coins: 0, bestWave: 0, difficulty: "Normal" }; }
    },
    save(data) {
      try { localStorage.setItem(this.key, JSON.stringify(data)); }
      catch (e) {}
    }
  };

  // Supabase Helper
  const Supabase = {
    async request(method, endpoint, body = null) {
      const options = {
        method,
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        }
      };
      
      if (body) {
        options.body = JSON.stringify(body);
      }
      
      const response = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, options);
      if (!response.ok) {
        throw new Error(`Supabase error: ${response.statusText}`);
      }
      return response.json();
    },
    
    async insert(table, data) {
      return this.request('POST', table, data);
    },
    
    async select(table, query = '') {
      return this.request('GET', `${table}?${query}`);
    }
  };

  // Global Leaderboard with Supabase
  const Leaderboard = {
    async load() {
      try {
        const scores = await Supabase.select('leaderboard', 'select=*&order=waves.desc,kills.desc&limit=50');
        return scores || [];
      } catch (e) {
        Log.error("Failed to load leaderboard:", e);
        return [];
      }
    },
    
    async addScore(name, waves, difficulty, kills) {
      try {
        const scoreData = {
          name: name || "Anonymous",
          waves: waves,
          difficulty: difficulty || "Normal",
          kills: kills || 0,
          timestamp: Date.now()
        };
        
        await Supabase.insert('leaderboard', scoreData);
        Log.info("Score added to leaderboard: " + name + " - Wave " + waves);
        return true;
      } catch (e) {
        Log.error("Failed to add score:", e);
        return false;
      }
    },
    
    async getTopScores(limit = 10) {
      const scores = await this.load();
      return scores.slice(0, limit);
    },
    
    async getUserRank(name, waves) {
      const scores = await this.load();
      const index = scores.findIndex(s => s.name === name && s.waves === waves);
      return index >= 0 ? index + 1 : -1;
    }
  };

  // Player Counter
  const PlayerCounter = {
    key: "codered-players",
    load() {
      try {
        const data = localStorage.getItem(this.key);
        return data ? JSON.parse(data) : { count: 0, usernames: [] };
      } catch (e) {
        return { count: 0, usernames: [] };
      }
    },
    save(data) {
      try {
        localStorage.setItem(this.key, JSON.stringify(data));
      } catch (e) {}
    },
    addPlayer(username) {
      const data = this.load();
      if (!data.usernames.includes(username)) {
        data.usernames.push(username);
        data.count = data.usernames.length;
        this.save(data);
      }
      return data.count;
    },
    getCount() {
      return this.load().count;
    }
  };

  // Input
  const Input = {
    keys: {}, 
    mouse: { x: 0, y: 0, down: false },
    touch: { active: false, x: 0, y: 0 },
    joystick: { x: 0, y: 0, active: false },
    isMobile: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent),
    
    init(canvas) {
      // Initialize virtual joystick for mobile
      this.initVirtualJoystick();
      this.initShootButton();
      // Keyboard events
      window.addEventListener("keydown", e => { 
        this.keys[e.key.toLowerCase()] = true; 
        if (e.key === " ") e.preventDefault(); 
      });
      window.addEventListener("keyup", e => { 
        this.keys[e.key.toLowerCase()] = false; 
      });
      
      // Mouse events
      canvas.addEventListener("mousemove", e => {
        const rect = canvas.getBoundingClientRect();
        this.mouse.x = (e.clientX - rect.left) * (canvas.width / rect.width);
        this.mouse.y = (e.clientY - rect.top) * (canvas.height / rect.height);
      });
      canvas.addEventListener("mousedown", e => { 
        if (e.button === 0) {
          this.mouse.down = true;
          this.initAudio(); // Initialize audio on first interaction (iOS requirement)
        }
      });
      canvas.addEventListener("mouseup", e => { 
        if (e.button === 0) this.mouse.down = false; 
      });
      canvas.addEventListener("mouseleave", e => {
        this.mouse.down = false;
      });
      
      // Touch events for iOS/mobile (for aiming/shooting, excluding joystick area)
      let aimTouchId = null;
      const isInControlArea = (clientX, clientY) => {
        const joystick = document.getElementById('virtualJoystick');
        const shootButton = document.getElementById('shootButton');
        if (!joystick || !shootButton) return false;
        
        const joystickRect = joystick.getBoundingClientRect();
        const shootRect = shootButton.getBoundingClientRect();
        
        // Check if touch is in joystick area (left side)
        if (clientX >= joystickRect.left - 50 && clientX <= joystickRect.right + 50 &&
            clientY >= joystickRect.top - 50 && clientY <= joystickRect.bottom + 50) {
          return true;
        }
        
        // Check if touch is in shoot button area (right side)
        if (clientX >= shootRect.left - 50 && clientX <= shootRect.right + 50 &&
            clientY >= shootRect.top - 50 && clientY <= shootRect.bottom + 50) {
          return true;
        }
        
        return false;
      };
      
      canvas.addEventListener("touchstart", e => {
        const touch = e.touches[0] || e.changedTouches[0];
        if (!touch) return;
        
        // Don't handle touches in control areas (joystick/shoot button)
        if (isInControlArea(touch.clientX, touch.clientY)) {
          return;
        }
        
        e.preventDefault();
        this.initAudio(); // Initialize audio on first interaction (iOS requirement)
        
        const rect = canvas.getBoundingClientRect();
        const x = (touch.clientX - rect.left) * (canvas.width / rect.width);
        const y = (touch.clientY - rect.top) * (canvas.height / rect.height);
        
        // Treat touch as mouse for aiming and shooting
        this.mouse.x = x;
        this.mouse.y = y;
        this.mouse.down = true;
        this.touch.active = true;
        this.touch.x = x;
        this.touch.y = y;
        aimTouchId = touch.identifier;
      }, { passive: false });
      
      canvas.addEventListener("touchmove", e => {
        const touch = Array.from(e.touches).find(t => t.identifier === aimTouchId) || 
                     (e.changedTouches && e.changedTouches.find(t => t.identifier === aimTouchId));
        if (!touch) return;
        
        // Don't handle touches in control areas
        if (isInControlArea(touch.clientX, touch.clientY)) {
          return;
        }
        
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const x = (touch.clientX - rect.left) * (canvas.width / rect.width);
        const y = (touch.clientY - rect.top) * (canvas.height / rect.height);
        
        this.mouse.x = x;
        this.mouse.y = y;
        this.touch.x = x;
        this.touch.y = y;
      }, { passive: false });
      
      canvas.addEventListener("touchend", e => {
        const touch = e.changedTouches.find(t => t.identifier === aimTouchId);
        if (touch && isInControlArea(touch.clientX, touch.clientY)) {
          return;
        }
        
        e.preventDefault();
        this.mouse.down = false;
        this.touch.active = false;
        aimTouchId = null;
      }, { passive: false });
      
      canvas.addEventListener("touchcancel", e => {
        e.preventDefault();
        this.mouse.down = false;
        this.touch.active = false;
        aimTouchId = null;
      }, { passive: false });
      
      canvas.addEventListener("contextmenu", e => e.preventDefault());
      
      // Prevent default touch behaviors
      document.addEventListener("touchmove", e => {
        if (e.target === canvas || canvas.contains(e.target)) {
          e.preventDefault();
        }
      }, { passive: false });
      
      document.addEventListener("touchstart", e => {
        if (e.target === canvas || canvas.contains(e.target)) {
          e.preventDefault();
        }
      }, { passive: false });
    },
    
    initAudio() {
      // Initialize audio context on user interaction (required for iOS)
      initAudioContext();
    },
    
    initVirtualJoystick() {
      // Wait for DOM to be ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.initVirtualJoystick());
        return;
      }
      
      const joystick = document.getElementById('virtualJoystick');
      const knob = document.getElementById('joystickKnob');
      const mobileControls = document.getElementById('mobileControls');
      
      if (!joystick || !knob || !mobileControls) {
        // Retry after a short delay if elements aren't ready
        setTimeout(() => this.initVirtualJoystick(), 100);
        return;
      }
      
      // Don't show controls by default - they'll be shown when game starts
      mobileControls.style.display = 'none';
      
      let joystickActive = false;
      const joystickRect = { x: 0, y: 0, size: 120, radius: 60 };
      const knobSize = 50;
      const maxDistance = joystickRect.radius - knobSize / 2;
      
      const updateJoystickPosition = (clientX, clientY) => {
        const rect = joystick.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        let dx = clientX - centerX;
        let dy = clientY - centerY;
        const distance = Math.hypot(dx, dy);
        
        if (distance > maxDistance) {
          dx = (dx / distance) * maxDistance;
          dy = (dy / distance) * maxDistance;
        }
        
        knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        
        // Normalize to -1 to 1
        this.joystick.x = dx / maxDistance;
        this.joystick.y = dy / maxDistance;
        this.joystick.active = true;
      };
      
      const resetJoystick = () => {
        knob.style.transform = 'translate(-50%, -50%)';
        this.joystick.x = 0;
        this.joystick.y = 0;
        this.joystick.active = false;
        joystickActive = false;
      };
      
      joystick.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        joystickActive = true;
        this.initAudio();
        const touch = e.touches[0];
        updateJoystickPosition(touch.clientX, touch.clientY);
      }, { passive: false });
      
      joystick.addEventListener('touchmove', (e) => {
        if (!joystickActive) return;
        e.preventDefault();
        e.stopPropagation();
        const touch = e.touches[0];
        updateJoystickPosition(touch.clientX, touch.clientY);
      }, { passive: false });
      
      joystick.addEventListener('touchend', (e) => {
        e.preventDefault();
        e.stopPropagation();
        resetJoystick();
      }, { passive: false });
      
      joystick.addEventListener('touchcancel', (e) => {
        e.preventDefault();
        e.stopPropagation();
        resetJoystick();
      }, { passive: false });
    },
    
    initShootButton() {
      // Wait for DOM to be ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.initShootButton());
        return;
      }
      
      const shootButton = document.getElementById('shootButton');
      if (!shootButton) {
        // Retry after a short delay if element isn't ready
        setTimeout(() => this.initShootButton(), 100);
        return;
      }
      
      let shootActive = false;
      
      shootButton.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        shootActive = true;
        this.mouse.down = true;
        this.initAudio();
      }, { passive: false });
      
      shootButton.addEventListener('touchend', (e) => {
        e.preventDefault();
        e.stopPropagation();
        shootActive = false;
        this.mouse.down = false;
      }, { passive: false });
      
      shootButton.addEventListener('touchcancel', (e) => {
        e.preventDefault();
        e.stopPropagation();
        shootActive = false;
        this.mouse.down = false;
      }, { passive: false });
    }
  };

  // Permanent Upgrades Storage
  const PermanentUpgrades = {
    key: "codered-upgrades",
    load() {
      try {
        const data = localStorage.getItem(this.key);
        if (data) {
          // By merging with defaults, we ensure that new properties are added to old save files.
          return { ...this.getDefaults(), ...JSON.parse(data) };
        }
        return this.getDefaults();
      } catch (e) {
        // If parsing fails, return fresh defaults.
        return this.getDefaults();
      }
    },
    getDefaults() {
      return {
        redGems: 0,
        rainbowCrystals: 0,
        baseDamage: 0,
        fireRateBonus: 0,
        maxHpBonus: 0,
        armorBonus: 0,
        speedBonus: 0,
        unlockedWeapons: [0],
        unlockedRainbowWeapons: [],
        playerColor: "#00d9ff",
        unlockedColors: ["#00d9ff", "#00ff88", "#ff0000"],
        controls: {
          moveUp: 'w',
          moveDown: 's',
          moveLeft: 'a',
          moveRight: 'd',
          switchWeapon: 'q',
          shop: 'f',
          sprint: 'shift'
        }
      };
    },
    save(data) {
      try { localStorage.setItem(this.key, JSON.stringify(data)); }
      catch (e) {}
    }
  };

  // Player
  class Player {
    constructor(x, y, options = {}) {
      this.x = x;
      this.y = y;
      this.name = options.name || "Player";
      this.networkId = options.networkId || null;
      this.radius = 12;
      this.speed = 180;
      this.hp = 100;
      this.maxHp = 100;
      this.coins = 0;
      this.gems = 0;
      this.redGems = 0;
      this.kills = 0;
      this.weaponIndex = 0;
      this.weapons = [
        { name: "Pistol", dmg: 18, bullets: 1, spread: 4, fireRate: 0.22, magSize: 12 },
        { name: "Shotgun", dmg: 10, bullets: 5, spread: 18, fireRate: 0.85, magSize: 6 },
        { name: "Burst", dmg: 12, bullets: 3, spread: 6, fireRate: 0.45, magSize: 24 },
        { name: "Sniper", dmg: 75, bullets: 1, spread: 0.5, fireRate: 0.9, magSize: 5 },
        { name: "Railgun", dmg: 0, bullets: 1, spread: 0, fireRate: 60, isMelee: false, isRailgun: true, magSize: 1 },
        { name: "SMG", dmg: 8, bullets: 1, spread: 6, fireRate: 0.08, magSize: Math.round(67 * 6.7) },
        { name: "Flamethrower", dmg: 6, bullets: 6, spread: 20, fireRate: 0.12, magSize: Math.round(60 * 6.7) },
        { name: "Plasma", dmg: 40, bullets: 1, spread: 2, fireRate: 0.6, magSize: 15 },
        { name: "LaserSweep", dmg: 25, bullets: 1, spread: 0.5, fireRate: 1.5, magSize: 10 },
        { name: "Rocket", dmg: 120, bullets: 1, spread: 3, fireRate: 1.8, magSize: 3 },
        // New weapons (#11 Crossbow, #12 Grenade Launcher, #15 Chainsaw)
        { name: "Crossbow", dmg: 85, bullets: 1, spread: 0, fireRate: 1.1, magSize: 8, isCrossbow: true },
        { name: "Grenade", dmg: 200, bullets: 1, spread: 5, fireRate: 2.0, magSize: 4, isGrenade: true },
        { name: "Chainsaw", dmg: 30, bullets: 0, spread: 0, fireRate: 0.08, magSize: 100, isMelee: true, isChainsaw: true },
        // Rainbow Weapons (indices 10-39)
        { name: " TimeBlaster", dmg: 200, bullets: 1, spread: 0, fireRate: 0.8, magSize: 20 },
        { name: " VortexCannon", dmg: 300, bullets: 3, spread: 15, fireRate: 1.2, magSize: 12 },
        { name: " NeutronBomb", dmg: 500, bullets: 1, spread: 5, fireRate: 2.5, magSize: 3 },
        { name: " PhasingLaser", dmg: 250, bullets: 1, spread: 1, fireRate: 0.5, magSize: 25 },
        { name: " GravityWell", dmg: 350, bullets: 2, spread: 20, fireRate: 1.5, magSize: 8 },
        { name: " StormStrike", dmg: 180, bullets: 8, spread: 40, fireRate: 0.6, magSize: 16 },
        { name: " InfernoBlast", dmg: 400, bullets: 5, spread: 25, fireRate: 1.8, magSize: 10 },
        { name: " IceShatter", dmg: 220, bullets: 6, spread: 18, fireRate: 1.0, magSize: 12 },
        { name: " SonicBoom", dmg: 280, bullets: 1, spread: 2, fireRate: 0.4, magSize: 30 },
        { name: " DimensionRip", dmg: 420, bullets: 2, spread: 10, fireRate: 2.0, magSize: 6 },
        { name: " QuantumShot", dmg: 350, bullets: 4, spread: 12, fireRate: 0.9, magSize: 16 },
        { name: " CelestialRay", dmg: 500, bullets: 1, spread: 0.5, fireRate: 3.0, magSize: 4 },
        { name: " VoidPulse", dmg: 380, bullets: 3, spread: 8, fireRate: 1.3, magSize: 12 },
        { name: " PhoenixFlare", dmg: 450, bullets: 6, spread: 30, fireRate: 1.6, magSize: 10 },
        { name: " FrostNova", dmg: 320, bullets: 10, spread: 35, fireRate: 0.8, magSize: 15 },
        { name: " ThunderStorm", dmg: 290, bullets: 7, spread: 45, fireRate: 0.7, magSize: 14 },
        { name: " ShadowStrike", dmg: 400, bullets: 2, spread: 5, fireRate: 1.1, magSize: 8 },
        { name: " LightBurst", dmg: 380, bullets: 8, spread: 20, fireRate: 1.2, magSize: 12 },
        { name: " ObsidianBolt", dmg: 520, bullets: 1, spread: 1, fireRate: 2.8, magSize: 5 },
        { name: " PrismShatter", dmg: 360, bullets: 12, spread: 50, fireRate: 0.9, magSize: 20 },
        { name: " CosmicFury", dmg: 600, bullets: 1, spread: 3, fireRate: 4.0, magSize: 3 },
        { name: " AbyssalWave", dmg: 480, bullets: 5, spread: 15, fireRate: 1.7, magSize: 10 },
        { name: " EchoingBlade", dmg: 410, bullets: 3, spread: 25, fireRate: 1.4, magSize: 12 },
        { name: " InfinityGun", dmg: 999, bullets: 1, spread: 0, fireRate: 10.0, magSize: 1 }
      ];
      this.unlockedWeapons = [0];
      this.shootCooldown = 0;
      this.armor = 0;
      this.speedMul = 1;
      this.pickupRadius = 1;
      this.rainbowCrystals = 0;
      const perm = PermanentUpgrades.load();
      this.color = options.color || perm.playerColor || "#00d9ff";
      this.canShoot = true;
      this.magAmmo = this.weapons[0].magSize; // Initialize with first weapon's mag size
      this.reloadTimer = 0;
      this.railgunSpinAngle = 0;
      this.reloadKeyPressed = false;
      // #1 Stamina Bar
      this.stamina = 100;
      this.maxStamina = 100;
      this.staminaRegenRate = 20;
      // #2 Ghost Dash
      this.dashCooldown = 0;
      this.dashDuration = 0;
      this.dashInvulnerable = false;
      this.dashKeyPressed = false;
      // #3 Active Reload
      this.activeReloadWindow = 0;
      this.activeReloadSuccess = false;
      this.activeReloadKeyPressed = false;
      // #4 Melee Bash
      this.meleeCooldown = 0;
      // #6 Crouch
      this.isCrouching = false;
      // #13 Laser Sight
      this.hasLaserSight = false;
      // #14 Homing Missiles - tracked separately in world
      // #19 Ammo Satchel
      this.ammoSatchel = 0;
      // #40 Revive (multiplayer)
      this.isDown = false;
      this.reviveTimer = 0;
      // Stats tracking (#47)
      this.shotsFired = 0;
      this.shotsHit = 0;
      this.damageTaken = 0;
      this.damageDealt = 0;
      
      if (options.applyUpgrades !== false) {
        this.applyPermanentUpgrades();
      }
    }

    applyPermanentUpgrades() {
      const upgrades = PermanentUpgrades.load();
      
      // Apply damage bonus to all weapons
      this.weapons.forEach(w => {
        if (w.dmg > 0) w.dmg += upgrades.baseDamage;
      });
      
      // Apply fire rate bonus
      this.weapons.forEach(w => {
        if (w.fireRate > 0 && w.fireRate < 60) {
          w.fireRate *= (1 - upgrades.fireRateBonus);
        }
      });
      
      // Apply max HP bonus
      this.maxHp += upgrades.maxHpBonus;
      this.hp = this.maxHp;
      
      // Apply armor bonus
      this.armor = upgrades.armorBonus;
      
      // Apply speed bonus
      this.speedMul = 1 + upgrades.speedBonus;
      
      // Apply unlocked weapons
      this.unlockedWeapons = [...upgrades.unlockedWeapons];
      // Apply rainbow weapons
      if (upgrades.unlockedRainbowWeapons && upgrades.unlockedRainbowWeapons.length > 0) {
        upgrades.unlockedRainbowWeapons.forEach(weaponIndex => {
          if (!this.unlockedWeapons.includes(weaponIndex)) {
            this.unlockedWeapons.push(weaponIndex);
          }
        });
      }
      // Apply saved colors
      this.secondaryColor = upgrades.selectedSecondary || (upgrades.unlockedColors && upgrades.unlockedColors[1]) || null;
      // Ensure player's color property matches saved primary
      const perm = PermanentUpgrades.load();
      this.color = perm.playerColor || this.color;
    }

    update(dt, world) {
      let mx = 0, my = 0;
      if (Input.joystick.active) {
        mx = Input.joystick.x;
        my = Input.joystick.y;
      } else {
        const upgrades = PermanentUpgrades.load();
        const controls = upgrades.controls || PermanentUpgrades.getDefaults().controls;
        if (Input.keys[controls.moveUp]) my -= 1;
        if (Input.keys[controls.moveDown]) my += 1;
        if (Input.keys[controls.moveLeft]) mx -= 1;
        if (Input.keys[controls.moveRight]) mx += 1;
      }

      const len = Math.hypot(mx, my);
      if (len > 0) { mx /= len; my /= len; }

      const upgrades2 = PermanentUpgrades.load();
      const controls2 = upgrades2.controls || PermanentUpgrades.getDefaults().controls;
      const isSprinting = Input.keys[controls2.sprint] && this.stamina > 0 && !this.isCrouching;

      // #6 Crouch: C key reduces speed but improves accuracy
      this.isCrouching = !!Input.keys['c'];
      const crouchMult = this.isCrouching ? 0.45 : 1;
      const spreadMult = this.isCrouching ? 0.3 : 1;

      // #1 Stamina
      if (isSprinting && (mx !== 0 || my !== 0)) {
        this.stamina = Math.max(0, this.stamina - 25 * dt);
      } else {
        this.stamina = Math.min(this.maxStamina, this.stamina + this.staminaRegenRate * dt);
      }

      // #2 Ghost Dash (E key)
      this.dashCooldown = Math.max(0, this.dashCooldown - dt);
      this.dashDuration = Math.max(0, this.dashDuration - dt);
      if (this.dashDuration <= 0) this.dashInvulnerable = false;
      if (Input.keys['e'] && !this.dashKeyPressed && this.dashCooldown <= 0 && this.stamina >= 30) {
        this.dashKeyPressed = true;
        const dashDist = 140;
        const dashDx = mx || Math.cos(Math.atan2(Input.mouse.y + world.camera.y - this.y, Input.mouse.x + world.camera.x - this.x));
        const dashDy = my || Math.sin(Math.atan2(Input.mouse.y + world.camera.y - this.y, Input.mouse.x + world.camera.x - this.x));
        const nx = this.x + dashDx * dashDist;
        const ny = this.y + dashDy * dashDist;
        if (!world.checkCollision(nx, this.y, this.radius)) this.x = nx;
        if (!world.checkCollision(this.x, ny, this.radius)) this.y = ny;
        this.dashCooldown = 2.5;
        this.dashDuration = 0.18;
        this.dashInvulnerable = true;
        this.stamina = Math.max(0, this.stamina - 30);
        world.spawnParticles(this.x, this.y, 8, this.color || "#00d9ff");
        sfxDash();
      }
      if (!Input.keys['e']) this.dashKeyPressed = false;

      const speed = this.speed * this.speedMul * (isSprinting ? 1.4 : 1) * crouchMult;
      const newX = this.x + mx * speed * dt;
      const newY = this.y + my * speed * dt;
      if (!world.checkCollision(newX, this.y, this.radius)) this.x = newX;
      if (!world.checkCollision(this.x, newY, this.radius)) this.y = newY;
      this.x = clamp(this.x, this.radius, world.mapW * world.tileSize - this.radius);
      this.y = clamp(this.y, this.radius, world.mapH * world.tileSize - this.radius);

      // #10 Ledge Mantling: if stuck in wall, nudge out
      if (world.checkCollision(this.x, this.y, this.radius - 4)) {
        for (let ang = 0; ang < Math.PI * 2; ang += Math.PI / 4) {
          const tx = this.x + Math.cos(ang) * 4;
          const ty = this.y + Math.sin(ang) * 4;
          if (!world.checkCollision(tx, ty, this.radius - 4)) { this.x = tx; this.y = ty; break; }
        }
      }

      this.shootCooldown -= dt;
      this.meleeCooldown = Math.max(0, this.meleeCooldown - dt);
      this.reloadTimer = Math.max(0, this.reloadTimer - dt);
      const weapon = this.weapons[this.weaponIndex];

      // #3 Active Reload window
      if (this.activeReloadWindow > 0) {
        this.activeReloadWindow -= dt;
        if (this.activeReloadWindow <= 0) this.activeReloadSuccess = false;
      }

      if (weapon.magSize !== undefined) {
        if (Input.keys['r'] && !this.reloadKeyPressed && this.reloadTimer <= 0 && this.magAmmo < weapon.magSize) {
          // #3 Active Reload: if R pressed in the sweet spot (0.8–1.2s of a 3s reload in progress = if we just started)
          if (this.activeReloadWindow > 0) {
            this.activeReloadSuccess = true;
            this.magAmmo = weapon.magSize;
            this.reloadTimer = 0;
            this.activeReloadWindow = 0;
            UI.showToast("⚡ ACTIVE RELOAD! +20% damage!");
            sfxReloadSuccess();
          } else {
            this.reloadTimer = 3;
            this.activeReloadWindow = 1.0; // window opens 1s into reload
            this.activeReloadSuccess = false;
          }
          this.reloadKeyPressed = true;
        }
        if (!Input.keys['r']) this.reloadKeyPressed = false;
        if (this.magAmmo <= 0 && this.reloadTimer <= 0) {
          this.reloadTimer = 3;
          this.activeReloadWindow = 1.0;
          this.activeReloadSuccess = false;
        }
        if (this.reloadTimer <= 0 && this.magAmmo < weapon.magSize) {
          this.magAmmo = weapon.magSize;
        }
      }

      // #4 Melee Bash (Q key)
      if (Input.keys['q'] && this.meleeCooldown <= 0) {
        this.meleeCooldown = 0.8;
        const bashRange = 70;
        for (const e of world.enemies) {
          const d = Math.hypot(e.x - this.x, e.y - this.y);
          if (d < bashRange) {
            const angle = Math.atan2(e.y - this.y, e.x - this.x);
            e.x += Math.cos(angle) * 120;
            e.y += Math.sin(angle) * 120;
            e.hp -= 15;
            world.spawnParticles(e.x, e.y, 6, "#ffaa00");
            sfxMelee();
          }
        }
        // Visual flash
        world.spawnParticles(this.x + mx * 30, this.y + my * 30, 5, "#ffdd00");
      }

      // #8 Passive Regen (late-game skill, only if upgrade purchased)
      if (this.passiveRegen) {
        this.regenTimer = (this.regenTimer || 0) + dt;
        if (this.regenTimer >= 10) { this.regenTimer = 0; this.hp = Math.min(this.maxHp, this.hp + 1); }
      }

      if (this.canShoot && (Input.mouse.down || Input.keys[' ']) && this.shootCooldown <= 0) {
        this._spreadMult = spreadMult;
        this.fire(world);
      }
    }

    updateFromNetworkInput(dt, world, input = {}) {
      let mx = 0, my = 0;
      if (input.up) my -= 1;
      if (input.down) my += 1;
      if (input.left) mx -= 1;
      if (input.right) mx += 1;

      const len = Math.hypot(mx, my);
      if (len > 0) { mx /= len; my /= len; }

      const speed = this.speed * this.speedMul * (input.sprint ? 1.4 : 1);
      const newX = this.x + mx * speed * dt;
      const newY = this.y + my * speed * dt;
      if (!world.checkCollision(newX, this.y, this.radius)) this.x = newX;
      if (!world.checkCollision(this.x, newY, this.radius)) this.y = newY;

      this.x = clamp(this.x, this.radius, world.mapW * world.tileSize - this.radius);
      this.y = clamp(this.y, this.radius, world.mapH * world.tileSize - this.radius);
      this.weaponIndex = clamp(input.weaponIndex || this.weaponIndex, 0, this.weapons.length - 1);
      this.shootCooldown -= dt;
      this.reloadTimer = Math.max(0, this.reloadTimer - dt);

      const weapon = this.weapons[this.weaponIndex];
      if (weapon.magSize !== undefined) {
        if (input.reload && this.reloadTimer <= 0 && this.magAmmo < weapon.magSize) {
          this.reloadTimer = 3;
        }
        if (this.magAmmo <= 0 && this.reloadTimer <= 0) {
          this.reloadTimer = 3;
        }
        if (this.reloadTimer <= 0 && this.magAmmo < weapon.magSize) {
          this.magAmmo = weapon.magSize;
        }
      }

      if (input.shoot && this.shootCooldown <= 0) {
        this.fire(world, input.aimX, input.aimY, "player");
      }
    }

    fire(world, targetX = null, targetY = null, owner = "player") {
      const weapon = this.weapons[this.weaponIndex];

      // #15 Chainsaw: melee weapon, damages nearby enemies continuously
      if (weapon.isChainsaw) {
        if (this.shootCooldown > 0) return;
        this.shootCooldown = weapon.fireRate;
        if (weapon.magSize !== undefined) {
          if (this.magAmmo <= 0) return;
          this.magAmmo--;
        }
        const chainsawRange = 55;
        for (const e of world.enemies) {
          if (Math.hypot(e.x - this.x, e.y - this.y) < chainsawRange) {
            e.hp -= weapon.dmg;
            this.damageDealt = (this.damageDealt || 0) + weapon.dmg;
            world.spawnParticles(e.x, e.y, 3, "#ff6600");
            sfxMelee();
          }
        }
        return;
      }

      if (weapon.magSize !== undefined) {
        if (this.reloadTimer > 0) return false;
        if (this.magAmmo <= 0) { this.reloadTimer = 3; return false; }
        this.magAmmo--;
        if (this.magAmmo <= 0) this.reloadTimer = weapon.reloadTime || 3;
      }

      if (weapon.isRailgun) {
        if (this.shootCooldown > 0) return;
        this.shootCooldown = weapon.fireRate;
        const numLasers = 8;
        for (let i = 0; i < numLasers; i++) {
          const angle = (Math.PI * 2 / numLasers) * i + this.railgunSpinAngle;
          world.bullets.push({ x: this.x, y: this.y, vx: 0, vy: 0, dmg: 150, owner, radius: 6,
            travel: 0, maxTravel: Infinity, isLaser: true, angle, lifetime: 0.5, age: 0, source: this });
        }
        this.railgunSpinAngle += 0.3;
        sfxShoot();
        this.shotsFired = (this.shotsFired || 0) + 1;
        return;
      }

      this.shootCooldown = weapon.fireRate;
      const aimX = targetX === null ? Input.mouse.x + world.camera.x : targetX;
      const aimY = targetY === null ? Input.mouse.y + world.camera.y : targetY;
      const angle = Math.atan2(aimY - this.y, aimX - this.x);

      // #3 Active Reload damage boost
      const dmgMult = this.activeReloadSuccess ? 1.2 : 1;

      // #12 Grenade Launcher
      if (weapon.isGrenade) {
        world.bullets.push({
          x: this.x + Math.cos(angle) * 16,
          y: this.y + Math.sin(angle) * 16,
          vx: Math.cos(angle) * 420,
          vy: Math.sin(angle) * 420,
          dmg: weapon.dmg * dmgMult,
          owner, radius: 8, travel: 0, maxTravel: 600,
          isGrenade: true
        });
        sfxShoot();
        this.shotsFired = (this.shotsFired || 0) + 1;
        return;
      }

      // #11 Crossbow - retrievable bolt (treated as high-damage slow projectile)
      if (weapon.isCrossbow) {
        world.bullets.push({
          x: this.x + Math.cos(angle) * 16,
          y: this.y + Math.sin(angle) * 16,
          vx: Math.cos(angle) * 1100,
          vy: Math.sin(angle) * 1100,
          dmg: weapon.dmg * dmgMult,
          owner, radius: 5, travel: 0, maxTravel: 1800,
          isCrossbow: true
        });
        sfxShoot();
        this.shotsFired = (this.shotsFired || 0) + 1;
        return;
      }

      const spreadBase = weapon.spread * (this._spreadMult || 1);
      for (let i = 0; i < weapon.bullets; i++) {
        const spread = (Math.random() - 0.5) * (spreadBase * Math.PI / 180);
        const a = angle + spread;
        world.bullets.push({
          x: this.x + Math.cos(a) * 16,
          y: this.y + Math.sin(a) * 16,
          vx: Math.cos(a) * 850,
          vy: Math.sin(a) * 850,
          dmg: weapon.dmg * dmgMult,
          owner, radius: 4, travel: 0, maxTravel: 1400
        });
      }
      if (weapon.magSize !== undefined) {
        this.magAmmo--;
        if (this.magAmmo <= 0) this.reloadTimer = weapon.reloadTime || 3;
      }
      sfxShoot();
      this.shotsFired = (this.shotsFired || 0) + 1;
    }

    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);

      // #2 Ghost Dash invulnerability flash
      if (this.dashInvulnerable) {
        ctx.globalAlpha = 0.5 + Math.sin(Date.now() * 0.05) * 0.3;
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, 0, this.radius + 6, 0, Math.PI * 2); ctx.stroke();
      }

      // Orange aura/glow
      const gradient = ctx.createRadialGradient(0, 0, this.radius, 0, 0, this.radius * 2);
      gradient.addColorStop(0, 'rgba(255, 165, 0, 0.6)');
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;
      ctx.beginPath(); ctx.arc(0, 0, this.radius * 2, 0, Math.PI * 2); ctx.fill();

      // Body
      const bodyGradient = ctx.createRadialGradient(0, 0, this.radius * 0.7, 0, 0, this.radius);
      const primaryCol = this.color || '#00a8ff';
      const secondaryCol = this.secondaryColor || primaryCol;
      bodyGradient.addColorStop(0, primaryCol);
      bodyGradient.addColorStop(1, secondaryCol);
      ctx.fillStyle = bodyGradient;
      ctx.globalAlpha = this.isCrouching ? 0.7 : 1;
      ctx.beginPath(); ctx.arc(0, 0, this.isCrouching ? this.radius * 0.75 : this.radius, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;

      // Health bar
      if (this.hp < this.maxHp) {
        const bw = 30, bh = 4;
        const hp = this.hp / this.maxHp;
        ctx.save(); ctx.translate(-bw/2, -this.radius - 10);
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, bw, bh);
        const hg = ctx.createLinearGradient(0, 0, bw * hp, 0);
        hg.addColorStop(0, '#ff0000'); hg.addColorStop(0.5, '#ff9900'); hg.addColorStop(1, '#00ff00');
        ctx.fillStyle = hg; ctx.fillRect(0, 0, bw * hp, bh);
        ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1; ctx.strokeRect(0, 0, bw, bh);
        ctx.restore();
      }

      // #1 Stamina bar (below player)
      if (this.stamina < this.maxStamina) {
        const bw = 30, bh = 3;
        ctx.save(); ctx.translate(-bw/2, this.radius + 6);
        ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(0, 0, bw, bh);
        ctx.fillStyle = '#ffdd00'; ctx.fillRect(0, 0, bw * (this.stamina / this.maxStamina), bh);
        ctx.restore();
      }

      // #3 Active Reload window indicator (pulsing ring)
      if (this.activeReloadWindow > 0) {
        const t = Math.sin(Date.now() * 0.015);
        ctx.strokeStyle = `rgba(0,255,136,${0.6 + t * 0.4})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, this.radius + 10, 0, Math.PI * 2); ctx.stroke();
      }

      ctx.restore();
    }

    drawLaserSight(ctx, world) {
      if (!this.hasLaserSight) return;
      const aimX = Input.mouse.x + world.camera.x;
      const aimY = Input.mouse.y + world.camera.y;
      const angle = Math.atan2(aimY - this.y, aimX - this.x);
      ctx.save();
      ctx.strokeStyle = 'rgba(255,0,0,0.5)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.x + Math.cos(angle) * 800, this.y + Math.sin(angle) * 800);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  // Enemy with A* Pathfinding
  class Enemy {
    constructor(x, y, type, hp, speed) {
      this.x = x;
      this.y = y;
      this.type = type;
      this.hp = hp;
      this.maxHp = hp;
      this.speed = speed;
      this.radius = type === "boss" ? 28 : type === "tank" ? 22 : type === "slime" ? 14 : 11;
      this.fireTimer = randRange(0.5, 2);
      this.bossSpawnTimer = 0;
      this.dead = false;
      // New enemy type fields
      this.teleportTimer = randRange(3, 6);   // #22 Teleporter
      this.mimicRevealed = false;             // #20 Mimic
      this.isShielded = type === "shielded";  // #26 Shielded
      this.toxicTrail = [];                   // #27 Toxic Crawler trail
      this.toxicTimer = 0;
      this.bountyMarked = false;              // #38 Bounty
      this.isElite = false;                   // #28 Elite
      this.hunterVisible = type !== "hunter"; // #25 Hunter - starts invisible
      this.hunterTimer = 0;
      this.isBomber = type === "bomber";      // #24 Suicide Bomber
      this.bomberGlowTimer = 0;
      // A* pathfinding
      this.path = [];
      this.pathIndex = 0;
      this.pathRecalcTimer = CONFIG.pathRecalcInterval; // Start with timer expired to calculate path immediately
      this.hasCalculatedPath = false;
      
      Log.info("Enemy spawned: " + type + " with " + Math.round(hp) + " HP");
    }

    calculatePath(world, targetX = null, targetY = null) {
      const endX = targetX !== null ? targetX : world.player.x;
      const endY = targetY !== null ? targetY : world.player.y;
      
      // Convert current position to tile coordinates for validation
      const startTileX = Math.floor(this.x / world.tileSize);
      const startTileY = Math.floor(this.y / world.tileSize);
      
      // If we're on a wall, try to find a nearby walkable tile
      if (startTileX >= 0 && startTileX < world.mapW && startTileY >= 0 && startTileY < world.mapH &&
          world.map[startTileY * world.mapW + startTileX] === 1) {
        // Find nearest walkable tile
        let found = false;
        for (let radius = 1; radius <= 3 && !found; radius++) {
          for (let tx = startTileX - radius; tx <= startTileX + radius && !found; tx++) {
            for (let ty = startTileY - radius; ty <= startTileY + radius && !found; ty++) {
              if (tx >= 0 && tx < world.mapW && ty >= 0 && ty < world.mapH) {
                if (world.map[ty * world.mapW + tx] === 0) {
                  this.x = tx * world.tileSize + world.tileSize / 2;
                  this.y = ty * world.tileSize + world.tileSize / 2;
                  found = true;
                }
              }
            }
          }
        }
      }
      
      this.path = world.findPathAStar(this.x, this.y, endX, endY);
      if (this.path.length === 0) {
        // Only log if this is the first path calculation attempt
        if (!this.hasCalculatedPath) {
          Log.warn(`No path found for ${this.type} enemy`);
        }
      } else {
        // Skip first node if it's too close to current position
        if (this.path.length > 1) {
          const firstNode = this.path[0];
          const distToFirst = Math.hypot(firstNode.x - this.x, firstNode.y - this.y);
          if (distToFirst < 10) {
            this.pathIndex = 1;
          } else {
            this.pathIndex = 0;
          }
        } else {
      this.pathIndex = 0;
        }
      }
      this.pathIndex = Math.max(0, Math.min(this.pathIndex, this.path.length - 1));
      this.hasCalculatedPath = true;
    }

    update(dt, world) {
      const p = world.getNearestLivingPlayer(this.x, this.y) || world.player;
      const dx = p.x - this.x, dy = p.y - this.y;
      const d = Math.hypot(dx, dy) || 1;

      let vx = 0, vy = 0;

      if (this.type === "ranged") {
        // Ranged enemies: use A* pathfinding (same logic as basic enemies)
        this.pathRecalcTimer += dt;
        
        const needsRecalc = !this.hasCalculatedPath || 
                           this.path.length === 0 || 
                           this.pathIndex >= this.path.length || 
                           this.pathRecalcTimer >= CONFIG.pathRecalcInterval;
        
        if (needsRecalc) {
          this.pathRecalcTimer = 0;
          this.calculatePath(world);
        }
        
        if (this.path.length > 0 && this.pathIndex < this.path.length) {
          const target = this.path[this.pathIndex];
          const tdx = target.x - this.x;
          const tdy = target.y - this.y;
          const td = Math.hypot(tdx, tdy);
          
          if (td < 16) {
            // Reached current node, move to next
            this.pathIndex++;
            // If we've reached the end of the path, recalculate
            if (this.pathIndex >= this.path.length) {
              this.pathRecalcTimer = CONFIG.pathRecalcInterval;
            }
          } else {
            // Move toward current path node
            vx = (tdx / td) * this.speed;
            vy = (tdy / td) * this.speed;
          }
        } else {
          // Fallback to direct movement if no path found
          vx = (dx / d) * this.speed;
          vy = (dy / d) * this.speed;
        }
        
        // Attack if in range (ranged attack behavior)
        const optimalDistance = 175;
        if (d <= optimalDistance) {
          this.fireTimer -= dt;
          if (this.fireTimer <= 0) {
            this.fireTimer = randRange(0.8, 1.5);
            const dmg = 15 * (1 - (p.armor || 0));
            p.hp -= dmg;
            Log.info(`RANGED ATTACK! Player took ${Math.round(dmg)} damage. HP: ${Math.round(p.hp)}`);
            world.spawnParticles(p.x, p.y, 5, "#ff6600");
            sfxHit();
            
            if (p === world.player && p.hp <= 0) {
              world.gameOver();
            }
          }
        }
      } 
      else if (this.type === "boss") {
        // Boss: use A* pathfinding
        this.pathRecalcTimer += dt;
        
        const needsRecalc = !this.hasCalculatedPath || 
                           this.path.length === 0 || 
                           this.pathIndex >= this.path.length || 
                           this.pathRecalcTimer >= CONFIG.pathRecalcInterval;
        
        if (needsRecalc) {
          this.pathRecalcTimer = 0;
          this.calculatePath(world);
        }
        
        if (this.path.length > 0 && this.pathIndex < this.path.length) {
          const target = this.path[this.pathIndex];
          const tdx = target.x - this.x;
          const tdy = target.y - this.y;
          const td = Math.hypot(tdx, tdy);
          
          if (td < 16) {
            // Reached current node, move to next
            this.pathIndex++;
            // If we've reached the end of the path, recalculate
            if (this.pathIndex >= this.path.length) {
              this.pathRecalcTimer = CONFIG.pathRecalcInterval;
            }
          } else {
            // Move toward current path node
            vx = (tdx / td) * this.speed;
            vy = (tdy / td) * this.speed;
          }
        } else {
          // Fallback to direct movement
          vx = (dx / d) * this.speed;
          vy = (dy / d) * this.speed;
        }
        
        this.bossSpawnTimer += dt;
        if (this.bossSpawnTimer >= 10) {
          this.bossSpawnTimer = 0;
          
          if (world.enemies.length < CONFIG.maxEnemies - 5) {
            Log.info("BOSS SPAWNING MINIONS!");
            for (let i = 0; i < 5; i++) {
              const angle = (Math.PI * 2 / 5) * i;
              const spawnDist = 80;
              const spawnX = this.x + Math.cos(angle) * spawnDist;
              const spawnY = this.y + Math.sin(angle) * spawnDist;
              world.spawnEnemyAt(spawnX, spawnY, "basic", 50, 65);
            }
          } else {
            Log.warn("Boss minion spawn skipped - too many enemies");
          }
        }
      }
      else {
        // Basic and other enemies: use A* pathfinding
        this.pathRecalcTimer += dt;
        
        const needsRecalc = !this.hasCalculatedPath || 
                           this.path.length === 0 || 
                           this.pathIndex >= this.path.length || 
                           this.pathRecalcTimer >= CONFIG.pathRecalcInterval;
        
        if (needsRecalc) {
          this.pathRecalcTimer = 0;
          this.calculatePath(world);
        }
        
        if (this.path.length > 0 && this.pathIndex < this.path.length) {
          const target = this.path[this.pathIndex];
          const tdx = target.x - this.x;
          const tdy = target.y - this.y;
          const td = Math.hypot(tdx, tdy);
          
          if (td < 16) {
            // Reached current node, move to next
            this.pathIndex++;
            // If we've reached the end of the path, recalculate
            if (this.pathIndex >= this.path.length) {
              this.pathRecalcTimer = CONFIG.pathRecalcInterval;
            }
          } else {
            // Move toward current path node
            vx = (tdx / td) * this.speed;
            vy = (tdy / td) * this.speed;
          }
        } else {
          // Fallback to direct movement if no path found
          vx = (dx / d) * this.speed;
          vy = (dy / d) * this.speed;
        }
      }

      // Apply movement with collision detection
      if (vx !== 0 || vy !== 0) {
      const newX = this.x + vx * dt;
      const newY = this.y + vy * dt;

        // Try to move in X direction
        if (!world.checkCollision(newX, this.y, this.radius)) {
          this.x = newX;
        }
        
        // Try to move in Y direction
        if (!world.checkCollision(this.x, newY, this.radius)) {
          this.y = newY;
        }
      }

      // Clamp to map bounds
      this.x = clamp(this.x, this.radius, world.mapW * world.tileSize - this.radius);
      this.y = clamp(this.y, this.radius, world.mapH * world.tileSize - this.radius);

      // #20 Mimic: stays still until player within 100px
      if (this.type === "mimic" && !this.mimicRevealed) {
        const pp = world.getNearestLivingPlayer(this.x, this.y) || world.player;
        if (Math.hypot(pp.x - this.x, pp.y - this.y) < 100) {
          this.mimicRevealed = true;
          world.spawnParticles(this.x, this.y, 12, "#ffdd00");
        }
        return; // stay still
      }

      // #22 Teleporter: blinks behind player
      if (this.type === "teleporter") {
        this.teleportTimer -= dt;
        if (this.teleportTimer <= 0) {
          this.teleportTimer = randRange(3, 6);
          const p = world.getNearestLivingPlayer(this.x, this.y) || world.player;
          const angle = Math.random() * Math.PI * 2;
          const nx = p.x + Math.cos(angle) * 60;
          const ny = p.y + Math.sin(angle) * 60;
          if (!world.checkCollision(nx, ny, this.radius)) { this.x = nx; this.y = ny; }
          world.spawnParticles(this.x, this.y, 8, "#aa00ff");
        }
      }

      // #24 Suicide Bomber: flashes then explodes on contact
      if (this.isBomber) {
        this.bomberGlowTimer += dt;
        const p = world.getNearestLivingPlayer(this.x, this.y) || world.player;
        if (Math.hypot(p.x - this.x, p.y - this.y) < this.radius + p.radius + 10) {
          world.spawnParticles(this.x, this.y, 30, "#ff6600");
          const dmg = 60 * (1 - (p.armor || 0));
          p.hp -= dmg;
          sfxExplosion();
          // Screen shake
          if (world.screenShake !== undefined) world.screenShake = Math.max(world.screenShake, 12);
          this.dead = true;
          if (p === world.player && p.hp <= 0) world.gameOver();
          return;
        }
      }

      // #27 Toxic Crawler: leaves acid trail
      if (this.type === "toxic") {
        this.toxicTimer += dt;
        if (this.toxicTimer >= 0.4) {
          this.toxicTimer = 0;
          world.acidPools = world.acidPools || [];
          world.acidPools.push({ x: this.x, y: this.y, radius: 18, age: 0, lifetime: 5 });
        }
      }

      // #25 Hunter: invisible until close
      if (this.type === "hunter") {
        const p = world.getNearestLivingPlayer(this.x, this.y) || world.player;
        const d = Math.hypot(p.x - this.x, p.y - this.y);
        this.hunterVisible = d < 130;
      }
    }

    draw(ctx) {
      // #25 Hunter: only draw when visible
      if (this.type === "hunter" && !this.hunterVisible) {
        // Barely visible shimmer
        ctx.save(); ctx.globalAlpha = 0.12;
        ctx.fillStyle = "#aa00ff";
        ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        return;
      }

      // #20 Mimic: looks like a coin until revealed
      if (this.type === "mimic" && !this.mimicRevealed) {
        ctx.fillStyle = "#ffdd00"; ctx.strokeStyle = "#ffaa00";
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(this.x, this.y, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        return;
      }

      const colors = {
        basic: "#ff3366", ranged: "#ff6633", boss: "#aa0000",
        tank: "#662200", teleporter: "#aa00ff", mimic: "#ff3366",
        slime: "#00cc44", bomber: "#ff8800", hunter: "#330066",
        shielded: "#4488ff", toxic: "#44ff00", elite: "#ffdd00"
      };
      const col = this.isElite ? "#ffdd00" : (colors[this.type] || "#ff3366");

      // #28 Elite glow
      if (this.isElite) {
        ctx.save();
        ctx.shadowColor = "#ffdd00"; ctx.shadowBlur = 16;
        ctx.globalAlpha = 0.5 + Math.sin(Date.now() * 0.01) * 0.3;
        ctx.fillStyle = "#ffdd00";
        ctx.beginPath(); ctx.arc(this.x, this.y, this.radius + 5, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }

      ctx.fillStyle = col;
      ctx.strokeStyle = "#000"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();

      // #24 Bomber glow
      if (this.isBomber) {
        const t = Math.abs(Math.sin(this.bomberGlowTimer * 6));
        ctx.save(); ctx.globalAlpha = t * 0.6;
        ctx.fillStyle = "#ff4400";
        ctx.beginPath(); ctx.arc(this.x, this.y, this.radius + 8, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }

      // #26 Shielded indicator (front shield arc)
      if (this.isShielded) {
        ctx.save(); ctx.strokeStyle = "#4488ff"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.radius + 4, -Math.PI * 0.6, Math.PI * 0.6); ctx.stroke();
        ctx.restore();
      }

      // #38 Bounty marker
      if (this.bountyMarked) {
        ctx.save(); ctx.fillStyle = "#ffdd00"; ctx.font = "bold 12px monospace";
        ctx.textAlign = "center"; ctx.fillText("★", this.x, this.y - this.radius - 6);
        ctx.restore();
      }

      if (this.type === "ranged") {
        ctx.strokeStyle = "rgba(255, 153, 0, 0.3)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(this.x, this.y, 175, 0, Math.PI * 2); ctx.stroke();
      }

      if (this.hp < this.maxHp) {
        const barW = this.radius * 2, barH = 4;
        ctx.fillStyle = "rgba(0,0,0,0.8)";
        ctx.fillRect(this.x - this.radius, this.y + this.radius + 6, barW, barH);
        ctx.fillStyle = this.isElite ? "#ffdd00" : "#ff3366";
        ctx.fillRect(this.x - this.radius, this.y + this.radius + 6, (this.hp / this.maxHp) * barW, barH);
      }
    }

  // World
  class World {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.tileSize = CONFIG.tileSize;
      this.mapW = CONFIG.mapW;
      this.mapH = CONFIG.mapH;
      this.map = new Array(this.mapW * this.mapH).fill(0);
      
      this.generateMaze();
      
      this.player = new Player(this.mapW * this.tileSize / 2, this.mapH * this.tileSize / 2);
      this.enemies = [];
      this.bullets = [];
      this.loots = [];
      this.particles = [];
      this.wave = 0;
      this.isRunning = false;
      this.isLoggedIn = !!localStorage.getItem("codered-user");
      this.userName = localStorage.getItem("codered-user") || "Guest";
      this.totalPlayTime = 0;
      this.paused = false;
      this.cheatsUsed = false;
      this.camera = { x: 0, y: 0, w: canvas.width, h: canvas.height };
      this.spawnTimer = 0;
      this.waveTimer = 0;
      this.waveTimeLimit = 120;
      this.difficulty = "Normal";
      this.difficultySettings = {
        Easy: { enemySpeed: 0.7, spawnMult: 0.5, enemyHpMult: 0.75 },
        Normal: { enemySpeed: 1.0, spawnMult: 1.0, enemyHpMult: 1.0 },
        Hard: { enemySpeed: 1.3, spawnMult: 1.4, enemyHpMult: 1.4 },
        Nightmare: { enemySpeed: 1.6, spawnMult: 1.8, enemyHpMult: 1.7 }
      };
      this.multiplayerMode = "single";
      this.multiplayerClient = null;
      this.networkId = null;
      this.remotePlayers = new Map();
      this.networkStateTimer = 0;
      this.spawnRng = Math.random;
      this.gameStarted = false;

      // New world features
      this.screenShake = 0;            // #45 Screen Shake
      this.bloodStains = [];           // #46 Dynamic Blood
      this.acidPools = [];             // #27 Toxic Crawler trails
      this.shockTraps = [];            // #16 Shock Traps
      this.sentryTurrets = [];         // #17 Sentry Turrets
      this.medKits = [];               // #18 Medical Kits
      this.vendingMachines = [];       // #30 Vending Machines
      this.secretRooms = [];           // #34 Secret Rooms (glitch walls)
      this.luckMultiplier = 1;
      this.darknessFactor = 0;         // #33 Day/Night cycle
      this.darknessTimer = 0;
      this.gameMode = "survival";      // #49/#50 game modes
      this.bountyEnemy = null;         // #38 Bounty System
      this.bountyTimer = 0;
      this.dailyChallenges = this.loadDailyChallenges(); // #37
      this.bank = { stored: 0 };       // #39 Investment Bank
      this.totalShots = 0;             // #47 Stats
      this.totalHits = 0;
      this.totalDamageTaken = 0;
      this.totalDamageDealt = 0;
      this.emoteWheelOpen = false;     // #42 Emote wheel
      this.pvpMode = false;            // #50 PvP
    }

    loadDailyChallenges() {
      // #37 Daily Challenges
      const today = new Date().toDateString();
      const saved = JSON.parse(localStorage.getItem("codered-daily") || "{}");
      if (saved.date !== today) {
        const challenges = [
          { id: "kills50", desc: "Kill 50 enemies", target: 50, progress: 0, reward: 5, done: false },
          { id: "wave5", desc: "Reach Wave 5", target: 5, progress: 0, reward: 3, done: false },
          { id: "noDamage", desc: "Survive a wave without taking damage", target: 1, progress: 0, reward: 8, done: false }
        ];
        const data = { date: today, challenges };
        localStorage.setItem("codered-daily", JSON.stringify(data));
        return challenges;
      }
      return saved.challenges || [];
    }

    saveDailyChallenges() {
      const today = new Date().toDateString();
      localStorage.setItem("codered-daily", JSON.stringify({ date: today, challenges: this.dailyChallenges }));
    }

    generateMaze(seed = null) {
      const random = seed === null ? Math.random : createSeededRandom(seed);
      this.map.fill(1);
      const roomSize = 8, corridorWidth = 3;
      
      for (let ry = 0; ry < Math.floor(this.mapH / roomSize); ry++) {
        for (let rx = 0; rx < Math.floor(this.mapW / roomSize); rx++) {
          const roomX = rx * roomSize, roomY = ry * roomSize;
          for (let y = 1; y < roomSize - 1; y++) {
            for (let x = 1; x < roomSize - 1; x++) {
              const mx = roomX + x, my = roomY + y;
              if (mx > 0 && my > 0 && mx < this.mapW - 1 && my < this.mapH - 1) {
                this.map[my * this.mapW + mx] = 0;
              }
            }
          }
          if (rx < Math.floor(this.mapW / roomSize) - 1 && random() > 0.3) {
            for (let x = roomSize - 1; x < roomSize + corridorWidth; x++) {
              for (let y = Math.floor(roomSize / 3); y < Math.floor(roomSize * 2 / 3); y++) {
                const mx = roomX + x, my = roomY + y;
                if (mx > 0 && my > 0 && mx < this.mapW - 1 && my < this.mapH - 1) {
                  this.map[my * this.mapW + mx] = 0;
                }
              }
            }
          }
          if (ry < Math.floor(this.mapH / roomSize) - 1 && random() > 0.3) {
            for (let y = roomSize - 1; y < roomSize + corridorWidth; y++) {
              for (let x = Math.floor(roomSize / 3); x < Math.floor(roomSize * 2 / 3); x++) {
                const mx = roomX + x, my = roomY + y;
                if (mx > 0 && my > 0 && mx < this.mapW - 1 && my < this.mapH - 1) {
                  this.map[my * this.mapW + mx] = 0;
                }
              }
            }
          }
        }
      }
      
      const cx = Math.floor(this.mapW / 2), cy = Math.floor(this.mapH / 2);
      for (let yy = -6; yy <= 6; yy++) {
        for (let xx = -6; xx <= 6; xx++) {
          const idx = (cy + yy) * this.mapW + (cx + xx);
          if (idx >= 0 && idx < this.map.length) this.map[idx] = 0;
        }
      }
    }

    checkCollision(x, y, radius) {
      const points = [[x - radius, y], [x + radius, y], [x, y - radius], [x, y + radius]];
      for (const [px, py] of points) {
        const mx = Math.floor(px / this.tileSize), my = Math.floor(py / this.tileSize);
        if (mx < 0 || my < 0 || mx >= this.mapW || my >= this.mapH) return true;
        if (this.map[my * this.mapW + mx] === 1) return true;
      }
      return false;
    }

    resetMultiplayerWorld(seed) {
      this.generateMaze(seed);
      // Seed spawn RNG so enemy positions are identical on every client
      this.spawnRng = createSeededRandom(seed + 1);
      this.player.x = this.mapW * this.tileSize / 2;
      this.player.y = this.mapH * this.tileSize / 2;
      this.player.hp = this.player.maxHp;
      this.player.coins = 0;
      this.player.gems = 0;
      this.player.gems = 0;
      this.player.kills = 0;
      this.player.magAmmo = this.player.weapons[this.player.weaponIndex].magSize || this.player.magAmmo;
      this.enemies = [];
      this.bullets = [];
      this.loots = [];
      this.particles = [];
      this.wave = 0;
      this.spawnTimer = 0;
      this.waveTimer = 0;
      this.isRunning = false;
      this.paused = false;
      this.remotePlayers.clear();
      this.networkStateTimer = 0;
    }

    startHostedMultiplayer(client) {
      this.multiplayerMode = "host";
      this.multiplayerClient = client;
      this.networkId = client.id;
      this.player.networkId = client.id;
      this.player.name = this.userName || "Host";
      this.resetMultiplayerWorld(client.seed || Date.now());
      // Peer simulation: host runs its own full simulation, same as guests
    }

    startGuestMultiplayer(client) {
      this.multiplayerMode = "guest";
      this.multiplayerClient = client;
      this.networkId = client.id;
      this.player.networkId = client.id;
      this.player.name = this.userName || "Player";
      this.resetMultiplayerWorld(client.seed || Date.now());
      // Peer simulation: guest runs its own full simulation, same as host
    }

    addRemotePlayer(playerInfo) {
      if (!playerInfo || playerInfo.id === this.networkId || this.remotePlayers.has(playerInfo.id)) return;
      const spawnOffset = 80 + this.remotePlayers.size * 45;
      const player = new Player(
        this.mapW * this.tileSize / 2 + spawnOffset,
        this.mapH * this.tileSize / 2,
        {
          name: playerInfo.name || "Player",
          networkId: playerInfo.id,
          color: playerInfo.color || "#00ff88",
          applyUpgrades: false
        }
      );
      this.remotePlayers.set(playerInfo.id, player);
    }

    removeRemotePlayer(playerId) {
      this.remotePlayers.delete(playerId);
    }

    getLivingPlayers() {
      return [this.player, ...this.remotePlayers.values()].filter(player => player && player.hp > 0);
    }

    getNearestLivingPlayer(x, y) {
      let nearest = null;
      let nearestDist = Infinity;
      for (const player of this.getLivingPlayers()) {
        const distance = dist2(x, y, player.x, player.y);
        if (distance < nearestDist) {
          nearest = player;
          nearestDist = distance;
        }
      }
      return nearest;
    }

    // Peer simulation: broadcast only this client's own player state
    createPlayerState() {
      return {
        id: this.networkId,
        name: this.player.name,
        x: this.player.x,
        y: this.player.y,
        hp: this.player.hp,
        maxHp: this.player.maxHp,
        kills: this.player.kills,
        weaponIndex: this.player.weaponIndex,
        color: this.player.color,
        secondaryColor: this.player.secondaryColor,
        wave: this.wave
      };
    }

    // Apply a remote player's broadcasted state to their avatar
    applyRemotePlayerState(state) {
      if (!state || !state.id || state.id === this.networkId) return;
      let remote = this.remotePlayers.get(state.id);
      if (!remote) {
        remote = new Player(state.x, state.y, {
          name: state.name || "Player",
          networkId: state.id,
          color: state.color || "#00ff88",
          applyUpgrades: false
        });
        this.remotePlayers.set(state.id, remote);
      }
      // Smoothly interpolate position for rendering
      remote.x = state.x;
      remote.y = state.y;
      remote.hp = state.hp;
      remote.maxHp = state.maxHp || remote.maxHp;
      remote.kills = state.kills || 0;
      remote.weaponIndex = state.weaponIndex || 0;
      remote.color = state.color || remote.color;
      remote.secondaryColor = state.secondaryColor || remote.secondaryColor;
      remote.name = state.name || remote.name;
    }

    // Working A* Pathfinding for Code Red: Survival

findPathAStar(startX, startY, endX, endY) {
  // Convert pixel coordinates to grid coordinates
  let startTile = [Math.floor(startX / this.tileSize), Math.floor(startY / this.tileSize)];
  let endTile = [Math.floor(endX / this.tileSize), Math.floor(endY / this.tileSize)];

  // Validate and clamp start position
  startTile[0] = Math.max(0, Math.min(this.mapW - 1, startTile[0]));
  startTile[1] = Math.max(0, Math.min(this.mapH - 1, startTile[1]));
  
  // Validate and clamp end position
  endTile[0] = Math.max(0, Math.min(this.mapW - 1, endTile[0]));
  endTile[1] = Math.max(0, Math.min(this.mapH - 1, endTile[1]));

  // If start is on a wall, find nearest walkable tile
  if (this.map[startTile[1] * this.mapW + startTile[0]] === 1) {
    let found = false;
    for (let radius = 1; radius <= 3 && !found; radius++) {
      for (let tx = startTile[0] - radius; tx <= startTile[0] + radius && !found; tx++) {
        for (let ty = startTile[1] - radius; ty <= startTile[1] + radius && !found; ty++) {
          if (tx >= 0 && tx < this.mapW && ty >= 0 && ty < this.mapH) {
            if (this.map[ty * this.mapW + tx] === 0) {
              startTile = [tx, ty];
              found = true;
            }
          }
        }
      }
    }
    if (!found) return [];
  }

  // If end is on a wall, find nearest walkable tile
  if (this.map[endTile[1] * this.mapW + endTile[0]] === 1) {
    let found = false;
    let bestDist = Infinity;
    let bestTile = endTile;
    
    // Search in a spiral around the end position
    for (let radius = 1; radius <= 5 && !found; radius++) {
      for (let tx = endTile[0] - radius; tx <= endTile[0] + radius; tx++) {
        for (let ty = endTile[1] - radius; ty <= endTile[1] + radius; ty++) {
          if (tx >= 0 && tx < this.mapW && ty >= 0 && ty < this.mapH) {
            if (this.map[ty * this.mapW + tx] === 0) {
              const dist = Math.abs(tx - endTile[0]) + Math.abs(ty - endTile[1]);
              if (dist < bestDist) {
                bestDist = dist;
                bestTile = [tx, ty];
                found = true;
              }
            }
          }
        }
      }
      if (found) break;
    }
    if (!found) return [];
    endTile = bestTile;
  }
  
  // If start and end are the same, return direct path
  if (startTile[0] === endTile[0] && startTile[1] === endTile[1]) {
    return [{
      x: endTile[0] * this.tileSize + this.tileSize / 2,
      y: endTile[1] * this.tileSize + this.tileSize / 2
    }];
  }

  // Heuristic function (Manhattan distance)
  const heuristic = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
  
  // Helper to create unique key for a tile
  const keyFor = (tile) => `${tile[0]},${tile[1]}`;

  // Priority queue (open set)
  const openSet = [];
  const openSetKeys = new Set();
  
  // Closed set
  const closedSet = new Set();
  
  // Track where we came from
  const cameFrom = new Map();
  
  // Cost from start to each node
  const gScore = new Map();
  
  // Estimated total cost from start to end through this node
  const fScore = new Map();

  // Initialize starting node
  const startKey = keyFor(startTile);
  openSet.push(startTile);
  openSetKeys.add(startKey);
  gScore.set(startKey, 0);
  fScore.set(startKey, heuristic(startTile, endTile));

  let iterations = 0;
  const maxIterations = this.mapW * this.mapH; // Limit iterations

  while (openSet.length > 0 && iterations < maxIterations) {
    iterations++;
    
    // Find node with lowest fScore
    let lowestIndex = 0;
    let lowestF = fScore.get(keyFor(openSet[0])) || Infinity;
    
    for (let i = 1; i < openSet.length; i++) {
      const currentF = fScore.get(keyFor(openSet[i])) || Infinity;
      if (currentF < lowestF) {
        lowestIndex = i;
        lowestF = currentF;
      }
    }

    const current = openSet[lowestIndex];
    const currentKey = keyFor(current);

    // Check if we reached the goal
    if (current[0] === endTile[0] && current[1] === endTile[1]) {
      // Reconstruct path
      const path = [];
      let node = current;
      
      while (node) {
        path.unshift({
          x: node[0] * this.tileSize + this.tileSize / 2,
          y: node[1] * this.tileSize + this.tileSize / 2
        });
        node = cameFrom.get(keyFor(node));
      }
      
      return path;
    }

    // Move current from open to closed set
    openSet.splice(lowestIndex, 1);
    openSetKeys.delete(currentKey);
    closedSet.add(currentKey);

    // Check all neighbors (4-directional: up, down, left, right)
    const neighbors = [
      [current[0] - 1, current[1]], // left
      [current[0] + 1, current[1]], // right
      [current[0], current[1] - 1], // up
      [current[0], current[1] + 1]  // down
    ];

    for (const neighbor of neighbors) {
      const neighborKey = keyFor(neighbor);
      
      // Skip if already evaluated
      if (closedSet.has(neighborKey)) continue;
      
      // Check bounds
      if (neighbor[0] < 0 || neighbor[0] >= this.mapW || 
          neighbor[1] < 0 || neighbor[1] >= this.mapH) {
        continue;
      }
      
      // Check if walkable (not a wall)
      if (this.map[neighbor[1] * this.mapW + neighbor[0]] === 1) {
        continue;
      }

      // Calculate tentative gScore
      const tentativeG = (gScore.get(currentKey) || Infinity) + 1;

      // Check if this path is better
      if (!gScore.has(neighborKey) || tentativeG < gScore.get(neighborKey)) {
        // This path is the best so far
        cameFrom.set(neighborKey, current);
        gScore.set(neighborKey, tentativeG);
        fScore.set(neighborKey, tentativeG + heuristic(neighbor, endTile));

        // Add to open set if not already there
        if (!openSetKeys.has(neighborKey)) {
          openSet.push(neighbor);
          openSetKeys.add(neighborKey);
        }
      }
    }
  }

  // No path found (pathfinding failed - this is handled by the caller)
  return [];
}

    spawnEnemy(type) {
      const rng = this.spawnRng;
      const cx = this.mapW * this.tileSize / 2;
      const cy = this.mapH * this.tileSize / 2;
      for (let attempts = 0; attempts < 20; attempts++) {
        const angle = rng() * Math.PI * 2;
        const dist = 500 + rng() * 300;
        let x = cx + Math.cos(angle) * dist;
        let y = cy + Math.sin(angle) * dist;
        x = clamp(x, 32, this.mapW * this.tileSize - 32);
        y = clamp(y, 32, this.mapH * this.tileSize - 32);
        if (!this.checkCollision(x, y, 12)) {
          const mult = this.difficultySettings[this.difficulty];
          let hp, speed;
          if (type === "boss") {
            hp = 500 + rng() * 1500; speed = 55 * mult.enemySpeed;
          } else if (type === "tank") {
            hp = (80 + this.wave * 8) * mult.enemyHpMult; speed = 40 * mult.enemySpeed;
          } else if (type === "bomber") {
            hp = (12 + this.wave) * mult.enemyHpMult; speed = 90 * mult.enemySpeed;
          } else {
            hp = (18 + this.wave * 2.5) * mult.enemyHpMult; speed = 65 * mult.enemySpeed;
          }
          const e = new Enemy(x, y, type, hp, speed);
          this.enemies.push(e);
          return e;
        }
      }
      return null;
    }

    spawnEnemyAt(x, y, type, hp, speed) {
      if (!this.checkCollision(x, y, 12)) {
        this.enemies.push(new Enemy(x, y, type, hp, speed));
      }
    }

    calculateEnemyCount() {
      return this.wave;
    }

    startWave() {
      this.wave++;
      this.isRunning = true;
      this.spawnTimer = 0;
      this.waveTimer = 0;
      this.waveTimeLimit = 120;

      // #33 Day/Night: after every 5 waves darkness increases
      this.darknessFactor = Math.min(0.85, Math.floor(this.wave / 5) * 0.12);

      Log.info("Wave " + this.wave + " started!");

      // #38 Bounty: random marked enemy each wave
      this.bountyTimer = randRange(5, 15);

      if (this.wave % 10 === 0) {
        this.spawnEnemy("boss");
        // #25 Hunter boss every 15 waves
        if (this.wave % 15 === 0) this.spawnEnemy("hunter");
        UI.showToast("🔥 BOSS WAVE " + this.wave + "! 🔥");
      } else {
        const enemyCount = this.wave;
        // Mix in new enemy types based on wave
        for (let i = 0; i < enemyCount; i++) {
          let type = "basic";
          const roll = this.spawnRng();
          if (this.wave >= 3 && roll < 0.15) type = "teleporter";
          else if (this.wave >= 4 && roll < 0.28) type = "toxic";
          else if (this.wave >= 5 && roll < 0.38) type = "slime";
          else if (this.wave >= 6 && roll < 0.46) type = "bomber";
          else if (this.wave >= 7 && roll < 0.52) type = "shielded";
          else if (this.wave >= 8 && roll < 0.56) type = "mimic";
          else if (this.wave >= 9 && roll < 0.60) type = "tank";
          else if (roll < 0.8) type = this.spawnRng() < 0.5 ? "basic" : "ranged";
          const e = this.spawnEnemy(type);
          // #28 Elite: 10% chance on wave 5+
          if (this.wave >= 5 && e && this.spawnRng() < 0.10) {
            e.isElite = true;
            e.hp *= 2; e.maxHp = e.hp;
            e.speed *= 1.3;
          }
        }
        UI.showToast("Wave " + this.wave + " - " + this.waveTimeLimit + "s - " + enemyCount + " enemies!");
      }

      // #49 No-walls gamemode: spawn at 0.1s intervals (handled in update)
      if (this.gameMode === "nowalls") {
        UI.showToast("⚡ NO-WALLS MODE: Ultra-fast spawn!");
      }
    }

    async gameOver() {
      if (this.isRunning === false && this.paused === true) return;
      this.isRunning = false;
      this.paused = true;

      const stats = {
        shotsFired: this.totalShots || 0,
        shotsHit: this.totalHits || 0,
        damageDealt: Math.round(this.totalDamageDealt || 0),
        damageTaken: Math.round(this.totalDamageTaken || 0),
        accuracy: (this.totalShots || 0) > 0 ? Math.round(((this.totalHits || 0) / this.totalShots) * 100) : 0
      };

      if (this.multiplayerMode !== "single") {
        UI.showGameOver("Multiplayer Run Ended", this.player.kills, Math.floor(this.player.coins), stats);
        return;
      }

      const upgrades = PermanentUpgrades.load();
      upgrades.redGems = (upgrades.redGems || 0) + (this.player.redGems || 0);
      upgrades.rainbowCrystals = (upgrades.rainbowCrystals || 0) + (this.player.rainbowCrystals || 0);
      PermanentUpgrades.save(upgrades);

      const sd = Save.load();
      sd.coins += Math.floor(this.player.coins);
      if (this.wave > sd.bestWave) sd.bestWave = this.wave;
      Save.save(sd);

      if (!this.cheatsUsed) {
        await Leaderboard.addScore(this.userName, this.wave, this.difficulty, this.player.kills);
        UI.showGameOver(this.player?.hp <= 0 ? "YOU DIED!" : this.wave, this.player.kills, Math.floor(this.player.coins), stats);
      } else {
        UI.showGameOver(this.player?.hp <= 0 ? "YOU DIED!" : this.wave, this.player.kills, Math.floor(this.player.coins), stats);
        UI.showToast("⚠️ Cheats Used - Score Not Submitted to Leaderboard");
      }
    }

    endWave() {
      this.isRunning = false;
      this.enemies = [];
      const sd = Save.load();
      const coinReward = 20 + 2 * (this.wave - 1);
      sd.coins += coinReward;
      this.player.coins += coinReward;
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 25);
      if (this.wave > sd.bestWave) sd.bestWave = this.wave;

      // #39 Investment Bank: 5% interest on stored coins per wave
      if (this.bank.stored > 0) {
        const interest = Math.floor(this.bank.stored * 0.05);
        this.bank.stored += interest;
        if (interest > 0) UI.showToast(`🏦 Bank interest: +${interest} coins stored`);
      }

      // #37 No-damage challenge
      if (this.dailyChallenges) {
        const c = this.dailyChallenges.find(ch => ch.id === "noDamage");
        if (c && !c.done && this.totalDamageTaken === 0) {
          c.progress = 1; c.done = true;
          this._grantDailyReward(c);
        }
      }

      Save.save(sd);
      UI.showToast(`Wave ${this.wave} complete! +${coinReward} coins and +25 HP. Press SPACE for next wave!`);
    }

    update(dt) {
      if (this.paused) return;

      // Peer simulation broadcast
      if (this.multiplayerMode !== "single" && this.multiplayerClient) {
        this.networkStateTimer += dt;
        if (this.networkStateTimer >= 1 / 20) {
          this.networkStateTimer = 0;
          this.multiplayerClient.sendSnapshot(this.createPlayerState());
        }
      }

      if (!this.isLoggedIn) {
        this.totalPlayTime += dt;
        if (this.totalPlayTime >= 450) {
          this.gameOver();
          UI.showToast("Guest time limit reached! Login to continue.");
          return;
        }
      }

      // #45 Screen Shake decay
      this.screenShake = Math.max(0, (this.screenShake || 0) - dt * 40);

      // #42 Emote wheel (G key toggle)
      if (Input.keys['g'] && !this._emoteKeyPressed) {
        this._emoteKeyPressed = true;
        this.toggleEmoteWheel();
      }
      if (!Input.keys['g']) this._emoteKeyPressed = false;

      // #14 Homing Missile fire (M key)
      if (Input.keys['m'] && !this._missileKeyPressed && (this.player.homingMissiles || 0) > 0) {
        this._missileKeyPressed = true;
        this.player.homingMissiles--;
        const angle = Math.atan2(Input.mouse.y + this.camera.y - this.player.y, Input.mouse.x + this.camera.x - this.player.x);
        this.bullets.push({
          x: this.player.x, y: this.player.y,
          vx: Math.cos(angle) * 500, vy: Math.sin(angle) * 500,
          dmg: 120, owner: "player", radius: 6, travel: 0, maxTravel: 2000,
          isHoming: true
        });
        UI.showToast("🚀 Homing Missile fired! (" + this.player.homingMissiles + " left)");
      }
      if (!Input.keys['m']) this._missileKeyPressed = false;

      if (!this.isRunning && Input.keys[' ']) {
        if (this.multiplayerMode !== "single") {
          if (this.multiplayerClient) this.multiplayerClient.startMatch();
        } else if (this.gameStarted) {
          this.startWave();
        }
      }

      if (this.isRunning) {
        this.waveTimer += dt;
        if (this.waveTimer >= this.waveTimeLimit) {
          this.endWave();
          return;
        }

        // #49 No-Walls mode: blazing fast spawn rate (1 per 0.1s)
        const spawnInterval = this.gameMode === "nowalls" ? 0.1 : CONFIG.spawnDelay;
        this.spawnTimer += dt;
        if (this.spawnTimer >= spawnInterval && this.enemies.length < CONFIG.maxEnemies) {
          this.spawnTimer = 0;
          if (this.wave % 10 !== 0) {
            const roll = Math.random();
            let type = roll < 0.5 ? "basic" : "ranged";
            if (this.wave >= 3 && roll < 0.12) type = "teleporter";
            else if (this.wave >= 4 && roll < 0.22) type = "toxic";
            else if (this.wave >= 5 && roll < 0.30) type = "bomber";
            this.spawnEnemy(type);
          }
        }

        // #36 Escalating Hazards: flood tiles after wave 20
        if (this.wave >= 20) {
          this.floodTimer = (this.floodTimer || 0) + dt;
          if (this.floodTimer >= 8) {
            this.floodTimer = 0;
            this.floodLevel = (this.floodLevel || 0) + 1;
            UI.showToast("⚠️ FLOODING! Level " + this.floodLevel);
          }
          // Flood damages player standing on low tiles
          if ((this.floodLevel || 0) > 0) {
            const dmg = 4 * dt * (this.floodLevel || 0);
            this.player.hp -= dmg * (1 - (this.player.armor || 0));
            if (this.player.hp <= 0) this.gameOver();
          }
        }

        // #38 Bounty: mark a random enemy each wave
        if (this.bountyTimer > 0) {
          this.bountyTimer -= dt;
          if (this.bountyTimer <= 0 && this.enemies.length > 0) {
            const idx = Math.floor(Math.random() * this.enemies.length);
            this.enemies[idx].bountyMarked = true;
            UI.showToast("★ BOUNTY TARGET MARKED! +50 coins on kill!");
          }
        }

        // #37 Daily Challenges progress
        this._updateDailyChallenges();
      }

      this.player.update(dt, this);

      // #50 PvP mode: remote players can damage each other
      if (this.pvpMode && this.multiplayerMode !== "single") {
        for (const rp of this.remotePlayers.values()) {
          for (const b of this.bullets) {
            if (b.owner === "player" && dist2(b.x, b.y, rp.x, rp.y) < (b.radius + rp.radius) ** 2) {
              rp.hp -= b.dmg;
              this.spawnParticles(rp.x, rp.y, 5, "#ff4444");
            }
          }
        }
      }

      // --- Bullet updates ---
      for (let i = this.bullets.length - 1; i >= 0; i--) {
        const b = this.bullets[i];

        if (b.isLaser) {
          const range = 1200;
          b.age += dt;
          if (b.age >= b.lifetime) { this.bullets.splice(i, 1); continue; }
          for (let j = this.enemies.length - 1; j >= 0; j--) {
            const e = this.enemies[j];
            const dx = e.x - b.source.x, dy = e.y - b.source.y;
            const dot = dx * Math.cos(b.angle) + dy * Math.sin(b.angle);
            if (dot > 0 && dot < range) {
              const perp = Math.abs(dx * Math.sin(b.angle) - dy * Math.cos(b.angle));
              if (perp < e.radius + 15) {
                e.hp -= b.dmg * dt * 10;
                this.totalDamageDealt = (this.totalDamageDealt || 0) + b.dmg * dt * 10;
                if (e.hp <= 0) this._killEnemy(e, i);
              }
            }
          }
          continue;
        }

        // #14 Homing Missiles: curve toward nearest enemy
        if (b.isHoming && this.enemies.length > 0) {
          let nearestE = null, nearestD = Infinity;
          for (const e of this.enemies) {
            const d = dist2(b.x, b.y, e.x, e.y);
            if (d < nearestD) { nearestD = d; nearestE = e; }
          }
          if (nearestE) {
            const angle = Math.atan2(nearestE.y - b.y, nearestE.x - b.x);
            const curAngle = Math.atan2(b.vy, b.vx);
            let diff = angle - curAngle;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            const newAngle = curAngle + diff * Math.min(1, dt * 4);
            const spd = Math.hypot(b.vx, b.vy);
            b.vx = Math.cos(newAngle) * spd;
            b.vy = Math.sin(newAngle) * spd;
          }
        }

        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.travel += Math.hypot(b.vx * dt, b.vy * dt);

        // #12 Grenade explosion on wall/max travel
        if (b.isGrenade && (b.travel > b.maxTravel || this.checkCollision(b.x, b.y, b.radius))) {
          this.screenShake = Math.max(this.screenShake, 18);
          sfxExplosion();
          this.spawnParticles(b.x, b.y, 25, "#ff8800");
          // Splash damage to enemies
          for (const e of this.enemies) {
            const d = Math.hypot(e.x - b.x, e.y - b.y);
            if (d < 90) {
              const falloff = 1 - d / 90;
              e.hp -= b.dmg * falloff;
              this.totalDamageDealt = (this.totalDamageDealt || 0) + b.dmg * falloff;
              if (e.hp <= 0) this._killEnemy(e, -1);
            }
          }
          this.bullets.splice(i, 1);
          continue;
        }

        if (b.travel > b.maxTravel || this.checkCollision(b.x, b.y, b.radius)) {
          this.bullets.splice(i, 1);
        }
      }

      if (this.bullets.length > CONFIG.maxBullets) this.bullets.splice(0, this.bullets.length - CONFIG.maxBullets);

      // --- Enemy updates ---
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const e = this.enemies[i];
        e.update(dt, this);
        if (e.dead) {
          // #23 Splitting Slimes: split into two smaller ones on death
          if (e.type === "slime" && !e.hasSplit && e.radius > 7) {
            for (let s = 0; s < 2; s++) {
              const mini = new Enemy(e.x + (s ? 20 : -20), e.y, "slime", e.maxHp * 0.4, e.speed * 1.3);
              mini.radius = 7; mini.hasSplit = true;
              this.enemies.push(mini);
            }
          }
          this.enemies.splice(i, 1);
        }
      }

      // --- Particles ---
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.age += dt;
        if (p.age >= p.life) { this.particles.splice(i, 1); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 100 * dt;
      }
      if (this.particles.length > CONFIG.maxParticles) this.particles.splice(0, this.particles.length - CONFIG.maxParticles);

      // --- Loot age ---
      for (let i = this.loots.length - 1; i >= 0; i--) {
        const l = this.loots[i];
        l.age += dt;
        if (l.age >= l.lifetime) this.loots.splice(i, 1);
      }

      // #27 Acid pools update
      this.acidPools = this.acidPools || [];
      for (let i = this.acidPools.length - 1; i >= 0; i--) {
        const pool = this.acidPools[i];
        pool.age += dt;
        if (pool.age >= pool.lifetime) { this.acidPools.splice(i, 1); continue; }
        const d = Math.hypot(this.player.x - pool.x, this.player.y - pool.y);
        if (d < pool.radius + this.player.radius) {
          this.player.hp -= 8 * dt * (1 - (this.player.armor || 0));
          if (this.player.hp <= 0) this.gameOver();
        }
      }

      // #16 Shock Traps update
      this.shockTraps = this.shockTraps || [];
      for (let i = this.shockTraps.length - 1; i >= 0; i--) {
        const trap = this.shockTraps[i];
        trap.age += dt;
        if (trap.age >= trap.lifetime) { this.shockTraps.splice(i, 1); continue; }
        for (const e of this.enemies) {
          if (Math.hypot(e.x - trap.x, e.y - trap.y) < trap.radius) {
            e.stunTimer = (e.stunTimer || 0) + dt;
            e.hp -= 5 * dt;
            if (e.hp <= 0) this._killEnemy(e, -1);
          }
        }
      }

      // #17 Sentry Turrets update
      this.sentryTurrets = this.sentryTurrets || [];
      for (let i = this.sentryTurrets.length - 1; i >= 0; i--) {
        const turret = this.sentryTurrets[i];
        turret.age += dt;
        if (turret.age >= turret.lifetime) { this.sentryTurrets.splice(i, 1); continue; }
        turret.fireTimer = (turret.fireTimer || 0) - dt;
        if (turret.fireTimer <= 0 && this.enemies.length > 0) {
          turret.fireTimer = 0.8;
          let nearest = null, nearestD = Infinity;
          for (const e of this.enemies) {
            const d = dist2(turret.x, turret.y, e.x, e.y);
            if (d < nearestD && d < 350 * 350) { nearestD = d; nearest = e; }
          }
          if (nearest) {
            const angle = Math.atan2(nearest.y - turret.y, nearest.x - turret.x);
            this.bullets.push({ x: turret.x, y: turret.y, vx: Math.cos(angle) * 700, vy: Math.sin(angle) * 700,
              dmg: 35, owner: "player", radius: 4, travel: 0, maxTravel: 400 });
          }
        }
      }

      // #18 Medical Kits update
      this.medKits = this.medKits || [];
      for (let i = this.medKits.length - 1; i >= 0; i--) {
        const kit = this.medKits[i];
        kit.age += dt;
        if (kit.age >= kit.lifetime) { this.medKits.splice(i, 1); continue; }
        kit.healTimer = (kit.healTimer || 0) - dt;
        if (kit.healTimer <= 0) {
          kit.healTimer = 1;
          const allPlayers = [this.player, ...this.remotePlayers.values()];
          for (const p of allPlayers) {
            if (Math.hypot(p.x - kit.x, p.y - kit.y) < kit.radius + 40) {
              p.hp = Math.min(p.maxHp, p.hp + 5);
            }
          }
        }
      }

      // T key: deploy shock trap; Y key: deploy sentry; H key: use med kit (if owned)
      if (Input.keys['t'] && !this._trapKeyPressed && (this.player.shockTraps || 0) > 0) {
        this._trapKeyPressed = true;
        this.player.shockTraps--;
        this.shockTraps.push({ x: this.player.x, y: this.player.y, radius: 60, age: 0, lifetime: 15 });
        sfxTrap();
        UI.showToast("⚡ Shock Trap deployed!");
      }
      if (!Input.keys['t']) this._trapKeyPressed = false;

      if (Input.keys['y'] && !this._sentryKeyPressed && (this.player.sentryTurrets || 0) > 0) {
        this._sentryKeyPressed = true;
        this.player.sentryTurrets--;
        this.sentryTurrets.push({ x: this.player.x + 40, y: this.player.y, age: 0, lifetime: 30, fireTimer: 0 });
        UI.showToast("🤖 Sentry Turret deployed!");
      }
      if (!Input.keys['y']) this._sentryKeyPressed = false;

      if (Input.keys['h'] && !this._medKeyPressed && (this.player.medKits || 0) > 0) {
        this._medKeyPressed = true;
        this.player.medKits--;
        this.medKits.push({ x: this.player.x, y: this.player.y, radius: 12, age: 0, lifetime: 20, healTimer: 0 });
        UI.showToast("💊 Med Kit deployed!");
      }
      if (!Input.keys['h']) this._medKeyPressed = false;

      // --- Bullet-Enemy collision ---
      for (let i = this.bullets.length - 1; i >= 0; i--) {
        const b = this.bullets[i];
        if (b.owner === "player") {
          for (let j = this.enemies.length - 1; j >= 0; j--) {
            const e = this.enemies[j];
            // #26 Shielded: only take damage from behind
            if (e.isShielded) {
              const p = this.getNearestLivingPlayer(e.x, e.y) || this.player;
              const angleToPlayer = Math.atan2(p.y - e.y, p.x - e.x);
              const angleToBullet = Math.atan2(b.y - e.y, b.x - e.x);
              let diff = Math.abs(angleToBullet - angleToPlayer);
              if (diff > Math.PI) diff = Math.PI * 2 - diff;
              if (diff < Math.PI * 0.65) { this.bullets.splice(i, 1); break; } // blocked from front
            }
            const colDist = (b.radius + e.radius) ** 2;
            if (dist2(b.x, b.y, e.x, e.y) < colDist) {
              e.hp -= b.dmg;
              this.totalDamageDealt = (this.totalDamageDealt || 0) + b.dmg;
              this.totalHits = (this.totalHits || 0) + 1;
              this.bullets.splice(i, 1);
              this.spawnParticles(b.x, b.y, 5, "#ffcc88");
              // #46 Dynamic Blood stain
              this.bloodStains.push({ x: e.x + randRange(-8, 8), y: e.y + randRange(-8, 8), r: randRange(4, 10), age: 0, lifetime: 60 });
              if (e.hp <= 0) {
                this._killEnemy(e, j);
                this.screenShake = Math.max(this.screenShake || 0, 5);
              } else { sfxHit(); }
              break;
            }
          }
        } else if (b.owner === "enemy") {
          const tp = this.getNearestLivingPlayer(b.x, b.y);
          if (tp && !tp.dashInvulnerable && dist2(b.x, b.y, tp.x, tp.y) < (b.radius + tp.radius) ** 2) {
            const dmg = b.dmg * (1 - (tp.armor || 0));
            tp.hp -= dmg;
            this.totalDamageTaken = (this.totalDamageTaken || 0) + dmg;
            this.bullets.splice(i, 1);
            this.spawnParticles(tp.x, tp.y, 10, "#ffaaaa");
            this.screenShake = Math.max(this.screenShake || 0, 6);
            sfxHit();
            // #40 Revive: in multiplayer, player goes "down" instead of dying
            if (tp === this.player && tp.hp <= 0) {
              if (this.multiplayerMode !== "single" && !this.player.isDown) {
                this.player.isDown = true;
                this.player.hp = 0;
                this.player.reviveTimer = 10;
                UI.showToast("💀 You are DOWN! Teammate can revive you!");
              } else {
                this.gameOver();
              }
            }
          }
        }
      }

      // Enemy contact damage
      for (const e of this.enemies) {
        const tp = this.getNearestLivingPlayer(e.x, e.y);
        if (!tp) continue;
        const dist = Math.hypot(tp.x - e.x, tp.y - e.y);
        if (dist < e.radius + tp.radius) {
          if (tp.dashInvulnerable) continue;
          let rawDmg = (e.type === "boss" ? 50 : e.type === "tank" ? 35 : 25) * dt;
          const dmg = rawDmg * (1 - (tp.armor || 0));
          tp.hp -= dmg;
          this.totalDamageTaken = (this.totalDamageTaken || 0) + dmg;
          if (Math.random() < 0.3) this.spawnParticles(tp.x, tp.y, 2, "#ff0000");
          if (tp === this.player && tp.hp <= 0) {
            if (this.multiplayerMode !== "single" && !this.player.isDown) {
              this.player.isDown = true; this.player.hp = 0; this.player.reviveTimer = 10;
              UI.showToast("💀 You are DOWN! Teammate can revive you!");
            } else { this.gameOver(); }
          }
        }
      }

      // #40 Revive timer countdown + teammate revive
      if (this.player.isDown) {
        this.player.reviveTimer -= dt;
        if (this.player.reviveTimer <= 0) { this.gameOver(); return; }
        for (const rp of this.remotePlayers.values()) {
          if (Math.hypot(rp.x - this.player.x, rp.y - this.player.y) < 50) {
            this.player.isDown = false;
            this.player.hp = Math.floor(this.player.maxHp * 0.35);
            sfxRevive();
            UI.showToast("✅ Revived by teammate!");
            break;
          }
        }
      }

      // Loot pickup
      for (let i = this.loots.length - 1; i >= 0; i--) {
        const l = this.loots[i];
        const pr = l.radius + this.player.radius + (12 * (this.player.pickupRadius || 1));
        if (l.age >= (l.pickupDelay || 0) && dist2(l.x, l.y, this.player.x, this.player.y) < pr * pr) {
          if (l.type === "coin") this.player.coins += l.value;
          else if (l.type === "gem") this.player.gems += l.value;
          else if (l.type === "redGem") this.player.redGems = (this.player.redGems || 0) + l.value;
          else if (l.type === "rainbowCrystal") this.player.rainbowCrystals = (this.player.rainbowCrystals || 0) + l.value;
          else if (l.type === "health") this.player.hp = Math.min(this.player.maxHp, this.player.hp + l.value);
          this.loots.splice(i, 1);
          sfxPickup();
        }
      }

      if (this.isRunning && this.waveTimer >= this.waveTimeLimit) this.endWave();

      // Camera with #45 screen shake offset
      const shakeX = this.screenShake > 0 ? (Math.random() - 0.5) * this.screenShake : 0;
      const shakeY = this.screenShake > 0 ? (Math.random() - 0.5) * this.screenShake : 0;
      const targetX = clamp(this.player.x - this.camera.w / 2, 0, this.mapW * this.tileSize - this.camera.w) + shakeX;
      const targetY = clamp(this.player.y - this.camera.h / 2, 0, this.mapH * this.tileSize - this.camera.h) + shakeY;
      this.camera.x += (targetX - this.camera.x) * 0.1;
      this.camera.y += (targetY - this.camera.y) * 0.1;

      this.updateHTMLHUD();
      UI.updateHUD(this);
    }

    // #47 Daily challenge tracker
    _updateDailyChallenges() {
      if (!this.dailyChallenges) return;
      for (const c of this.dailyChallenges) {
        if (c.done) continue;
        if (c.id === "kills50") {
          c.progress = this.player.kills;
          if (c.progress >= c.target) { c.done = true; this._grantDailyReward(c); }
        }
        if (c.id === "wave5") {
          c.progress = this.wave;
          if (c.progress >= c.target) { c.done = true; this._grantDailyReward(c); }
        }
      }
      this.saveDailyChallenges();
    }

    _grantDailyReward(c) {
      const upgrades = PermanentUpgrades.load();
      upgrades.rainbowCrystals = (upgrades.rainbowCrystals || 0) + c.reward;
      PermanentUpgrades.save(upgrades);
      UI.showToast("🏆 Challenge done: " + c.desc + "! +" + c.reward + " 🌈");
    }

    // Centralized kill handler
    _killEnemy(e, bulletIdx) {
      if (e.dead) return;
      e.dead = true;
      this.player.kills++;

      // #44 Co-op Finisher: if boss and multiplayer, big flash
      if (e.type === "boss" && this.multiplayerMode !== "single") {
        UI.showToast("🔥 CO-OP FINISHER! Boss destroyed together!");
        this.screenShake = Math.max(this.screenShake || 0, 30);
        for (let i = 0; i < 5; i++) setTimeout(() => this.spawnParticles(e.x, e.y, 20, "#ffdd00"), i * 80);
      }

      // #38 Bounty bonus
      if (e.bountyMarked) {
        this.player.coins += 50;
        UI.showToast("★ BOUNTY COLLECTED! +50 coins!");
      }

      const lootCount = e.type === "boss" ? 14 : (e.isElite ? 8 : 4 + Math.floor(Math.random() * 4));
      for (let k = 0; k < lootCount; k++) {
        const rand = Math.random() * this.luckMultiplier;
        let lootType = "coin", value = 1;
        if (rand < 0.40) { lootType = "coin"; value = 1 + Math.floor(Math.random() * 3); }
        else if (rand < 0.65) { lootType = "gem"; value = 1; }
        else if (rand < 0.90) { lootType = "rainbowCrystal"; value = 1; }
        else if (rand < 0.94) { lootType = "redGem"; value = 1; }
        else { lootType = "redGem"; value = 4; }
        this.loots.push({ x: e.x + randRange(-12, 12), y: e.y + randRange(-12, 12),
          type: lootType, value, radius: lootType === "rainbowCrystal" ? 10 : lootType === "redGem" ? 9 : 7,
          age: 0, lifetime: 30, pickupDelay: lootType === "rainbowCrystal" ? 0.5 : 0.12 });
      }
      this.spawnParticles(e.x, e.y, 20, e.type === "boss" ? "#ff0000" : "#ff8888");
      sfxExplosion();
      this.screenShake = Math.max(this.screenShake || 0, e.type === "boss" ? 22 : 5);
    }

    // #42 Emote wheel
    toggleEmoteWheel() {
      this.emoteWheelOpen = !this.emoteWheelOpen;
      let wheel = document.getElementById("emoteWheel");
      if (!wheel) {
        wheel = document.createElement("div");
        wheel.id = "emoteWheel";
        wheel.style.cssText = "position:fixed;bottom:120px;right:20px;background:rgba(0,0,0,0.85);border:2px solid #00d9ff;border-radius:12px;padding:10px;z-index:500;display:flex;flex-direction:column;gap:6px;";
        const emotes = [
          { label: "👋 Hi!", msg: "Hi!" },
          { label: "❤️ Thanks!", msg: "Thanks!" },
          { label: "🔥 Follow me!", msg: "Follow me!" },
          { label: "⚠️ Help!", msg: "Help!" }
        ];
        emotes.forEach(em => {
          const btn = document.createElement("button");
          btn.textContent = em.label;
          btn.style.cssText = "background:#001a22;color:#fff;border:1px solid #00d9ff;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:13px;";
          btn.onclick = () => {
            if (this.multiplayerClient) this.multiplayerClient.send({ type: "emote", msg: em.msg });
            UI.showToast("You: " + em.msg);
            this.toggleEmoteWheel();
          };
          wheel.appendChild(btn);
        });
        document.body.appendChild(wheel);
      }
      wheel.style.display = this.emoteWheelOpen ? "flex" : "none";
    }
    
    updateHTMLHUD() {
      try {
        if (document.getElementById('waveNumber')) {
          document.getElementById('waveNumber').textContent = this.wave;
        }
        
        if (document.getElementById('healthBar')) {
          const healthPercent = Math.max(0, (this.player.hp / this.player.maxHp) * 100);
          document.getElementById('healthBar').style.width = `${healthPercent}%`;
          document.getElementById('healthBar').style.backgroundColor = 
            healthPercent > 60 ? '#00ff88' : healthPercent > 30 ? '#ffaa00' : '#ff3366';
        }
        
        if (document.getElementById('coinCount')) {
          document.getElementById('coinCount').textContent = Math.floor(this.player.coins);
        }
        if (document.getElementById('gemCount')) {
          document.getElementById('gemCount').textContent = Math.floor(this.player.gems);
        }
        if (document.getElementById('redGemCount')) {
          document.getElementById('redGemCount').textContent = Math.floor(this.player.redGems);
        }
        if (document.getElementById('rainbowCrystalCount')) {
          document.getElementById('rainbowCrystalCount').textContent = Math.floor(this.player.rainbowCrystals);
        }
        
        const armorDisplay = document.getElementById('armorDisplay');
        if (armorDisplay) {
          if (this.player.armor > 0) {
            armorDisplay.style.display = 'block';
            const armorPercent = Math.min(100, (this.player.armor / 0.75) * 100);
            document.getElementById('armorBar').style.width = `${armorPercent}%`;
          } else {
            armorDisplay.style.display = 'none';
          }
        }
      } catch (e) {
        console.error('Error updating HTML HUD:', e);
      }
    }

    draw() {
      const ctx = this.ctx;
      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      ctx.save();
      ctx.translate(-this.camera.x, -this.camera.y);
      this.drawWorld(ctx);
      // #13 Laser Sight drawn in world space
      this.player.drawLaserSight(ctx, this);
      ctx.restore();

      // #33 Day/Night darkness overlay (after world, before HUD)
      if ((this.darknessFactor || 0) > 0) {
        ctx.save();
        ctx.fillStyle = `rgba(0,0,0,${this.darknessFactor})`;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        // Spotlight around player
        const px = this.player.x - this.camera.x;
        const py = this.player.y - this.camera.y;
        const spotlight = ctx.createRadialGradient(px, py, 30, px, py, 220);
        spotlight.addColorStop(0, "rgba(0,0,0,0)");
        spotlight.addColorStop(1, `rgba(0,0,0,${this.darknessFactor})`);
        ctx.globalCompositeOperation = "destination-out";
        ctx.fillStyle = spotlight;
        ctx.beginPath(); ctx.arc(px, py, 220, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = "source-over";
        ctx.restore();
      }

      // #40 Player-down overlay
      if (this.player.isDown) {
        ctx.save();
        ctx.fillStyle = "rgba(180,0,0,0.35)";
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.fillStyle = "#ff3366"; ctx.font = "bold 28px monospace";
        ctx.textAlign = "center";
        ctx.fillText("💀 YOU ARE DOWN — TEAMMATE REVIVING...", this.canvas.width / 2, this.canvas.height / 2 - 20);
        ctx.fillStyle = "#fff"; ctx.font = "18px monospace";
        ctx.fillText(`${Math.ceil(this.player.reviveTimer)}s until death`, this.canvas.width / 2, this.canvas.height / 2 + 20);
        ctx.restore();
      }

      ctx.fillStyle = "white";
      ctx.font = "bold 18px monospace";
      ctx.save();
      ctx.fillStyle = 'rgba(20, 20, 30, 0.85)';
      ctx.strokeStyle = '#00d9ff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(20, 20, 220, 100, 10); ctx.fill(); ctx.stroke();
      ctx.font = 'bold 16px "Segoe UI", sans-serif'; ctx.fillStyle = '#ffffff';
      const hpPercent = this.player.hp / this.player.maxHp;
      const hpColor = hpPercent > 0.6 ? '#00ff88' : hpPercent > 0.3 ? '#ffaa00' : '#ff3366';
      ctx.fillText('HEALTH:', 40, 45); ctx.fillStyle = hpColor;
      ctx.fillText(`${Math.round(this.player.hp)}/${this.player.maxHp}`, 120, 45);
      ctx.fillStyle = '#ffffff'; ctx.fillText('COINS:', 40, 70); ctx.fillStyle = '#ffdd00';
      ctx.fillText(Math.floor(this.player.coins), 120, 70);
      ctx.fillStyle = '#ffffff'; ctx.fillText('KILLS:', 40, 95); ctx.fillStyle = '#00d9ff';
      ctx.fillText(this.player.kills, 120, 95);
      ctx.restore();

      // #1 Stamina bar in HUD (top right corner)
      if (this.player.stamina < this.player.maxStamina) {
        ctx.save();
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(this.canvas.width - 130, 20, 110, 14);
        ctx.fillStyle = "#ffdd00";
        ctx.fillRect(this.canvas.width - 130, 20, 110 * (this.player.stamina / this.player.maxStamina), 14);
        ctx.fillStyle = "#fff"; ctx.font = "11px monospace"; ctx.textAlign = "center";
        ctx.fillText("STAMINA", this.canvas.width - 75, 31);
        ctx.restore();
      }

      ctx.save();
      ctx.font = 'bold 22px "Segoe UI", sans-serif';
      ctx.fillStyle = 'rgba(0, 217, 255, 0.9)';
      ctx.textAlign = 'center';
      if (this.isRunning) {
        const timeLeft = this.waveTimeLimit - this.waveTimer;
        const mins = Math.floor(timeLeft / 60);
        const secs = Math.floor(timeLeft % 60).toString().padStart(2, '0');
        // #33 Day/Night label
        const darknessLabel = (this.darknessFactor || 0) > 0 ? ` 🌙` : "";
        ctx.fillText(`WAVE ${this.wave} - ${mins}:${secs}${darknessLabel}`, this.canvas.width / 2, 40);
      } else {
        ctx.fillText(`PRESS SPACE TO START WAVE ${this.wave + 1}`, this.canvas.width / 2, 40);
      }
      ctx.restore();
      this.drawMinimap(ctx);
    }

    drawWorld(ctx) {
      const cam = this.camera;
      const startX = Math.max(0, Math.floor(cam.x / this.tileSize) - 1);
      const endX = Math.min(this.mapW, Math.ceil((cam.x + cam.w) / this.tileSize) + 1);
      const startY = Math.max(0, Math.floor(cam.y / this.tileSize) - 1);
      const endY = Math.min(this.mapH, Math.ceil((cam.y + cam.h) / this.tileSize) + 1);
      
      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const tx = x * this.tileSize, ty = y * this.tileSize;
          if (this.map[y * this.mapW + x] === 1) {
            ctx.fillStyle = "#3a3a2a";
            ctx.fillRect(tx, ty, this.tileSize, this.tileSize);
            ctx.fillStyle = "#4a4a3a";
            ctx.fillRect(tx, ty, this.tileSize, this.tileSize / 3);
            ctx.strokeStyle = "#2a2a1a";
            ctx.lineWidth = 1;
            ctx.strokeRect(tx, ty, this.tileSize, this.tileSize);
          } else {
            // #36 Flood visual: blue tint on floor tiles
            const isFlooded = (this.floodLevel || 0) > 0;
            ctx.fillStyle = isFlooded
              ? `rgba(0,80,200,${Math.min(0.5, (this.floodLevel || 0) * 0.08)})`
              : ((x + y) % 2 === 0) ? "#0e0e0e" : "#111111";
            ctx.fillRect(tx, ty, this.tileSize, this.tileSize);
          }
        }
      }

      // #46 Dynamic Blood stains
      for (const s of this.bloodStains) {
        const alpha = Math.max(0, 0.4 * (1 - s.age / s.lifetime));
        ctx.save(); ctx.globalAlpha = alpha;
        ctx.fillStyle = "#880000";
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      // Age blood stains
      for (let i = this.bloodStains.length - 1; i >= 0; i--) {
        this.bloodStains[i].age += 0.016;
        if (this.bloodStains[i].age >= this.bloodStains[i].lifetime) this.bloodStains.splice(i, 1);
      }

      // #27 Acid pools
      for (const pool of this.acidPools) {
        const alpha = Math.max(0, 0.55 * (1 - pool.age / pool.lifetime));
        ctx.save(); ctx.globalAlpha = alpha;
        ctx.fillStyle = "#44ff00";
        ctx.beginPath(); ctx.arc(pool.x, pool.y, pool.radius, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }

      // #16 Shock Traps
      for (const trap of (this.shockTraps || [])) {
        ctx.save(); ctx.globalAlpha = 0.5 + Math.sin(Date.now() * 0.01) * 0.2;
        ctx.strokeStyle = "#ffdd00"; ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.arc(trap.x, trap.y, trap.radius, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "#ffdd00"; ctx.font = "bold 14px monospace"; ctx.textAlign = "center";
        ctx.fillText("⚡", trap.x, trap.y + 5);
        ctx.restore();
      }

      // #17 Sentry Turrets
      for (const turret of (this.sentryTurrets || [])) {
        ctx.save();
        ctx.fillStyle = "#00d9ff"; ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(turret.x, turret.y, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#ffffff"; ctx.font = "bold 12px monospace"; ctx.textAlign = "center";
        ctx.fillText("🤖", turret.x, turret.y + 5);
        ctx.restore();
      }

      // #18 Med Kits
      for (const kit of (this.medKits || [])) {
        ctx.save();
        ctx.fillStyle = "#ff3366"; ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(kit.x, kit.y, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#ffffff"; ctx.font = "bold 14px monospace"; ctx.textAlign = "center";
        ctx.fillText("💊", kit.x, kit.y + 5);
        ctx.restore();
      }
      
      for (const l of this.loots) {
        const bounce = Math.abs(Math.sin(l.age * 5)) * 3;
        // distinct colors for different loot types (including rainbow crystals)
        if (l.type === "coin") {
          ctx.fillStyle = "#ffdd00";
          ctx.strokeStyle = "#ffaa00";
        } else if (l.type === "gem") {
          ctx.fillStyle = "#00ff88";
          ctx.strokeStyle = "#00cc66";
        } else if (l.type === "redGem") {
          ctx.fillStyle = "#ff4444";
          ctx.strokeStyle = "#cc0000";
        } else if (l.type === "rainbowCrystal") {
          ctx.fillStyle = "#ff66ff";
          ctx.strokeStyle = "#aa00ff";
        } else if (l.type === "health") {
          ctx.fillStyle = "#88ccff";
          ctx.strokeStyle = "#66aaff";
        } else {
          ctx.fillStyle = "#ff0000";
          ctx.strokeStyle = "#aa0000";
        }
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(l.x, l.y - bounce, l.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      
      for (const b of this.bullets) {
        if (b.isLaser) {
          const range = 1200;
          const endX2 = b.source.x + Math.cos(b.angle) * range;
          const endY2 = b.source.y + Math.sin(b.angle) * range;
          ctx.save(); ctx.globalAlpha = 0.8;
          ctx.strokeStyle = "#00ff00"; ctx.lineWidth = 8; ctx.lineCap = "round";
          ctx.shadowColor = "#00ff00"; ctx.shadowBlur = 15;
          ctx.beginPath(); ctx.moveTo(b.source.x, b.source.y); ctx.lineTo(endX2, endY2); ctx.stroke();
          ctx.restore();
        } else if (b.isGrenade) {
          ctx.fillStyle = "#ff8800"; ctx.strokeStyle = "#ffcc00"; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(b.x, b.y, b.radius + 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        } else if (b.isCrossbow) {
          ctx.save(); ctx.strokeStyle = "#aaddff"; ctx.lineWidth = 3;
          const angle = Math.atan2(b.vy, b.vx);
          ctx.beginPath();
          ctx.moveTo(b.x - Math.cos(angle) * 10, b.y - Math.sin(angle) * 10);
          ctx.lineTo(b.x + Math.cos(angle) * 10, b.y + Math.sin(angle) * 10);
          ctx.stroke(); ctx.restore();
        } else if (b.isHoming) {
          ctx.fillStyle = "#ff00ff"; ctx.strokeStyle = "#aa00aa"; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(b.x, b.y, b.radius + 1, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        } else {
          ctx.fillStyle = b.owner === "player" ? "#ffff00" : "#ff3366";
          ctx.strokeStyle = b.owner === "player" ? "#ffaa00" : "#aa0000";
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }
      }

      for (const e of this.enemies) e.draw(ctx);
      this.player.draw(ctx);
      if (this.multiplayerMode !== "single") {
        this.drawPlayerName(ctx, this.player);
        for (const player of this.remotePlayers.values()) {
          player.draw(ctx);
          this.drawPlayerName(ctx, player);
        }
      }

      for (const p of this.particles) {
        const t = 1 - (p.age / p.life);
        ctx.globalAlpha = t; ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * t, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    drawPlayerName(ctx, player) {
      ctx.save();
      ctx.font = 'bold 13px "Segoe UI", sans-serif';
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(0,0,0,0.75)";
      const name = player.name || "Player";
      const width = ctx.measureText(name).width + 12;
      ctx.fillRect(player.x - width / 2, player.y - player.radius - 30, width, 18);
      ctx.fillStyle = player.color || "#00d9ff";
      ctx.fillText(name, player.x, player.y - player.radius - 16);
      ctx.restore();
    }

    drawMinimap(ctx) {
      const size = 180, pad = 12;
      const x = this.canvas.width - size - pad;
      const y = this.canvas.height - size - pad;
      
      ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
      ctx.fillRect(x, y, size, size);
      ctx.strokeStyle = "rgba(0, 217, 255, 0.7)";
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, size, size);
      
      const sx = size / (this.mapW * this.tileSize);
      const sy = size / (this.mapH * this.tileSize);
      
      ctx.fillStyle = "#555";
      for (let yy = 0; yy < this.mapH; yy += 2) {
        for (let xx = 0; xx < this.mapW; xx += 2) {
          if (this.map[yy * this.mapW + xx] === 1) {
            ctx.fillRect(x + xx * this.tileSize * sx, y + yy * this.tileSize * sy, 2, 2);
          }
        }
      }
      
      ctx.fillStyle = "#ff3366";
      for (const e of this.enemies) {
        const eSize = e.type === "boss" ? 5 : 3;
        ctx.fillRect(x + e.x * sx - eSize/2, y + e.y * sy - eSize/2, eSize, eSize);
      }
      
      ctx.fillStyle = "#00d9ff";
      ctx.shadowColor = "#00d9ff";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(x + this.player.x * sx, y + this.player.y * sy, 5, 0, Math.PI * 2);
      ctx.fill();
      for (const player of this.remotePlayers.values()) {
        ctx.beginPath();
        ctx.arc(x + player.x * sx, y + player.y * sy, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
    }

    spawnParticles(x, y, count, color) {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = randRange(50, 200);
        this.particles.push({
          x: x,
          y: y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          age: 0,
          life: randRange(0.2, 0.5),
          size: randRange(1, 3),
          color: color
        });
      }
    }
  }

  // UI
  const UI = {
    elements: {},
    
    init() {
      this.elements = {
        homeScreen: document.getElementById("homeScreen"),
        tutorialScreen: document.getElementById("tutorialScreen"),
        pauseScreen: document.getElementById("pauseScreen"),
        gameOverScreen: document.getElementById("gameOverScreen"),
        shopScreen: document.getElementById("shopScreen"),
        upgradesScreen: document.getElementById("upgradesScreen"),
        loadingScreen: document.getElementById("loadingScreen"),
        toast: document.getElementById("toast"),
        waveNumber: document.getElementById("waveNumber"),
        healthBar: document.getElementById("healthBar"),
        coinCount: document.getElementById("coinCount"),
        gemCount: document.getElementById("gemCount"),
        currentWeapon: document.getElementById("currentWeapon"),
        loadingProgress: document.getElementById("loadingProgress"),
        loadingText: document.getElementById("loadingText"),
        leaderboardScreen: this.createLeaderboardScreen()
        ,
        customizeScreen: document.getElementById("customizeScreen"),
        controlsScreen: document.getElementById("controlsScreen"),
        promoScreen: document.getElementById("promoScreen")
      };

      const multiplayerBtn = document.getElementById("multiplayerBtn");
      if (multiplayerBtn) {
        multiplayerBtn.addEventListener("click", () => {
          this.elements.homeScreen.style.display = "none";
          document.getElementById("multiplayerScreen").style.display = "flex";
          this.prepareMultiplayerPanel();
        });
      }

      const multiplayerBackBtn = document.getElementById("multiplayerBackBtn");
      if (multiplayerBackBtn) {
        multiplayerBackBtn.addEventListener("click", () => {
          document.getElementById("multiplayerScreen").style.display = "none";
          this.elements.homeScreen.style.display = "flex";
        });
      }

      const hostGameBtn = document.getElementById("hostGameBtn");
      if (hostGameBtn) {
        hostGameBtn.addEventListener("click", () => this.hostCloudGame());
      }

      const joinGameBtn = document.getElementById("joinGameBtn");
      if (joinGameBtn) {
        joinGameBtn.addEventListener("click", () => this.joinCloudGame());
      }

      const startHostedGameBtn = document.getElementById("startHostedGameBtn");
      if (startHostedGameBtn) {
        startHostedGameBtn.addEventListener("click", () => {
          if (window.game?.world?.multiplayerClient) {
            // Send startMatch — the server broadcasts matchStarted to ALL clients
            // including this one, so the wave starts uniformly for everyone
            window.game.world.multiplayerClient.startMatch();
          }
        });
      }

      const copyJoinCodeBtn = document.getElementById("copyJoinCodeBtn");
      if (copyJoinCodeBtn) {
        copyJoinCodeBtn.addEventListener("click", async () => {
          const code = (document.getElementById("lanJoinCode")?.textContent || "").trim();
          if (!/^[0-9A-Z]{7}$/.test(code)) {
            this.showToast("Host a game to get a code.");
            return;
          }
          await navigator.clipboard?.writeText(code);
          this.showToast("Join code copied");
        });
      }

      const joinCodeBtn = document.getElementById("joinCodeBtn");
      if (joinCodeBtn) {
        joinCodeBtn.addEventListener("click", () => this.joinWithCode());
      }

      const joinCodeInput = document.getElementById("joinCodeInput");
      if (joinCodeInput) {
        joinCodeInput.addEventListener("input", () => {
          joinCodeInput.value = joinCodeInput.value.toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 7);
        });
        joinCodeInput.addEventListener("keydown", event => {
          if (event.key === "Enter") this.joinWithCode();
        });
      }

      const customizeBtn = document.getElementById("customizeBtn");
      if (customizeBtn) {
        customizeBtn.addEventListener("click", () => {
          this.elements.homeScreen.style.display = "none";
          this.elements.customizeScreen.style.display = "flex";
          this.populateCustomize();
        });
      }

      const customizeCloseBtn = document.getElementById("customizeCloseBtn");
      if (customizeCloseBtn) {
        customizeCloseBtn.addEventListener("click", () => {
          this.elements.customizeScreen.style.display = "none";
          this.elements.homeScreen.style.display = "flex";
        });
      }
      const leaderboardBtn = document.getElementById("leaderboardBtn");
      if (leaderboardBtn) {
        leaderboardBtn.addEventListener("click", async () => {
          this.elements.homeScreen.style.display = "none";
          this.elements.leaderboardScreen.style.display = "flex";
          await this.updateLeaderboard();
        });
      }
      
      const upgradesBtn = document.getElementById("upgradesBtn");
      if (upgradesBtn) {
        upgradesBtn.addEventListener("click", () => {
          this.elements.homeScreen.style.display = "none";
          this.elements.upgradesScreen.style.display = "flex";
          this.populateUpgrades();
        });
      }
      
      const upgradesCloseBtn = document.getElementById("upgradesCloseBtn");
      if (upgradesCloseBtn) {
        upgradesCloseBtn.addEventListener("click", () => {
          this.elements.upgradesScreen.style.display = "none";
          this.elements.homeScreen.style.display = "flex";
        });
      }
      
      const controlsBtn = document.getElementById("controlsBtn");
      if (controlsBtn) {
        controlsBtn.addEventListener("click", () => {
          this.elements.homeScreen.style.display = "none";
          this.elements.controlsScreen.style.display = "flex";
          this.populateControls();
        });
      }
      
      const controlsCloseBtn = document.getElementById("controlsCloseBtn");
      if (controlsCloseBtn) {
        controlsCloseBtn.addEventListener("click", () => {
          this.elements.controlsScreen.style.display = "none";
          this.elements.homeScreen.style.display = "flex";
        });
      }
      
      const resetControlsBtn = document.getElementById("resetControlsBtn");
      if (resetControlsBtn) {
        resetControlsBtn.addEventListener("click", () => {
          const defaults = PermanentUpgrades.getDefaults();
          let upgrades = PermanentUpgrades.load();
          upgrades.controls = defaults.controls;
          PermanentUpgrades.save(upgrades);
          UI.showToast("Controls reset to defaults!");
          UI.populateControls();
        });
      }

        // Promo Codes button handlers
        const promoBtn = document.getElementById("promoBtn");
        if (promoBtn) {
          promoBtn.addEventListener("click", () => {
            this.elements.homeScreen.style.display = "none";
            if (this.elements.promoScreen) this.elements.promoScreen.style.display = "flex";
            this.populatePromoScreen();
          });
        }
        const promoCloseBtn = document.getElementById("promoCloseBtn");
        if (promoCloseBtn) {
          promoCloseBtn.addEventListener("click", () => {
            if (this.elements.promoScreen) this.elements.promoScreen.style.display = "none";
            this.elements.homeScreen.style.display = "flex";
          });
        }
        const promoRedeemBtn = document.getElementById("promoRedeemBtn");
        if (promoRedeemBtn) {
          promoRedeemBtn.addEventListener("click", () => {
            const val = (document.getElementById('promoInput') || { value: '' }).value || '';
            this.redeemPromo(val);
          });
        }

        const logoutBtn = document.getElementById("logoutBtn");
      if (logoutBtn) {
        this.loginBtn = logoutBtn;
        
        if (window.game && window.game.world) {
          logoutBtn.innerHTML = "🚪 Logout";
        } else {
          logoutBtn.innerHTML = "🚪 Login";
        }
        
        logoutBtn.addEventListener("click", () => {
          if (window.game && window.game.world) {
            this.handleLogout();
          } else {
            this.handleLogin();
          }
        });
      }
      
      // Load promo codes JSON for redemption (if available)
      // Initialize from JS fallback immediately to avoid race conditions
      this.promoCodes = window.PROMO_CODES || [];
      try {
        fetch('./promo_codes.json').then(r => {
          if (!r.ok) throw new Error('no-json');
          return r.json();
        }).then(data => { this.promoCodes = data || window.PROMO_CODES || []; }).catch(()=>{ this.promoCodes = window.PROMO_CODES || []; });
      } catch (e) {
        this.promoCodes = window.PROMO_CODES || [];
      }

      this.bindEvents();
      this.updateHomeStats();
      this.tryAutoJoinFromCode();
    },
    
    createLeaderboardScreen() {
      const screen = document.createElement("div");
      screen.id = "leaderboardScreen";
      screen.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.95);z-index:9999;display:none;align-items:flex-start;justify-content:flex-start;color:white;font-family:monospace;overflow-y:auto;";
      screen.innerHTML = `
        <div style="max-width:900px;width:100%;margin:40px auto;padding:20px;">
          <h2 style="text-align:center;color:#00d9ff;font-size:36px;margin-bottom:10px;">🏆 Global Leaderboard 🏆</h2>
          <p style="text-align:center;color:#aaa;margin-bottom:30px;">Top 50 Survivors - Compete Worldwide!</p>
          
          <div style="display:flex;gap:10px;margin-bottom:20px;justify-content:center;">
            <button id="filterAll" class="filter-btn active" style="padding:10px 20px;background:#00d9ff;color:#000;border:none;cursor:pointer;font-family:monospace;font-weight:bold;">All</button>
            <button id="filterEasy" class="filter-btn" style="padding:10px 20px;background:#333;color:#fff;border:none;cursor:pointer;font-family:monospace;">Easy</button>
            <button id="filterNormal" class="filter-btn" style="padding:10px 20px;background:#333;color:#fff;border:none;cursor:pointer;font-family:monospace;">Normal</button>
            <button id="filterHard" class="filter-btn" style="padding:10px 20px;background:#333;color:#fff;border:none;cursor:pointer;font-family:monospace;">Hard</button>
            <button id="filterNightmare" class="filter-btn" style="padding:10px 20px;background:#333;color:#fff;border:none;cursor:pointer;font-family:monospace;">Nightmare</button>
          </div>
          
          <div id="leaderboardLoading" style="text-align:center;color:#00d9ff;font-size:18px;padding:40px;">
            Loading leaderboard...
          </div>
          
          <div id="leaderboardContent" style="display:none;">
            <table id="leaderboardTable" style="width:100%;border-collapse:collapse;background:rgba(0,0,0,0.5);border:2px solid #00d9ff;">
              <thead>
                <tr style="background:#00d9ff;color:#000;">
                  <th style="padding:15px;text-align:left;font-weight:bold;">Rank</th>
                  <th style="padding:15px;text-align:left;font-weight:bold;">Player</th>
                  <th style="padding:15px;text-align:center;font-weight:bold;">Wave</th>
                  <th style="padding:15px;text-align:center;font-weight:bold;">Kills</th>
                  <th style="padding:15px;text-align:center;font-weight:bold;">Difficulty</th>
                  <th style="padding:15px;text-align:center;font-weight:bold;">Date</th>
                </tr>
              </thead>
              <tbody id="leaderboardTableBody"></tbody>
            </table>
            
            <div id="noScores" style="display:none;text-align:center;padding:40px;color:#aaa;font-size:18px;">
              No scores yet. Be the first to set a record!
            </div>
          </div>
          
          <div style="text-align:center;margin-top:30px;">
            <button id="leaderboardBackBtn" style="padding:15px 40px;background:#ff3366;color:#fff;border:none;cursor:pointer;font-family:monospace;font-size:18px;font-weight:bold;">Back to Menu</button>
          </div>
        </div>
      `;
      document.body.appendChild(screen);
      
      const filterBtns = screen.querySelectorAll('.filter-btn');
      filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          filterBtns.forEach(b => {
            b.classList.remove('active');
            b.style.background = '#333';
          });
          btn.classList.add('active');
          btn.style.background = '#00d9ff';
          
          const filter = btn.id.replace('filter', '');
          this.updateLeaderboard(filter === 'All' ? null : filter);
        });
      });
      
      document.getElementById("leaderboardBackBtn").addEventListener("click", () => {
        screen.style.display = "none";
        this.elements.homeScreen.style.display = "flex";
      });
      
      return screen;
    },

    async prepareMultiplayerPanel() {
      const status = document.getElementById("multiplayerStatus");
      const linksPanel = document.getElementById("hostLinksPanel");
      const playersPanel = document.getElementById("multiplayerPlayers");
      const startBtn = document.getElementById("startHostedGameBtn");
      if (status) status.textContent = "Host a room or enter a 7-character code. Friends can join from anywhere.";
      if (linksPanel) linksPanel.style.display = "none";
      if (playersPanel) playersPanel.style.display = "none";
      if (startBtn) startBtn.style.display = "none";
    },

    renderHostLinks(info) {
      const linksPanel = document.getElementById("hostLinksPanel");
      const lanJoinCode = document.getElementById("lanJoinCode");
      if (!linksPanel || !info) return;

      linksPanel.style.display = "block";
      if (lanJoinCode) {
        const code = info.roomCode || info.joinCode || "-------";
        lanJoinCode.textContent = code;
        lanJoinCode.style.letterSpacing = /^[0-9A-Z]{7}$/.test(code) ? "4px" : "0";
        lanJoinCode.style.fontSize = /^[0-9A-Z]{7}$/.test(code) ? "32px" : "18px";
      }
    },

    joinWithCode() {
      const input = document.getElementById("joinCodeInput");
      const code = input ? input.value.trim().toUpperCase() : "";
      this.joinCloudGame(code);
    },

    tryAutoJoinFromCode() {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("join");
      if (!code) return;
      const input = document.getElementById("joinCodeInput");
      if (input) input.value = code.toUpperCase();
      this.elements.homeScreen.style.display = "none";
      document.getElementById("multiplayerScreen").style.display = "flex";
      const status = document.getElementById("multiplayerStatus");
      if (status) status.textContent = "Joining from code...";
      setTimeout(() => this.joinCloudGame(code), 250);
    },

    updateMultiplayerPlayers(players = []) {
      const playersPanel = document.getElementById("multiplayerPlayers");
      if (!playersPanel) return;
      playersPanel.style.display = "block";
      playersPanel.innerHTML = `<strong style="color:#00d9ff;">Players</strong>` + players.map(player => `
        <div style="display:flex;align-items:center;gap:8px;margin-top:8px;">
          <span style="width:10px;height:10px;border-radius:50%;background:${player.color || '#00d9ff'};display:inline-block;"></span>
          <span>${player.name || 'Player'} ${player.role === 'host' ? '(host)' : ''}</span>
        </div>
      `).join("");
    },

    bindMultiplayerClient(client) {
      client.on("error", data => UI.showToast(data.message || "Multiplayer error"));
      client.on("closed", () => UI.showToast("Multiplayer connection closed"));
      client.on("lobby", data => UI.updateMultiplayerPlayers(data.players || []));
      client.on("hostAccepted", data => {
        const status = document.getElementById("multiplayerStatus");
        const startBtn = document.getElementById("startHostedGameBtn");
        if (status) status.textContent = `Hosting room ${data.roomCode || data.joinCode}. Share the code, then start the match.`;
        if (startBtn) startBtn.style.display = "block";
        UI.renderHostLinks(data);
        window.game.world.startHostedMultiplayer(client);
      });
      client.on("joinAccepted", data => {
        const status = document.getElementById("multiplayerStatus");
        if (status) status.textContent = data.matchStarted ? "Joined match." : "Joined lobby. Waiting for host to start.";
        window.game.world.startGuestMultiplayer(client);
        // If match already in progress, start immediately (no matchStarted event coming)
        if (data.matchStarted) {
          const multiplayerScreen = document.getElementById("multiplayerScreen");
          if (multiplayerScreen) multiplayerScreen.style.display = "none";
          const shopBtn = document.getElementById("shopButton");
          if (shopBtn) shopBtn.style.display = "block";
          window.game.world.gameStarted = true;
          window.game.world.startWave();
        }
      });
      client.on("guestJoined", data => {
        window.game.world.addRemotePlayer(data.player);
        UI.showToast((data.player?.name || "A player") + " joined");
      });
      client.on("guestLeft", data => window.game.world.removeRemotePlayer(data.playerId));
      // Peer simulation: snapshot now carries a single player's state, not the whole world
      client.on("snapshot", data => {
        if (data.snapshot && data.snapshot.id) {
          window.game.world.applyRemotePlayerState(data.snapshot);
        }
      });
      client.on("matchStarted", () => {
        // Hide multiplayer lobby and show game UI for everyone
        const multiplayerScreen = document.getElementById("multiplayerScreen");
        if (multiplayerScreen) multiplayerScreen.style.display = "none";
        const shopBtn = document.getElementById("shopButton");
        if (shopBtn) shopBtn.style.display = "block";
        // Start wave for ALL players — host and guests alike
        if (window.game?.world) {
          window.game.world.gameStarted = true;
          window.game.world.startWave();
          const mobileControls = document.getElementById('mobileControls');
          const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
                           window.matchMedia('(hover: none) and (pointer: coarse)').matches;
          if (mobileControls && isMobile) mobileControls.style.display = "block";
        }
      });
      client.on("hostClosed", () => {
        UI.showToast("Host closed the game");
        setTimeout(() => location.reload(), 1200);
      });
    },

    async hostCloudGame() {
      if (!window.MultiplayerClient) {
        UI.showToast("Multiplayer client missing");
        return;
      }
      const client = new MultiplayerClient();
      this.bindMultiplayerClient(client);
      const status = document.getElementById("multiplayerStatus");
      if (status) status.textContent = "Creating online room...";
      try {
        await client.hostGame({
          name: window.game.world.userName || "Host",
          color: window.game.world.player.color,
          seed: Date.now()
        });
      } catch (error) {
        if (status) status.textContent = "Could not create an online room. Try again.";
        UI.showToast(error.message);
      }
    },

    async joinCloudGame(roomCode = null) {
      if (!window.MultiplayerClient) {
        UI.showToast("Multiplayer client missing");
        return;
      }
      const input = document.getElementById("joinCodeInput");
      const code = (roomCode || (input ? input.value : "") || "").trim().toUpperCase();
      const client = new MultiplayerClient({ roomCode: code });
      this.bindMultiplayerClient(client);
      const status = document.getElementById("multiplayerStatus");
      if (status) status.textContent = "Joining online room...";
      try {
        await client.joinGame({
          code,
          name: window.game.world.userName || "Player",
          color: window.game.world.player.color
        });
      } catch (error) {
        if (status) status.textContent = "Could not join that room. Check the code and try again.";
        UI.showToast(error.message);
      }
    },
    
    async updateLeaderboard(difficultyFilter = null) {
      const loading = document.getElementById("leaderboardLoading");
      const content = document.getElementById("leaderboardContent");
      const tbody = document.getElementById("leaderboardTableBody");
      const noScores = document.getElementById("noScores");
      
      loading.style.display = "block";
      content.style.display = "none";
      
      try {
        const allScores = await Leaderboard.load();
        
        let scores = allScores;
        if (difficultyFilter) {
          scores = allScores.filter(s => s.difficulty === difficultyFilter);
        }
        
        loading.style.display = "none";
        content.style.display = "block";
        
        if (scores.length === 0) {
          tbody.innerHTML = "";
          noScores.style.display = "block";
          return;
        }
        
        noScores.style.display = "none";
        tbody.innerHTML = "";
        
        const difficultyColors = {
          Easy: '#4CAF50',
          Normal: '#2196F3',
          Hard: '#FF9800',
          Nightmare: '#f44336'
        };
        
        scores.forEach((score, index) => {
          const tr = document.createElement("tr");
          tr.style.cssText = "border-bottom:1px solid #333;transition:background 0.2s;";
          tr.onmouseover = () => tr.style.background = "rgba(0,217,255,0.1)";
          tr.onmouseout = () => tr.style.background = index < 3 ? "rgba(255,215,0,0.1)" : "transparent";
          
          if (index < 3) {
            tr.style.background = "rgba(255,215,0,0.1)";
          }
          
          const rankIcon = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "";
          const date = new Date(score.timestamp || Date.now());
          const dateStr = date.toLocaleDateString();
          
          const diffColor = difficultyColors[score.difficulty] || '#fff';
          
          tr.innerHTML = `
            <td style="padding:12px;color:#00d9ff;font-weight:bold;font-size:18px;">${rankIcon} #${index + 1}</td>
            <td style="padding:12px;color:#fff;font-size:16px;">${score.name}</td>
            <td style="padding:12px;text-align:center;color:#00ff88;font-weight:bold;font-size:18px;">${score.waves}</td>
            <td style="padding:12px;text-align:center;color:#ffaa00;">${score.kills || 0}</td>
            <td style="padding:12px;text-align:center;color:${diffColor};font-weight:bold;">${score.difficulty || 'Normal'}</td>
            <td style="padding:12px;text-align:center;color:#999;font-size:14px;">${dateStr}</td>
          `;
          tbody.appendChild(tr);
        });
        
        const currentUser = window.game?.world?.userName;
        if (currentUser && currentUser !== "Guest") {
          const userScores = scores.filter(s => s.name === currentUser);
          if (userScores.length > 0) {
            const bestUserScore = userScores[0];
            const userRank = scores.findIndex(s => s === bestUserScore) + 1;
            
            const userInfoDiv = document.createElement("div");
            userInfoDiv.style.cssText = "margin-top:20px;padding:15px;background:rgba(0,217,255,0.2);border:2px solid #00d9ff;border-radius:8px;text-align:center;";
            userInfoDiv.innerHTML = `
              <p style="margin:0;color:#00d9ff;font-size:18px;font-weight:bold;">Your Best: Rank #${userRank} - Wave ${bestUserScore.waves} (${bestUserScore.difficulty})</p>
            `;
            content.appendChild(userInfoDiv);
          }
        }
        
      } catch (error) {
        Log.error("Failed to load leaderboard:", error);
        loading.innerHTML = "Failed to load leaderboard. Please try again.";
        loading.style.color = "#ff3366";
      }
    },
    
    handleLogin() {
      const name = prompt("Enter your name:");
      if (name) {
        window.game.world.isLoggedIn = true;
        window.game.world.userName = name;
        localStorage.setItem("codered-user", name);
        PlayerCounter.addPlayer(name);
        UI.showToast("Logged in as " + name);
        this.loginBtn.textContent = "Logout";
        UI.updateHUD(window.game.world);
      }
    },

    handleLogout() {
      localStorage.removeItem("codered-user");
      window.game.world.isLoggedIn = false;
      window.game.world.userName = "Guest";
      UI.showToast("Logged out");
      this.loginBtn.textContent = "Login";
    },
    
    bindEvents() {
      document.querySelectorAll(".difficulty-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          document.querySelectorAll(".difficulty-btn").forEach(b => b.classList.remove("active"));
          btn.classList.add("active");
          if (window.game && window.game.world) {
            window.game.world.difficulty = btn.dataset.difficulty;
          }
        });
      });
      
      document.getElementById("startGameBtn").addEventListener("click", () => {
        this.hideAll();
        const shopBtn = document.getElementById("shopButton");
        if (shopBtn) shopBtn.style.display = "block";
        if (window.game && window.game.world) {
          window.game.world.gameStarted = true;
          window.game.world.startWave();
          const mobileControls = document.getElementById('mobileControls');
          const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || 
                          window.matchMedia('(hover: none) and (pointer: coarse)').matches;
          if (mobileControls && isMobile) {
            mobileControls.style.display = "block";
          }
        }
      });
      
      document.getElementById("tutorialBtn").addEventListener("click", () => {
        this.elements.homeScreen.style.display = "none";
        this.elements.tutorialScreen.style.display = "flex";
      });
      
      document.getElementById("tutorialBackBtn").addEventListener("click", () => {
        this.elements.tutorialScreen.style.display = "none";
        this.elements.homeScreen.style.display = "flex";
      });
      
      document.getElementById("tutorialStartBtn").addEventListener("click", () => {
        this.hideAll();
        const shopBtn = document.getElementById("shopButton");
        if (shopBtn) shopBtn.style.display = "block";
        if (window.game && window.game.world) {
          window.game.world.gameStarted = true;
          window.game.world.startWave();
          const mobileControls = document.getElementById('mobileControls');
          const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || 
                          window.matchMedia('(hover: none) and (pointer: coarse)').matches;
          if (mobileControls && isMobile) {
            mobileControls.style.display = "block";
          }
        }
      });
      
      document.getElementById("resumeBtn").addEventListener("click", () => {
        this.elements.pauseScreen.style.display = "none";
        if (window.game && window.game.world) window.game.world.paused = false;
      });
      
      document.getElementById("mainMenuBtn").addEventListener("click", () => location.reload());
      document.getElementById("restartBtn").addEventListener("click", () => location.reload());
      document.getElementById("gameOverMenuBtn").addEventListener("click", () => location.reload());
      
      document.getElementById("shopCloseBtn").addEventListener("click", () => {
        this.elements.shopScreen.style.display = "none";
        if (window.game && window.game.world) {
          window.game.world.paused = false;
          // Show mobile controls when shop closes (if game is running and mobile)
          const mobileControls = document.getElementById('mobileControls');
          const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || 
                          window.matchMedia('(hover: none) and (pointer: coarse)').matches;
          if (mobileControls && isMobile && window.game.world.isRunning) {
            mobileControls.style.display = "block";
          }
        }
      });
      
      const shopButton = document.getElementById("shopButton");
      if (shopButton) {
        shopButton.addEventListener("click", () => {
          if (window.game?.world?.multiplayerMode !== "single") {
            this.showToast("Shop is disabled during multiplayer.");
            return;
          }
          this.openShop();
        });
        shopButton.style.display = "none";
      }
      
      document.addEventListener("keydown", e => {
        if (!window.game || !window.game.world) return;
        
        const upgrades = PermanentUpgrades.load();
        const controls = upgrades.controls || PermanentUpgrades.getDefaults().controls;
        const pressedKey = e.key.toLowerCase();
        
        if (pressedKey === "m") {
          e.preventDefault();
          if (window.game.devConsole) window.game.devConsole.toggle();
        }
        
        if (pressedKey === "p") {
          window.game.world.paused = !window.game.world.paused;
          this.elements.pauseScreen.style.display = window.game.world.paused ? "flex" : "none";
        }
        
        if (pressedKey === controls.shop) {
          e.preventDefault();
          if (window.game.world.multiplayerMode !== "single") {
            this.showToast("Shop is disabled during multiplayer.");
            return;
          }
          this.openShop();
        }
        
        if (pressedKey === controls.switchWeapon) {
          const world = window.game.world;
          if (!world.player.unlockedWeapons) world.player.unlockedWeapons = [0];
          let nextIndex = (world.player.weaponIndex + 1) % world.player.weapons.length;
          let attempts = 0;
          while (!world.player.unlockedWeapons.includes(nextIndex) && attempts < world.player.weapons.length) {
            nextIndex = (nextIndex + 1) % world.player.weapons.length;
            attempts++;
          }
          if (world.player.unlockedWeapons.includes(nextIndex)) {
            world.player.weaponIndex = nextIndex;
            world.player.shootCooldown = 0; // Reset cooldown when switching weapons
            world.player.magAmmo = world.player.weapons[nextIndex].magSize; // Reset ammo to full when switching
            world.player.reloadTimer = 0; // Reset reload timer
            this.showToast("Switched to " + world.player.weapons[world.player.weaponIndex].name);
          }
        }
      });
    },
    
    hideAll() {
      Object.values(this.elements).forEach(el => {
        if (el && el.style) el.style.display = "none";
      });
      const shopBtn = document.getElementById("shopButton");
      if (shopBtn) shopBtn.style.display = "none";
    },
    
    updateHomeStats() {
      const sd = Save.load();
      document.getElementById("bestWaveHome").textContent = sd.bestWave || 0;
      document.getElementById("totalCoinsHome").textContent = sd.coins || 0;
    },
    
    updateHUD(world) {
      if (!world.player) return;

      this.elements.healthBar.style.width = Math.max(0, (world.player.hp / world.player.maxHp) * 100) + "%";
      this.elements.coinCount.textContent = Math.floor(world.player.coins);
      this.elements.gemCount.textContent = Math.floor(world.player.gems);
      
      const redGemCount = document.getElementById('redGemCount');
      if (redGemCount) {
        redGemCount.textContent = Math.floor(world.player.redGems || 0);
      }
      
      this.elements.currentWeapon.textContent = world.player.weapons[world.player.weaponIndex].name;
      
      const weapon = world.player.weapons[world.player.weaponIndex];
      const hasMagazine = weapon.magSize !== undefined;
      
      // Add or update the bottom left weapon display
      let weaponDisplay = document.getElementById('bottomWeaponDisplay');
      if (!weaponDisplay) {
        weaponDisplay = document.createElement('div');
        weaponDisplay.id = 'bottomWeaponDisplay';
        weaponDisplay.style.position = 'fixed';
        weaponDisplay.style.bottom = '20px';
        weaponDisplay.style.left = '20px';
        weaponDisplay.style.color = '#fff';
        weaponDisplay.style.fontSize = '24px';
        weaponDisplay.style.fontWeight = 'bold';
        weaponDisplay.style.textShadow = '2px 2px 4px rgba(0,0,0,0.7)';
        weaponDisplay.style.zIndex = '100';
        document.body.appendChild(weaponDisplay);
      }
      weaponDisplay.textContent = weapon.name;
      
      
      const armorDisplay = document.getElementById("armorDisplay");
      const armorBar = document.getElementById("armorBar");
      if (world.player.armor > 0) {
        armorDisplay.style.display = "block";
        armorBar.style.width = ((world.player.armor / 0.75) * 100) + "%";
      } else {
        armorDisplay.style.display = "none";
      }
    },
    
    showGameOver(wave, kills, coins, stats) {
      if (typeof wave === "string") {
        document.getElementById("finalWave").textContent = wave;
        document.getElementById("finalKills").textContent = kills ?? "";
        document.getElementById("finalCoins").textContent = coins ?? "";
      } else {
        document.getElementById("finalWave").textContent = wave;
        document.getElementById("finalKills").textContent = kills;
        document.getElementById("finalCoins").textContent = coins;
      }

      // #47 Detailed Statistics panel
      let statsPanel = document.getElementById("gameOverStats");
      if (!statsPanel) {
        statsPanel = document.createElement("div");
        statsPanel.id = "gameOverStats";
        statsPanel.style.cssText = "margin-top:16px;background:rgba(0,0,0,0.5);border:1px solid #00d9ff;border-radius:8px;padding:12px 16px;font-family:monospace;font-size:13px;color:#ccc;text-align:left;min-width:220px;";
        const gameOverScreen = this.elements.gameOverScreen;
        const restartBtn = document.getElementById("restartBtn");
        if (restartBtn) gameOverScreen.insertBefore(statsPanel, restartBtn);
        else gameOverScreen.appendChild(statsPanel);
      }
      if (stats) {
        statsPanel.innerHTML = `
          <div style="color:#00d9ff;font-weight:bold;margin-bottom:8px;">📊 RUN STATISTICS</div>
          <div>🎯 Accuracy: <span style="color:#fff">${stats.accuracy}%</span> (${stats.shotsHit}/${stats.shotsFired} shots)</div>
          <div>⚔️ Damage Dealt: <span style="color:#ff6644">${stats.damageDealt.toLocaleString()}</span></div>
          <div>🛡️ Damage Taken: <span style="color:#ffaa00">${stats.damageTaken.toLocaleString()}</span></div>
        `;
        statsPanel.style.display = "block";
      } else {
        statsPanel.style.display = "none";
      }

      this.elements.gameOverScreen.style.display = "flex";
      const mobileControls = document.getElementById('mobileControls');
      if (mobileControls) mobileControls.style.display = "none";
    },
    
    openShop() {
      if (!window.game || !window.game.world) return;

      // #51 Shop disabled message during multiplayer
      if (window.game.world.multiplayerMode !== "single") {
        UI.showToast("🚫 Shop is disabled during multiplayer. Visit Upgrades for weapons and buffs.");
        return;
      }

      window.game.world.paused = true;
      const playerCoins = Math.floor(window.game.world.player.coins);
      const playerGems = Math.floor(window.game.world.player.gems);
      document.getElementById("shopCoins").textContent = playerCoins;
      document.getElementById("shopGems").textContent = playerGems;
      this.populateShop(playerCoins);
      this.elements.shopScreen.style.display = "flex";
      const mobileControls = document.getElementById('mobileControls');
      if (mobileControls) mobileControls.style.display = "none";
    },
    
    populateShop(playerCoins) {
      const world = window.game.world;
      const perm = PermanentUpgrades.load();

      // Define temporary in-game shop items (coins / green gems)
      const upgrades = {
        weapons: [
          { name: "Buy Shotgun (temp)", desc: "Use Shotgun this run", cost: 120, weaponIndex: 1 },
          { name: "Buy Burst (temp)", desc: "Use Burst Rifle this run", cost: 140, weaponIndex: 2 },
          { name: "Buy Sniper (temp)", desc: "Use Sniper this run", cost: 220, weaponIndex: 3 },
          { name: "Buy Railgun (temp)", desc: "Temporary Railgun", cost: 500, weaponIndex: 4 },
          { name: "Buy SMG (temp)", desc: "Rapid-fire SMG", cost: 90, weaponIndex: 5 },
          { name: "Buy Flamethrower (temp)", desc: "Close-range crowd control", cost: 110, weaponIndex: 6 },
          { name: "Buy Plasma (temp)", desc: "Heavy plasma bolts", cost: 180, weaponIndex: 7 },
          { name: "Buy LaserSweep (temp)", desc: "Precision sweeping laser", cost: 150, weaponIndex: 8 },
          { name: "Buy Rocket (temp)", desc: "High-damage rockets", cost: 280, weaponIndex: 9 },
          // New weapons
          { name: "Buy Crossbow (temp)", desc: "Silent high-damage bolt", cost: 200, weaponIndex: 10 },
          { name: "Buy Grenade Launcher (temp)", desc: "Explosive splash damage", cost: 260, weaponIndex: 11 },
          { name: "Buy Chainsaw (temp)", desc: "Continuous melee damage", cost: 170, weaponIndex: 12 },
          // Deployables & upgrades
          { name: "Shock Trap x2", desc: "⚡ Deploy with T key to stun enemies", cost: 80, apply: () => { world.player.shockTraps = (world.player.shockTraps || 0) + 2; } },
          { name: "Sentry Turret", desc: "🤖 Deploy with Y key to auto-shoot", cost: 150, apply: () => { world.player.sentryTurrets = (world.player.sentryTurrets || 0) + 1; } },
          { name: "Med Kit", desc: "💊 Deploy with H key to heal nearby", cost: 100, apply: () => { world.player.medKits = (world.player.medKits || 0) + 1; } },
          { name: "Laser Sight", desc: "🔴 Red aim line on cursor", cost: 120, apply: () => { world.player.hasLaserSight = true; } },
          { name: "Homing Missile x3", desc: "🚀 Press M to fire — locks onto enemies", cost: 180, apply: () => { world.player.homingMissiles = (world.player.homingMissiles || 0) + 3; } },
          { name: "Ammo Satchel", desc: "📦 +50% magazine size all weapons", cost: 160, apply: () => { world.player.ammoSatchel = (world.player.ammoSatchel || 0) + 1; world.player.weapons.forEach(w => { if (w.magSize) w.magSize = Math.ceil(w.magSize * 1.5); }); } },
          { name: "Bank: Deposit 100", desc: "🏦 Earns 5% interest per wave", cost: 100, apply: () => { world.bank.stored += 100; UI.showToast("🏦 Deposited! Bank: " + world.bank.stored); } },
        ],
        offense: [
          { name: "Damage +6", desc: "Pistol damage", cost: 55, apply: () => { 
            world.player.weapons[0].dmg += 6;
          }},
          { name: "Fire Rate", desc: "-12% cooldown", cost: 80, apply: () => { 
            world.player.weapons.forEach(w => w.fireRate *= 0.88);
          }}
        ],
        defense: [
          { name: "Max HP +25", desc: "Health boost", cost: 65, apply: () => { 
            world.player.maxHp += 25; 
            world.player.hp += 25;
          }},
          { name: "Health Pack", desc: "Restore 60 HP", cost: 45, apply: () => { 
            world.player.hp = Math.min(world.player.maxHp, world.player.hp + 60);
          }}
        ],
        utility: [
          { name: "Exchange Gem", desc: "1 Green Gem = 25 coins", cost: 1, costType: "gem", apply: () => { 
            if (world.player.gems >= 1) {
              world.player.gems -= 1;
              world.player.coins += 25;
              UI.showToast("Exchanged 1 Green Gem for 25 coins!");
            } else {
              UI.showToast("Not enough Green Gems!");
            }
          }},
          { name: "Speed +18%", desc: "Move faster", cost: 75, apply: () => { 
            world.player.speedMul += 0.18;
          }},
          { name: "Magnet", desc: "Pickup radius +50%", cost: 85, apply: () => { 
            world.player.pickupRadius = (world.player.pickupRadius || 1) + 0.5;
          }},
          { name: "Lucky Coin", desc: "Better loot", cost: 100, apply: () => { 
            world.luckMultiplier = (world.luckMultiplier || 1) + 0.3;
          }}
        ]
      };

      // Weapons: temporary buys go into weapons list area
      const weaponsContainer = document.getElementById("weaponsUpgradesShop") || document.getElementById("weaponsUpgrades");
      if (weaponsContainer) {
        weaponsContainer.innerHTML = "";
        upgrades.weapons.forEach(u => {
          const div = document.createElement("div");
          div.className = "shop-item";
          const permOwned = (perm.unlockedWeapons || []).includes(u.weaponIndex);
          const canAfford = playerCoins >= u.cost;

          div.innerHTML = `<h4>${u.name}</h4><p>${u.desc}</p><p style='color: #ffdd00;'>${u.cost} 🪙</p>`;
          const btn = document.createElement("button");
          if (permOwned) {
            btn.textContent = "Purchased (Permanent)";
            btn.disabled = true;
            btn.style.opacity = "0.5";
            btn.style.cursor = "not-allowed";
          } else {
            btn.textContent = "Buy";
            btn.disabled = !canAfford;
            if (!canAfford) { btn.style.opacity = "0.5"; btn.style.cursor = "not-allowed"; }
            btn.onclick = () => {
              if (world.player.coins >= u.cost) {
                world.player.coins -= u.cost;
                // give temporary access for this run
                if (!world.player.unlockedWeapons.includes(u.weaponIndex)) world.player.unlockedWeapons.push(u.weaponIndex);
                document.getElementById("shopCoins").textContent = Math.floor(world.player.coins);
                UI.showToast(`Bought ${u.name} for this run!`);
                UI.populateShop(Math.floor(world.player.coins));
              } else {
                UI.showToast("Not enough coins!");
              }
            };
          }
          div.appendChild(btn);
          weaponsContainer.appendChild(div);
        });
      }

      ["offense", "defense", "utility"].forEach(category => {
        const container = document.getElementById(category + "Upgrades");
        if (!container) return;
        container.innerHTML = "";
        
        upgrades[category].forEach(u => {
          const div = document.createElement("div");
          div.className = "shop-item";
          
          const costType = u.costType || "coins";
          const costColor = costType === "gem" ? "#00ff88" : "#ffdd00";
          const costSymbol = costType === "gem" ? "💎" : "🪙";
          
          let canAfford = false;
          if (costType === "coins") {
            canAfford = playerCoins >= u.cost;
          } else if (costType === "gem") {
            canAfford = world.player.gems >= u.cost;
          }
          
          div.innerHTML = `<h4>${u.name}</h4><p>${u.desc}</p><p style='color: ${costColor};'>${u.cost} ${costSymbol}</p>`;
          
          const btn = document.createElement("button");
          btn.textContent = "Buy";
          btn.disabled = !canAfford;
          if (!canAfford) {
            btn.style.opacity = "0.5";
            btn.style.cursor = "not-allowed";
          }
          
          btn.onclick = () => {
            const costType = u.costType || "coins";
            let canBuy = false;
            
            if (costType === "coins" && world.player.coins >= u.cost) {
              world.player.coins -= u.cost;
              canBuy = true;
            } else if (costType === "gem" && world.player.gems >= u.cost) {
              world.player.gems -= u.cost;
              canBuy = true;
            }
            
            if (canBuy) {
              document.getElementById("shopCoins").textContent = Math.floor(world.player.coins);
              document.getElementById("shopGems").textContent = Math.floor(world.player.gems);
              u.apply();
              UI.showToast("Bought " + u.name + "!");
              UI.populateShop(Math.floor(world.player.coins));
            } else {
              UI.showToast("Not enough " + costType + "!");
            }
          };
          div.appendChild(btn);
          container.appendChild(div);
        });
      });
    },
    
    populateUpgrades() {
      const world = window.game.world;
      const upgrades = PermanentUpgrades.load();
      
      document.getElementById("upgradesRedGems").textContent = Math.floor(upgrades.redGems || 0);
      document.getElementById("upgradesRainbowCrystals").textContent = Math.floor(upgrades.rainbowCrystals || 0);
      
      const upgradeDefs = {
        weapons: [
          { name: "Unlock Shotgun", weaponIndex: 1, desc: "Semi-auto shotgun", cost: 50, apply: () => { 
            if (!upgrades.unlockedWeapons.includes(1)) {
              upgrades.unlockedWeapons.push(1);
              if (!world.player.unlockedWeapons.includes(1)) {
                world.player.unlockedWeapons.push(1);
              }
              PermanentUpgrades.save(upgrades);
              UI.showToast("Shotgun unlocked! Carry over to all games!");
            }
          }},
          { name: "Unlock Burst", weaponIndex: 2, desc: "Burst rifle - 3 shots", cost: 100, apply: () => { 
            if (!upgrades.unlockedWeapons.includes(2)) {
              upgrades.unlockedWeapons.push(2);
              if (!world.player.unlockedWeapons.includes(2)) {
                world.player.unlockedWeapons.push(2);
              }
              PermanentUpgrades.save(upgrades);
              UI.showToast("Burst Rifle unlocked! Carry over to all games!");
            }
          }},
          { name: "Unlock Sniper", weaponIndex: 3, desc: "High damage, precise", cost: 200, apply: () => { 
            if (!upgrades.unlockedWeapons.includes(3)) {
              upgrades.unlockedWeapons.push(3);
              if (!world.player.unlockedWeapons.includes(3)) {
                world.player.unlockedWeapons.push(3);
              }
              PermanentUpgrades.save(upgrades);
              UI.showToast("Sniper unlocked! Carry over to all games!");
            }
          }},
          { name: "Unlock Railgun", weaponIndex: 4, desc: "🚀 ULTIMATE! Spinning laser", cost: 700, apply: () => { 
            if (!upgrades.unlockedWeapons.includes(4)) {
              upgrades.unlockedWeapons.push(4);
              if (!world.player.unlockedWeapons.includes(4)) {
                world.player.unlockedWeapons.push(4);
              }
              PermanentUpgrades.save(upgrades);
              UI.showToast("🚀 RAILGUN UNLOCKED! Ultimate power!");
            }
          }}
          ,{ name: "Unlock SMG", desc: "Lightweight SMG", cost: 60, apply: () => {
            if (!upgrades.unlockedWeapons.includes(5)) {
              upgrades.unlockedWeapons.push(5);
              if (!world.player.unlockedWeapons.includes(5)) world.player.unlockedWeapons.push(5);
              PermanentUpgrades.save(upgrades);
              UI.showToast("SMG unlocked! Carry over to all games!");
            }
          }},
          { name: "Unlock Flamethrower", desc: "Close-range crowd control", cost: 90, apply: () => {
            if (!upgrades.unlockedWeapons.includes(6)) {
              upgrades.unlockedWeapons.push(6);
              if (!world.player.unlockedWeapons.includes(6)) world.player.unlockedWeapons.push(6);
              PermanentUpgrades.save(upgrades);
              UI.showToast("Flamethrower unlocked! Carry over to all games!");
            }
          }},
          { name: "Unlock Plasma", desc: "Heavy plasma bolt", cost: 160, apply: () => {
            if (!upgrades.unlockedWeapons.includes(7)) {
              upgrades.unlockedWeapons.push(7);
              if (!world.player.unlockedWeapons.includes(7)) world.player.unlockedWeapons.push(7);
              PermanentUpgrades.save(upgrades);
              UI.showToast("Plasma unlocked! Carry over to all games!");
            }
          }},
          { name: "Unlock LaserSweep", desc: "Precision sweeping laser", cost: 140, apply: () => {
            if (!upgrades.unlockedWeapons.includes(8)) {
              upgrades.unlockedWeapons.push(8);
              if (!world.player.unlockedWeapons.includes(8)) world.player.unlockedWeapons.push(8);
              PermanentUpgrades.save(upgrades);
              UI.showToast("Laser Sweep unlocked! Carry over to all games!");
            }
          }},
          { name: "Unlock Rocket", desc: "High-damage rocket launcher", cost: 240, apply: () => {
            if (!upgrades.unlockedWeapons.includes(9)) {
              upgrades.unlockedWeapons.push(9);
              if (!world.player.unlockedWeapons.includes(9)) world.player.unlockedWeapons.push(9);
              PermanentUpgrades.save(upgrades);
              UI.showToast("Rocket unlocked! Carry over to all games!");
            }
          }}
        ],
        rainbowWeapons: [
          { name: "💎 TimeBlaster", weaponIndex: 10, desc: "200 dmg", cost: 670, apply: () => {
            try {
              if (!upgrades.unlockedRainbowWeapons.includes(10)) {
                console.log("Unlocking TimeBlaster. World:", world, "Upgrades:", upgrades);
                upgrades.unlockedRainbowWeapons.push(10);
                if (!world.player.unlockedWeapons.includes(10)) world.player.unlockedWeapons.push(10);
                world.player.weaponIndex = 10;
                PermanentUpgrades.save(upgrades);
                UI.showToast("💎 TimeBlaster unlocked and equipped!");
              }
            } catch (e) {
              console.error("Error purchasing TimeBlaster:", e);
              alert("A critical error occurred while purchasing: " + e.message);
            }
          }},
          { name: "💎 VortexCannon", weaponIndex: 11, desc: "300 dmg", cost: 680, apply: () => { 
            if (!upgrades.unlockedRainbowWeapons.includes(11)) {
              upgrades.unlockedRainbowWeapons.push(11);
              if (!world.player.unlockedWeapons.includes(11)) world.player.unlockedWeapons.push(11);
              world.player.weaponIndex = 11;
              PermanentUpgrades.save(upgrades);
              UI.showToast("💎 VortexCannon unlocked and equipped!");
            }
          }},
          { name: "💎 NeutronBomb", weaponIndex: 12, desc: "500 dmg", cost: 700, apply: () => { 
            if (!upgrades.unlockedRainbowWeapons.includes(12)) {
              upgrades.unlockedRainbowWeapons.push(12);
              if (!world.player.unlockedWeapons.includes(12)) world.player.unlockedWeapons.push(12);
              world.player.weaponIndex = 12;
              PermanentUpgrades.save(upgrades);
              UI.showToast("💎 NeutronBomb unlocked and equipped!");
            }
          }},
          { name: "💎 FluxCapacitor", weaponIndex: 13, desc: "350 dmg", cost: 690, apply: () => { 
            if (!upgrades.unlockedRainbowWeapons.includes(13)) {
              upgrades.unlockedRainbowWeapons.push(13);
              if (!world.player.unlockedWeapons.includes(13)) world.player.unlockedWeapons.push(13);
              world.player.weaponIndex = 13;
              PermanentUpgrades.save(upgrades);
              UI.showToast("💎 FluxCapacitor unlocked and equipped!");
            }
          }},
          { name: "💎 SuperNova", weaponIndex: 14, desc: "400 dmg", cost: 700, apply: () => { 
            if (!upgrades.unlockedRainbowWeapons.includes(14)) {
              upgrades.unlockedRainbowWeapons.push(14);
              if (!world.player.unlockedWeapons.includes(14)) world.player.unlockedWeapons.push(14);
              world.player.weaponIndex = 14;
              PermanentUpgrades.save(upgrades);
              UI.showToast("💎 SuperNova unlocked and equipped!");
            }
          }},
          { name: "💎 CyberStrike", weaponIndex: 15, desc: "280 dmg", cost: 675, apply: () => { 
            if (!upgrades.unlockedRainbowWeapons.includes(15)) {
              upgrades.unlockedRainbowWeapons.push(15);
              if (!world.player.unlockedWeapons.includes(15)) world.player.unlockedWeapons.push(15);
              world.player.weaponIndex = 15;
              PermanentUpgrades.save(upgrades);
              UI.showToast("💎 CyberStrike unlocked and equipped!");
            }
          }},
          { name: "💎 VoidRipper", weaponIndex: 16, desc: "550 dmg", cost: 750, apply: () => { 
            if (!upgrades.unlockedRainbowWeapons.includes(16)) {
              upgrades.unlockedRainbowWeapons.push(16);
              if (!world.player.unlockedWeapons.includes(16)) world.player.unlockedWeapons.push(16);
              world.player.weaponIndex = 16;
              PermanentUpgrades.save(upgrades);
              UI.showToast("💎 VoidRipper unlocked and equipped!");
            }
          }},
          { name: "💎 NanoBlast", weaponIndex: 17, desc: "320 dmg", cost: 685, apply: () => { 
            if (!upgrades.unlockedRainbowWeapons.includes(17)) {
              upgrades.unlockedRainbowWeapons.push(17);
              if (!world.player.unlockedWeapons.includes(17)) world.player.unlockedWeapons.push(17);
              world.player.weaponIndex = 17;
              PermanentUpgrades.save(upgrades);
              UI.showToast("💎 NanoBlast unlocked and equipped!");
            }
          }},
          { name: "💎 InfernoWave", weaponIndex: 18, desc: "450 dmg", cost: 710, apply: () => { 
            if (!upgrades.unlockedRainbowWeapons.includes(18)) {
              upgrades.unlockedRainbowWeapons.push(18);
              if (!world.player.unlockedWeapons.includes(18)) world.player.unlockedWeapons.push(18);
              world.player.weaponIndex = 18;
              PermanentUpgrades.save(upgrades);
              UI.showToast("💎 InfernoWave unlocked and equipped!");
            }
          }},
          { name: "💎 QuantumShredder", weaponIndex: 19, desc: "600 dmg", cost: 800, apply: () => { 
            if (!upgrades.unlockedRainbowWeapons.includes(19)) {
              upgrades.unlockedRainbowWeapons.push(19);
              if (!world.player.unlockedWeapons.includes(19)) world.player.unlockedWeapons.push(19);
              world.player.weaponIndex = 19;
              PermanentUpgrades.save(upgrades);
              UI.showToast("💎 QuantumShredder unlocked and equipped!");
            }
          }},
          { name: "💎 PlasmaDancer", weaponIndex: 20, desc: "380 dmg", cost: 695, apply: () => { 
            if (!upgrades.unlockedRainbowWeapons.includes(20)) {
              upgrades.unlockedRainbowWeapons.push(20);
              if (!world.player.unlockedWeapons.includes(20)) world.player.unlockedWeapons.push(20);
              world.player.weaponIndex = 20;
              PermanentUpgrades.save(upgrades);
              UI.showToast("💎 PlasmaDancer unlocked and equipped!");
            }
          }},
          { name: "💎 CrimsonEdge", weaponIndex: 21, desc: "420 dmg", cost: 705, apply: () => { 
            if (!upgrades.unlockedRainbowWeapons.includes(21)) {
              upgrades.unlockedRainbowWeapons.push(21);
              if (!world.player.unlockedWeapons.includes(21)) world.player.unlockedWeapons.push(21);
              world.player.weaponIndex = 21;
              PermanentUpgrades.save(upgrades);
              UI.showToast("💎 CrimsonEdge unlocked and equipped!");
            }
          }},
          { name: "💎 SolarFlare", weaponIndex: 22, desc: "500 dmg", cost: 730, apply: () => { 
            if (!upgrades.unlockedRainbowWeapons.includes(22)) {
              upgrades.unlockedRainbowWeapons.push(22);
              if (!world.player.unlockedWeapons.includes(22)) world.player.unlockedWeapons.push(22);
              world.player.weaponIndex = 22;
              PermanentUpgrades.save(upgrades);
              UI.showToast("💎 SolarFlare unlocked and equipped!");
            }
          }},
          { name: "💎 FrostByte", weaponIndex: 23, desc: "290 dmg", cost: 680, apply: () => { 
            if (!upgrades.unlockedRainbowWeapons.includes(23)) {
              upgrades.unlockedRainbowWeapons.push(23);
              if (!world.player.unlockedWeapons.includes(23)) world.player.unlockedWeapons.push(23);
              world.player.weaponIndex = 23;
              PermanentUpgrades.save(upgrades);
              UI.showToast("💎 FrostByte unlocked and equipped!");
            }
          }},
          { name: "💎 ThunderStorm", weaponIndex: 24, desc: "520 dmg", cost: 740, apply: () => { 
            if (!upgrades.unlockedRainbowWeapons.includes(24)) {
              upgrades.unlockedRainbowWeapons.push(24);
              if (!world.player.unlockedWeapons.includes(24)) world.player.unlockedWeapons.push(24);
              world.player.weaponIndex = 24;
              PermanentUpgrades.save(upgrades);
              UI.showToast("💎 ThunderStorm unlocked and equipped!");
            }
          }},
          { name: "💎 EchoPhantom", weaponIndex: 25, desc: "360 dmg", cost: 692, apply: () => { 
            if (!upgrades.unlockedRainbowWeapons.includes(25)) {
              upgrades.unlockedRainbowWeapons.push(25);
              if (!world.player.unlockedWeapons.includes(25)) world.player.unlockedWeapons.push(25);
              world.player.weaponIndex = 25;
              PermanentUpgrades.save(upgrades);
              UI.showToast("💎 EchoPhantom unlocked and equipped!");
            }
          }},
          { name: "💎 SilverBullet", weaponIndex: 26, desc: "480 dmg", cost: 720, apply: () => { 
            if (!upgrades.unlockedRainbowWeapons.includes(26)) {
              upgrades.unlockedRainbowWeapons.push(26);
              if (!world.player.unlockedWeapons.includes(26)) world.player.unlockedWeapons.push(26);
              world.player.weaponIndex = 26;
              PermanentUpgrades.save(upgrades);
              UI.showToast("💎 SilverBullet unlocked and equipped!");
            }
          }},
          { name: "💎 OmegaBeam", weaponIndex: 27, desc: "620 dmg", cost: 820, apply: () => { 
            if (!upgrades.unlockedRainbowWeapons.includes(27)) {
              upgrades.unlockedRainbowWeapons.push(27);
              if (!world.player.unlockedWeapons.includes(27)) world.player.unlockedWeapons.push(27);
              world.player.weaponIndex = 27;
              PermanentUpgrades.save(upgrades);
              UI.showToast("💎 OmegaBeam unlocked and equipped!");
            }
          }},
          { name: "💎 XenoBurst", weaponIndex: 28, desc: "310 dmg", cost: 678, apply: () => { 
            if (!upgrades.unlockedRainbowWeapons.includes(28)) {
              upgrades.unlockedRainbowWeapons.push(28);
              if (!world.player.unlockedWeapons.includes(28)) world.player.unlockedWeapons.push(28);
              world.player.weaponIndex = 28;
              PermanentUpgrades.save(upgrades);
              UI.showToast("💎 XenoBurst unlocked and equipped!");
            }
          }},
          { name: "💎 VenomStrike", weaponIndex: 29, desc: "440 dmg", cost: 715, apply: () => { 
            if (!upgrades.unlockedRainbowWeapons.includes(29)) {
              upgrades.unlockedRainbowWeapons.push(29);
              if (!world.player.unlockedWeapons.includes(29)) world.player.unlockedWeapons.push(29);
              world.player.weaponIndex = 29;
              PermanentUpgrades.save(upgrades);
              UI.showToast("💎 VenomStrike unlocked and equipped!");
            }
          }},
          { name: "💎 GhostPhase", weaponIndex: 30, desc: "340 dmg", cost: 688, apply: () => { 
            if (!upgrades.unlockedRainbowWeapons.includes(30)) {
              upgrades.unlockedRainbowWeapons.push(30);
              if (!world.player.unlockedWeapons.includes(30)) world.player.unlockedWeapons.push(30);
              world.player.weaponIndex = 30;
              PermanentUpgrades.save(upgrades);
              UI.showToast("💎 GhostPhase unlocked and equipped!");
            }
          }},
          { name: "💎 VenusStorm", weaponIndex: 31, desc: "570 dmg", cost: 760, apply: () => { 
            if (!upgrades.unlockedRainbowWeapons.includes(31)) {
              upgrades.unlockedRainbowWeapons.push(31);
              if (!world.player.unlockedWeapons.includes(31)) world.player.unlockedWeapons.push(31);
              world.player.weaponIndex = 31;
              PermanentUpgrades.save(upgrades);
              UI.showToast("💎 VenusStorm unlocked and equipped!");
            }
          }},
          { name: "💎 DeathRay", weaponIndex: 32, desc: "700 dmg", cost: 900, apply: () => { 
            if (!upgrades.unlockedRainbowWeapons.includes(32)) {
              upgrades.unlockedRainbowWeapons.push(32);
              if (!world.player.unlockedWeapons.includes(32)) world.player.unlockedWeapons.push(32);
              world.player.weaponIndex = 32;
              PermanentUpgrades.save(upgrades);
              UI.showToast("💎 DeathRay unlocked and equipped!");
            }
          }},
          { name: "💎 CosmicFury", weaponIndex: 33, desc: "600 dmg", cost: 800, apply: () => { 
            if (!upgrades.unlockedRainbowWeapons.includes(33)) {
              upgrades.unlockedRainbowWeapons.push(33);
              if (!world.player.unlockedWeapons.includes(33)) world.player.unlockedWeapons.push(33);
              world.player.weaponIndex = 33;
              PermanentUpgrades.save(upgrades);
              UI.showToast("💎 CosmicFury unlocked and equipped!");
            }
          }},
          { name: "💎 NeoGenesis", weaponIndex: 34, desc: "500 dmg", cost: 735, apply: () => { 
            if (!upgrades.unlockedRainbowWeapons.includes(34)) {
              upgrades.unlockedRainbowWeapons.push(34);
              if (!world.player.unlockedWeapons.includes(34)) world.player.unlockedWeapons.push(34);
              world.player.weaponIndex = 34;
              PermanentUpgrades.save(upgrades);
              UI.showToast("💎 NeoGenesis unlocked and equipped!");
            }
          }},
          { name: "💎 ZenithPulse", weaponIndex: 35, desc: "430 dmg", cost: 708, apply: () => { 
            if (!upgrades.unlockedRainbowWeapons.includes(35)) {
              upgrades.unlockedRainbowWeapons.push(35);
              if (!world.player.unlockedWeapons.includes(35)) world.player.unlockedWeapons.push(35);
              world.player.weaponIndex = 35;
              PermanentUpgrades.save(upgrades);
              UI.showToast("💎 ZenithPulse unlocked and equipped!");
            }
          }},
          { name: "💎 CelestialWrath", weaponIndex: 36, desc: "650 dmg", cost: 850, apply: () => { 
            if (!upgrades.unlockedRainbowWeapons.includes(36)) {
              upgrades.unlockedRainbowWeapons.push(36);
              if (!world.player.unlockedWeapons.includes(36)) world.player.unlockedWeapons.push(36);
              world.player.weaponIndex = 36;
              PermanentUpgrades.save(upgrades);
              UI.showToast("💎 CelestialWrath unlocked and equipped!");
            }
          }},
          { name: "💎 ObsidianDoom", weaponIndex: 37, desc: "800 dmg", cost: 1000, apply: () => { 
            if (!upgrades.unlockedRainbowWeapons.includes(37)) {
              upgrades.unlockedRainbowWeapons.push(37);
              if (!world.player.unlockedWeapons.includes(37)) world.player.unlockedWeapons.push(37);
              world.player.weaponIndex = 37;
              PermanentUpgrades.save(upgrades);
              UI.showToast("💎 ObsidianDoom unlocked and equipped!");
            }
          }},
          { name: "💎 PhoenixRise", weaponIndex: 38, desc: "560 dmg", cost: 755, apply: () => { 
            if (!upgrades.unlockedRainbowWeapons.includes(38)) {
              upgrades.unlockedRainbowWeapons.push(38);
              if (!world.player.unlockedWeapons.includes(38)) world.player.unlockedWeapons.push(38);
              world.player.weaponIndex = 38;
              PermanentUpgrades.save(upgrades);
              UI.showToast("💎 PhoenixRise unlocked and equipped!");
            }
          }},
          { name: "💎 InfinityGun", weaponIndex: 39, desc: "999 dmg", cost: 1200, apply: () => { 
            if (!upgrades.unlockedRainbowWeapons.includes(39)) {
              upgrades.unlockedRainbowWeapons.push(39);
              if (!world.player.unlockedWeapons.includes(39)) world.player.unlockedWeapons.push(39);
              world.player.weaponIndex = 39;
              PermanentUpgrades.save(upgrades);
              UI.showToast("💎 InfinityGun ULTIMATE and equipped!");
            }
          }}
        ],
        defense: [
          { name: "Max HP +25", desc: "Permanent +25 health", cost: 40, apply: () => { 
            upgrades.maxHpBonus += 25;
            world.player.maxHp += 25;
            world.player.hp = world.player.maxHp;
            PermanentUpgrades.save(upgrades);
          }},
          { name: "Max HP +50", desc: "Permanent +50 health", cost: 80, apply: () => { 
            upgrades.maxHpBonus += 50;
            world.player.maxHp += 50;
            world.player.hp = world.player.maxHp;
            PermanentUpgrades.save(upgrades);
          }},
          { name: "Armor +12%", desc: "Permanent damage reduction", cost: 75, apply: () => { 
            upgrades.armorBonus = Math.min(0.75, upgrades.armorBonus + 0.12);
            world.player.armor = Math.min(0.75, world.player.armor + 0.12);
            PermanentUpgrades.save(upgrades);
          }},
          { name: "Armor +24%", desc: "Strong damage reduction", cost: 150, apply: () => { 
            upgrades.armorBonus = Math.min(0.75, upgrades.armorBonus + 0.24);
            world.player.armor = Math.min(0.75, world.player.armor + 0.24);
            PermanentUpgrades.save(upgrades);
          }}
        ],
        utility: [
          { name: "Damage +10", desc: "Permanent +10 all weapons", cost: 60, apply: () => { 
            upgrades.baseDamage += 10;
            world.player.weapons.forEach(w => { if (w.dmg > 0) w.dmg += 10; });
            PermanentUpgrades.save(upgrades);
          }},
          { name: "Fire Rate +15%", desc: "Permanent faster fire rate", cost: 120, apply: () => { 
            upgrades.fireRateBonus += 0.15;
            world.player.weapons.forEach(w => { 
              if (w.fireRate > 0 && w.fireRate < 60) w.fireRate *= 0.85;
            });
            PermanentUpgrades.save(upgrades);
          }},
          { name: "Speed +25%", desc: "Permanent movement boost", cost: 100, apply: () => { 
            upgrades.speedBonus += 0.25;
            world.player.speedMul += 0.25;
            PermanentUpgrades.save(upgrades);
          }},
          { name: "Speed +50%", desc: "Major permanent speed boost", cost: 200, apply: () => { 
            upgrades.speedBonus += 0.50;
            world.player.speedMul += 0.50;
            PermanentUpgrades.save(upgrades);
          }}
        ]
      };
      
      ["weapons", "defense", "utility"].forEach(category => {
        let containerId = category + "Upgrades";
        if (category === "defense") containerId = "permanentDefenseUpgrades";
        if (category === "utility") containerId = "permanentUtilityUpgrades";
        
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = "";
        
        upgradeDefs[category].forEach(u => {
          const div = document.createElement("div");
          div.className = "shop-item";
          const canAfford = (upgrades.redGems || 0) >= u.cost;
          const isOwned = (u.weaponIndex !== undefined) && (upgrades.unlockedWeapons || []).includes(u.weaponIndex);

          div.innerHTML = `<h4>${u.name}</h4><p>${u.desc}</p><p style='color: #ff4444;'>${u.cost} 🔴</p>`;

          const btn = document.createElement("button");
          if (isOwned) {
            btn.textContent = "Purchased";
            btn.disabled = true;
          } else {
            btn.textContent = "Buy";
            btn.disabled = !canAfford;
            if (!canAfford) { btn.style.opacity = "0.5"; btn.style.cursor = "not-allowed"; }

            btn.onclick = () => {
              if ((upgrades.redGems || 0) >= u.cost) {
                upgrades.redGems = (upgrades.redGems || 0) - u.cost;
                PermanentUpgrades.save(upgrades);
                document.getElementById("upgradesRedGems").textContent = Math.floor(upgrades.redGems || 0);
                u.apply();
                UI.showToast("Bought " + u.name + "! Permanent upgrade!");
                UI.populateUpgrades();
              } else {
                UI.showToast("Not enough Red Gems!");
              }
            };
          }
          div.appendChild(btn);
          container.appendChild(div);
        });
      });

      // Render rainbow weapons separately with rainbow crystals currency
      const rainbowContainer = document.getElementById("rainbowWeaponsUpgrades");
      if (rainbowContainer) {
        rainbowContainer.innerHTML = "";
        upgradeDefs.rainbowWeapons.forEach(u => {
          const div = document.createElement("div");
          div.className = "shop-item";
          const canAfford = (upgrades.rainbowCrystals || 0) >= u.cost;
          const isOwned = (u.weaponIndex !== undefined) && (upgrades.unlockedRainbowWeapons || []).includes(u.weaponIndex);

          div.innerHTML = `<h4>${u.name}</h4><p>${u.desc}</p><p style='color: #ff00ff;'>${u.cost} 🌈</p>`;

          const btn = document.createElement("button");
          if (isOwned) {
            btn.textContent = "Purchased";
            btn.disabled = true;
            btn.style.opacity = "0.5";
            btn.style.cursor = "not-allowed";
          } else {
            btn.textContent = "Buy";
            btn.disabled = !canAfford;
            if (!canAfford) { btn.style.opacity = "0.5"; btn.style.cursor = "not-allowed"; }

            btn.onclick = () => {
              if ((upgrades.rainbowCrystals || 0) >= u.cost) {
                upgrades.rainbowCrystals = (upgrades.rainbowCrystals || 0) - u.cost;
                PermanentUpgrades.save(upgrades);
                document.getElementById("upgradesRainbowCrystals").textContent = Math.floor(upgrades.rainbowCrystals || 0);
                u.apply();
                UI.showToast("Bought " + u.name + "! Permanent upgrade!");
                UI.populateUpgrades();
              } else {
                UI.showToast("Not enough Rainbow Crystals!");
              }
            };
          }
          div.appendChild(btn);
          rainbowContainer.appendChild(div);
        });
      }
    },

    populateCustomize() {
      const upgrades = PermanentUpgrades.load();
      const primaryContainer = document.getElementById('primaryColors');
      const secondaryContainer = document.getElementById('secondaryColors');
      const preview = document.getElementById('colorPreview');
      const redCount = document.getElementById('customizeRedGems');
      if (redCount) redCount.textContent = Math.floor(upgrades.redGems || 0);

      const primaryColors = ['#00d9ff', '#00ff88', '#ffdd00', '#ff3366', '#ffffff', '#00aaff'];
      const secondaryColors = ['#ff66cc', '#8800ff', '#ff8800', '#00ffaa', '#ff4444', '#663300'];

      if (primaryContainer) {
        primaryContainer.innerHTML = '';
        primaryColors.forEach(c => {
          const btn = document.createElement('button');
          btn.style.background = c;
          btn.style.height = '36px';
          btn.style.borderRadius = '6px';
          btn.onclick = () => {
            const upgrades = PermanentUpgrades.load();
            upgrades.playerColor = c;
            PermanentUpgrades.save(upgrades);
            // apply live if in-game
            if (window.game && window.game.world && window.game.world.player) {
              window.game.world.player.color = c;
            }
            this.updatePlayerColorPreview(preview, upgrades.playerColor, (upgrades.selectedSecondary || (upgrades.unlockedColors && upgrades.unlockedColors[1])));
            UI.showToast('Primary color set');
          };
          primaryContainer.appendChild(btn);
        });
      }

      if (secondaryContainer) {
        secondaryContainer.innerHTML = '';
        secondaryColors.forEach(c => {
          const div = document.createElement('div');
          div.style.display = 'flex';
          div.style.flexDirection = 'column';
          div.style.gap = '6px';

          const btn = document.createElement('button');
          btn.style.background = c;
          btn.style.height = '36px';
          btn.style.borderRadius = '6px';

          const price = document.createElement('small');
          price.style.color = '#ff4444';
          price.textContent = '50 🔴';

          btn.onclick = () => {
            const upgrades = PermanentUpgrades.load();
            if ((upgrades.unlockedColors || []).includes(c)) {
              upgrades.selectedSecondary = c;
              PermanentUpgrades.save(upgrades);
              if (window.game && window.game.world && window.game.world.player) {
                window.game.world.player.secondaryColor = c;
              }
              this.updatePlayerColorPreview(preview, upgrades.playerColor, upgrades.selectedSecondary);
              UI.showToast('Secondary color applied');
              return;
            }
            if ((upgrades.redGems || 0) >= 50) {
              upgrades.redGems = (upgrades.redGems || 0) - 50;
              upgrades.unlockedColors = upgrades.unlockedColors || [];
              upgrades.unlockedColors.push(c);
              upgrades.selectedSecondary = c;
              PermanentUpgrades.save(upgrades);
              if (redCount) redCount.textContent = Math.floor(upgrades.redGems || 0);
              if (window.game && window.game.world && window.game.world.player) {
                window.game.world.player.secondaryColor = c;
              }
              this.updatePlayerColorPreview(preview, upgrades.playerColor, upgrades.selectedSecondary);
              UI.showToast('Secondary color purchased and applied');
            } else {
              UI.showToast('Not enough Red Gems');
            }
          };

          div.appendChild(btn);
          div.appendChild(price);
          secondaryContainer.appendChild(div);
        });
      }

      // initial preview
      const upgradesNow = PermanentUpgrades.load();
      this.updatePlayerColorPreview(preview, upgradesNow.playerColor, upgradesNow.selectedSecondary || (upgradesNow.unlockedColors && upgradesNow.unlockedColors[1]));
    },

    populateControls() {
      const upgrades = PermanentUpgrades.load();
      const controls = upgrades.controls || PermanentUpgrades.getDefaults().controls;
      
      const keyMap = {
        moveUp: 'remapMoveUp',
        moveDown: 'remapMoveDown',
        moveLeft: 'remapMoveLeft',
        moveRight: 'remapMoveRight',
        switchWeapon: 'remapSwitchWeapon',
        shop: 'remapShop',
        sprint: 'remapSprint'
      };
      
      Object.entries(keyMap).forEach(([controlName, buttonId]) => {
        const btn = document.getElementById(buttonId);
        if (btn) {
          const keyValue = controls[controlName] || '';
          btn.textContent = keyValue.toUpperCase() === 'SHIFT' ? 'Shift' : keyValue.toUpperCase();
          
          btn.onclick = () => {
            btn.textContent = "Press any key...";
            btn.style.opacity = "0.5";
            btn.disabled = true;
            
            const handleKeyDown = (e) => {
              e.preventDefault();
              let keyName = e.key.toLowerCase();
              if (e.key === ' ') keyName = 'space';
              if (e.shiftKey && e.key !== 'Shift') keyName = 'shift';
              
              controls[controlName] = keyName;
              upgrades.controls = controls;
              PermanentUpgrades.save(upgrades);
              
              btn.textContent = keyName.toUpperCase() === 'SHIFT' ? 'Shift' : keyName.toUpperCase();
              btn.style.opacity = "1";
              btn.disabled = false;
              document.removeEventListener('keydown', handleKeyDown);
              UI.showToast(`${controlName.replace(/([A-Z])/g, ' $1')} set to ${keyName.toUpperCase()}`);
            };
            
            document.addEventListener('keydown', handleKeyDown, { once: true });
          };
        }
      });
    },

    populatePromoScreen() {
      const input = document.getElementById('promoInput');
    },
    
    redeemPromo(code) {
      const c = (code || '').toString().trim();
      const msg = document.getElementById('promoMessage');
      const input = document.querySelector('#promoInput');
      
      if (!c) {
        if (msg) {
          msg.textContent = 'Please enter a promo code.';
          msg.style.color = '#ff4444';
        }
        UI.showToast('Enter a promo code');
        return;
      }

      const codes = this.promoCodes || [];
      const found = codes.find(p => p.code.toUpperCase() === c.toUpperCase());
      
      if (!found) {
        if (msg) {
          msg.textContent = 'Invalid promo code.';
          msg.style.color = '#ff4444';
        }
        UI.showToast('Invalid promo code');
        return;
      }

      const redeemedCodes = JSON.parse(localStorage.getItem('redeemedCodes') || '[]');
      
      // Check if the code has already been redeemed
      if (redeemedCodes.some(rc => typeof rc === 'string' ? rc === c.toUpperCase() : rc.code === c.toUpperCase())) {
        if (msg) {
          msg.textContent = 'You have already redeemed this code.';
          msg.style.color = '#ff8800';
        }
        UI.showToast('Promo code already redeemed');
        return;
      }

      const upgrades = PermanentUpgrades.load();

      // Apply rewards
      const r = found.rainbow || 0;
      const rg = found.redGems || 0;
      upgrades.rainbowCrystals = (upgrades.rainbowCrystals || 0) + r;
      upgrades.redGems = (upgrades.redGems || 0) + rg;
      PermanentUpgrades.save(upgrades);

      // Add the code to the redeemed list with timestamp
      redeemedCodes.push({
        code: c.toUpperCase(),
        redeemedAt: new Date().toISOString(),
        rewards: { rainbow: r, redGems: rg }
      });
      localStorage.setItem('redeemedCodes', JSON.stringify(redeemedCodes));

      // Apply to active player if present
      try {
        if (window.game?.world?.player) {
          window.game.world.player.rainbowCrystals = (window.game.world.player.rainbowCrystals || 0) + r;
          window.game.world.player.redGems = (window.game.world.player.redGems || 0) + rg;
        }
      } catch (e) {
        console.error('Error applying promo to player:', e);
      }

      // Update HUD and upgrades display
      const rcEl = document.getElementById('rainbowCrystalCount');
      const redEl = document.getElementById('redGemCount');
      const upRC = document.getElementById('upgradesRainbowCrystals');
      const upRed = document.getElementById('upgradesRedGems');
      
      if (rcEl) rcEl.textContent = Math.floor(upgrades.rainbowCrystals || 0);
      if (redEl) redEl.textContent = Math.floor(upgrades.redGems || 0);
      if (upRC) upRC.textContent = Math.floor(upgrades.rainbowCrystals || 0);
      if (upRed) upRed.textContent = Math.floor(upgrades.redGems || 0);

      // Show success message
      if (msg) {
        let rewardText = [];
        if (r > 0) rewardText.push(`${r} Rainbow Crystals`);
        if (rg > 0) rewardText.push(`${rg} Red Gems`);
        
        msg.textContent = `Successfully redeemed ${found.code}! Received: ${rewardText.join(' and ')}`;
        msg.style.color = '#4CAF50';
      }
      
      // Clear the input field
      if (input) input.value = '';
      
      UI.showToast('Promo code redeemed successfully!');
      if (this.populatePromoScreen) this.populatePromoScreen(); // Refresh the promo screen if available
    },

    updatePlayerColorPreview(canvasEl, primary, secondary) {
      if (!canvasEl) return;
      try {
        const ctx = canvasEl.getContext('2d');
        ctx.clearRect(0,0,canvasEl.width,canvasEl.height);
        // draw primary circle
        ctx.fillStyle = primary || '#00d9ff';
        ctx.beginPath(); ctx.arc(50,50,34,0,Math.PI*2); ctx.fill();
        // draw secondary inner crescent
        ctx.fillStyle = secondary || 'rgba(255,255,255,0.3)';
        ctx.beginPath(); ctx.arc(62,44,18,0,Math.PI*2); ctx.fill();
      } catch (e) {}
    },
    
    showToast(msg) {
      const toast = this.elements.toast;
      toast.textContent = msg;
      toast.classList.add("show");
      setTimeout(() => toast.classList.remove("show"), 2200);
    }
  };

  // Game
  class Game {
    constructor() {
      const canvas = document.getElementById("game");
      if (!canvas) throw new Error("Canvas not found!");
      
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.running = false;
      this.lastTime = performance.now();
      this.isLoggedIn = false;
      
      this.devConsole = new DevConsole();
      
      this.resize();
      window.addEventListener("resize", () => this.resize());
      
      Input.init(canvas);
      
      this.setupLoginScreen();
      
      window.game = this;
    }
    
    setupLoginScreen() {
      const loginInput = document.getElementById("loginInput");
      const loginSubmitBtn = document.getElementById("loginSubmitBtn");
      const loginScreen = document.getElementById("loginScreen");
      
      const savedUser = localStorage.getItem("codered-user");
      if (savedUser) {
        Log.info("User already logged in: " + savedUser);
        loginScreen.style.display = "none";
        this.isLoggedIn = true;
        this.startLoading(savedUser);
        return;
      }
      
      const handleLogin = () => {
        const name = loginInput.value.trim();
        
        if (!name || name.length < 3) {
          loginInput.style.borderColor = "#ff3366";
          loginInput.placeholder = "Name must be at least 3 characters!";
          loginInput.value = "";
          setTimeout(() => {
            loginInput.style.borderColor = "#00d9ff";
            loginInput.placeholder = "Enter your name...";
          }, 2000);
          return;
        }
        
        if (/\d/.test(name)) {
          loginInput.style.borderColor = "#ff3366";
          loginInput.placeholder = "No numbers allowed!";
          loginInput.value = "";
          setTimeout(() => {
            loginInput.style.borderColor = "#00d9ff";
            loginInput.placeholder = "Enter your name...";
          }, 2000);
          return;
        }
        
        this.isLoggedIn = true;
        localStorage.setItem("codered-user", name);
        PlayerCounter.addPlayer(name);
        
        loginScreen.style.display = "none";
        this.startLoading(name);
      };
      
      loginSubmitBtn.addEventListener("click", handleLogin);
      loginInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          handleLogin();
        }
      });
      
      setTimeout(() => loginInput.focus(), 100);
    }
    
    startLoading(userName) {
      const loadingScreen = document.getElementById("loadingScreen");
      loadingScreen.style.display = "flex";
      
      let progress = 0;
      const loadingInterval = setInterval(() => {
        progress += 10;
        const loadingProgress = document.getElementById("loadingProgress");
        const loadingText = document.getElementById("loadingText");
        
        if (loadingProgress) {
          loadingProgress.style.width = progress + "%";
        }
        if (loadingText) {
          loadingText.textContent = progress + "%";
        }
        
        if (progress >= 100) {
          clearInterval(loadingInterval);
          setTimeout(() => {
            this.world = new World(this.canvas);
            this.world.isLoggedIn = true;
            this.world.userName = userName;
            
            const activeBtn = document.querySelector(".difficulty-btn.active");
            if (activeBtn) this.world.difficulty = activeBtn.dataset.difficulty;
            
            UI.init();
            
            const homeScreen = document.getElementById("homeScreen");
            
            if (loadingScreen) {
              loadingScreen.style.display = "none";
            }
            if (homeScreen) {
              homeScreen.style.display = "flex";
            }

            if (typeof window.__fadeOutMadeBySplash === "function") {
              window.__fadeOutMadeBySplash();
            }
            
            this.running = true;
            this.loop();
            Log.info("Game Ready! Logged in as: " + userName);
            UI.showToast("Welcome, " + userName + "!");
          }, 300);
        }
      }, 100);
    }
    
    loop() {
      if (!this.running) return;
      
      const now = performance.now();
      let dt = (now - this.lastTime) / 1000;
      if (dt > 0.1) dt = 0.1;
      this.lastTime = now;
      
      if (this.world && !this.devConsole.isOpen) {
        try {
          this.world.update(dt);
          this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
          this.world.draw();
        } catch (error) {
          Log.error("Game loop error:", error);
          this.running = false;
          alert("Game crashed! Check console (F12) for details. Reloading...");
          location.reload();
        }
      }
      
      requestAnimationFrame(() => this.loop());
    }

    resize() {
      this.canvas.width = Math.max(640, window.innerWidth);
      this.canvas.height = Math.max(480, window.innerHeight);
      if (this.world) {
        this.world.camera.w = this.canvas.width;
        this.world.camera.h = this.canvas.height;
      }
    }
  }

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", () => new Game());
  } else {
    new Game();
  }
})();

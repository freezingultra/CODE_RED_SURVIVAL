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
    constructor(x, y, isP1 = true) {
      this.x = x;
      this.y = y;
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
        { name: "SMG", dmg: 8, bullets: 1, spread: 6, fireRate: 0.08, magSize: Math.round(67 * 6.7) }, // 6.7x ammo for high fire rate
        { name: "Flamethrower", dmg: 6, bullets: 6, spread: 20, fireRate: 0.12, magSize: Math.round(60 * 6.7) }, // 6.7x ammo for high fire rate
        { name: "Plasma", dmg: 40, bullets: 1, spread: 2, fireRate: 0.6, magSize: 15 },
        { name: "LaserSweep", dmg: 25, bullets: 1, spread: 0.5, fireRate: 1.5, magSize: 10 },
        { name: "Rocket", dmg: 120, bullets: 1, spread: 3, fireRate: 1.8, magSize: 3 },
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
      this.color = isP1 ? (perm.playerColor || "#00d9ff") : "#00ff88";
      this.isP1 = isP1;
      this.canShoot = true;
      this.magAmmo = this.weapons[0].magSize; // Initialize with first weapon's mag size
      this.reloadTimer = 0;
      this.railgunSpinAngle = 0;
      this.reloadKeyPressed = false; // Track if R key was pressed to prevent continuous reload
      
      // Apply permanent upgrades if this is player 1
      if (isP1) {
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
      if (this.isP1) {
        // Use virtual joystick on mobile, keyboard on desktop
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
      } else {
        if (Input.keys['arrowup']) my -= 1;
        if (Input.keys['arrowdown']) my += 1;
        if (Input.keys['arrowleft']) mx -= 1;
        if (Input.keys['arrowright']) mx += 1;
      }

      const len = Math.hypot(mx, my);
      if (len > 0) { mx /= len; my /= len; }

      const upgrades2 = PermanentUpgrades.load();
      const controls2 = upgrades2.controls || PermanentUpgrades.getDefaults().controls;
      const speed = this.speed * this.speedMul * (Input.keys[controls2.sprint] ? 1.4 : 1);
      const newX = this.x + mx * speed * dt;
      const newY = this.y + my * speed * dt;

      if (!world.checkCollision(newX, this.y, this.radius)) this.x = newX;
      if (!world.checkCollision(this.x, newY, this.radius)) this.y = newY;

      this.x = clamp(this.x, this.radius, world.mapW * world.tileSize - this.radius);
      this.y = clamp(this.y, this.radius, world.mapH * world.tileSize - this.radius);

      this.shootCooldown -= dt;
      this.reloadTimer = Math.max(0, this.reloadTimer - dt);
      const weapon = this.weapons[this.weaponIndex];
      
      // Handle reloading when R is pressed or when out of ammo
      if (weapon.magSize !== undefined) {
        // Start reload if R is pressed and not already reloading
        if (Input.keys['r'] && !this.reloadKeyPressed && this.reloadTimer <= 0 && this.magAmmo < weapon.magSize) {
          this.reloadTimer = 3; // 3 second reload time
          this.reloadKeyPressed = true;
        }
        
        // Reset the reload key flag when R is released
        if (!Input.keys['r']) {
          this.reloadKeyPressed = false;
        }
        
        // Auto-reload when firing with an empty magazine
        if (this.magAmmo <= 0 && this.reloadTimer <= 0) {
          this.reloadTimer = 3; // 3 second reload time
        }
        
        // Handle magazine refill after reload timer finishes
        if (this.reloadTimer <= 0 && this.magAmmo < weapon.magSize) {
          this.magAmmo = weapon.magSize;
        }
      }
      if (this.canShoot && (Input.mouse.down || Input.keys[' ']) && this.shootCooldown <= 0) {
        this.fire(world);
      }
    }

    fire(world) {
      const weapon = this.weapons[this.weaponIndex];
      // Only check magazine if the weapon has one
      if (weapon.magSize !== undefined) {
        // Don't fire if reloading or no ammo
        if (this.reloadTimer > 0) return false;
        if (this.magAmmo <= 0) {
          // Start reloading if empty
          this.reloadTimer = 3; // 3 second reload time
          return false;
        }
        
        // Decrement ammo and check if we need to auto-reload
        this.magAmmo--;
        
        // Auto-reload when magazine is empty
        if (this.magAmmo <= 0) {
          this.reloadTimer = 3; // 3 second reload time
        }
      }
      
      // Special Railgun handling
      if (weapon.isRailgun) {
        if (this.shootCooldown > 0) return;
        this.shootCooldown = weapon.fireRate;
        
        // Create spinning laser
        const numLasers = 8;
        for (let i = 0; i < numLasers; i++) {
          const angle = (Math.PI * 2 / numLasers) * i + this.railgunSpinAngle;
          world.bullets.push({
            x: this.x,
            y: this.y,
            vx: 0,
            vy: 0,
            dmg: 150,
            owner: "player",
            radius: 6,
            travel: 0,
            maxTravel: Infinity,
            isLaser: true,
            angle: angle,
            lifetime: 0.5,
            age: 0,
            source: this
          });
        }
        this.railgunSpinAngle += 0.3;
        sfxShoot();
        return;
      }
      
      this.shootCooldown = weapon.fireRate;
      let angle;
      if (world.isMultiplayer) {
        const cam = this.isP1 ? world.camera1 : world.camera2;
        const mouseY = this.isP1 ? Input.mouse.y : Input.mouse.y - world.canvas.height / 2;
        angle = Math.atan2(mouseY + cam.y - this.y, Input.mouse.x + cam.x - this.x);
      } else {
        angle = Math.atan2(Input.mouse.y + world.camera.y - this.y, Input.mouse.x + world.camera.x - this.x);
      }

      for (let i = 0; i < weapon.bullets; i++) {
        const spread = (Math.random() - 0.5) * (weapon.spread * Math.PI / 180);
        const a = angle + spread;
        world.bullets.push({
          x: this.x + Math.cos(a) * 16,
          y: this.y + Math.sin(a) * 16,
          vx: Math.cos(a) * 850,
          vy: Math.sin(a) * 850,
          dmg: weapon.dmg,
          owner: "player",
          radius: 4,
          travel: 0,
          maxTravel: 1400
        });
      }
      if (weapon.magSize !== undefined) {
        this.magAmmo--;
        if (this.magAmmo <= 0) {
          this.reloadTimer = weapon.reloadTime;
        }
      }
      sfxShoot();
    }

    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);
      
      // Orange aura/glow effect
      const gradient = ctx.createRadialGradient(0, 0, this.radius, 0, 0, this.radius * 2);
      gradient.addColorStop(0, 'rgba(255, 165, 0, 0.6)');  // Orange with 60% opacity
      gradient.addColorStop(1, 'transparent');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 2, 0, Math.PI * 2);
      ctx.fill();
      
      // Body with blue gradient
      const bodyGradient = ctx.createRadialGradient(0, 0, this.radius * 0.7, 0, 0, this.radius);
      const primaryCol = this.color || '#00a8ff';
      const secondaryCol = this.secondaryColor || primaryCol;
      bodyGradient.addColorStop(0, primaryCol);
      bodyGradient.addColorStop(1, secondaryCol);
      
      ctx.fillStyle = bodyGradient;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fill();
      
      // Health bar above player
      if (this.hp < this.maxHp) {
        const barWidth = 30;
        const barHeight = 4;
        const healthPercent = this.hp / this.maxHp;
        
        ctx.save();
        ctx.translate(-barWidth/2, -this.radius - 10);
        
        // Background
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, barWidth, barHeight);
        
        // Health fill with gradient
        const healthGradient = ctx.createLinearGradient(0, 0, barWidth * healthPercent, 0);
        healthGradient.addColorStop(0, '#ff0000');
        healthGradient.addColorStop(0.5, '#ff9900');
        healthGradient.addColorStop(1, '#00ff00');
        
        ctx.fillStyle = healthGradient;
        ctx.fillRect(0, 0, barWidth * healthPercent, barHeight);
        
        // Border
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, 0, barWidth, barHeight);
        
        ctx.restore();
      }
      
      
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
      this.radius = type === "boss" ? 28 : 11;
      this.fireTimer = randRange(0.5, 2);
      this.bossSpawnTimer = 0;
      this.dead = false;
      
      // A* pathfinding properties
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
      const p = world.player;
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
            
            if (p.hp <= 0) {
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
    }

    draw(ctx) {
      const colors = { 
        basic: "#ff3366", 
        ranged: "#ff6633", 
        boss: "#aa0000" 
      };
      
      ctx.fillStyle = colors[this.type] || "#ff3366";
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      if (this.type === "ranged") {
        ctx.strokeStyle = "rgba(255, 153, 0, 0.3)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 175, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (this.hp < this.maxHp) {
        const barW = this.radius * 2, barH = 4;
        ctx.fillStyle = "rgba(0,0,0,0.8)";
        ctx.fillRect(this.x - this.radius, this.y + this.radius + 6, barW, barH);
        ctx.fillStyle = "#ff3366";
        ctx.fillRect(this.x - this.radius, this.y + this.radius + 6, (this.hp / this.maxHp) * barW, barH);
      }
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
      
      this.player = new Player(this.mapW * this.tileSize / 2, this.mapH * this.tileSize / 2, true);
      this.player2 = null;
      this.enemies = [];
      this.bullets = [];
      this.loots = [];
      this.particles = [];
      this.wave = 0;
      this.isRunning = false;
      this.isMultiplayer = false;
      this.isLoggedIn = !!localStorage.getItem("codered-user");
      this.userName = localStorage.getItem("codered-user") || "Guest";
      this.totalPlayTime = 0;
      this.winner = "";
      this.paused = false;
      this.cheatsUsed = false;
      this.camera = { x: 0, y: 0, w: canvas.width, h: canvas.height };
      this.camera1 = { x: 0, y: 0, w: canvas.width, h: canvas.height / 2 };
      this.camera2 = { x: 0, y: 0, w: canvas.width, h: canvas.height / 2 };
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
    }

    generateMaze() {
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
          if (rx < Math.floor(this.mapW / roomSize) - 1 && Math.random() > 0.3) {
            for (let x = roomSize - 1; x < roomSize + corridorWidth; x++) {
              for (let y = Math.floor(roomSize / 3); y < Math.floor(roomSize * 2 / 3); y++) {
                const mx = roomX + x, my = roomY + y;
                if (mx > 0 && my > 0 && mx < this.mapW - 1 && my < this.mapH - 1) {
                  this.map[my * this.mapW + mx] = 0;
                }
              }
            }
          }
          if (ry < Math.floor(this.mapH / roomSize) - 1 && Math.random() > 0.3) {
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
      const px = this.player.x, py = this.player.y;
      for (let attempts = 0; attempts < 20; attempts++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = randRange(500, 800);
        let x = px + Math.cos(angle) * dist;
        let y = py + Math.sin(angle) * dist;
        x = clamp(x, 32, this.mapW * this.tileSize - 32);
        y = clamp(y, 32, this.mapH * this.tileSize - 32);
        
        if (!this.checkCollision(x, y, 12)) {
          const mult = this.difficultySettings[this.difficulty];
          let hp, speed;
          
          if (type === "boss") {
            hp = randRange(500, 2000);
            speed = 55 * mult.enemySpeed;
          } else {
            hp = (18 + this.wave * 2.5) * mult.enemyHpMult;
            speed = 65 * mult.enemySpeed;
          }
          
          this.enemies.push(new Enemy(x, y, type, hp, speed));
          return;
        }
      }
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
      
      Log.info("Wave " + this.wave + " started! Duration: " + this.waveTimeLimit + " seconds");
      
      if (this.wave % 10 === 0) {
        this.spawnEnemy("boss");
        UI.showToast("🔥 BOSS WAVE " + this.wave + "! 🔥");
        Log.info("BOSS SPAWNED ON WAVE " + this.wave);
      } else {
        const enemyCount = this.wave;
        Log.info("Wave " + this.wave + ": Spawning " + enemyCount + " enemies initially");
        
        for (let i = 0; i < enemyCount; i++) {
          const type = Math.random() < 0.5 ? "basic" : "ranged";
          this.spawnEnemy(type);
        }
        
        UI.showToast("Wave " + this.wave + " - " + this.waveTimeLimit + "s - " + enemyCount + " enemies!");
      }
    }

    startMultiplayer() {
      this.isMultiplayer = true;
      this.isRunning = true;
      this.spawnTimer = 0;
      this.waveTimer = 0;
      this.waveTimeLimit = 300;
      this.player.hp = this.player.maxHp;
      this.player.color = "#00d9ff";
      this.player.weaponIndex = 2;
      this.player.weapons[2].magSize = 1;
      this.player.weapons[2].reloadTime = 15;
      this.player.magAmmo = 1;
      this.player.reloadTimer = 0;
      this.player2 = new Player(this.mapW * this.tileSize / 2 + randRange(200, 500), this.mapH * this.tileSize / 2 + randRange(200, 500), false);
      this.player2.hp = this.player2.maxHp;
      this.player2.color = "#00ff88";
      this.player2.canShoot = false;
      this.enemies = [];
      this.bullets = [];
      this.loots = [];
      Log.info("Multiplayer started! P1 hunt P2 for 5 min");
      UI.showToast("Multiplayer: P1 hunt P2!");
    }

    startMultiplayerGame(gameCode, mapSeed, isCreator) {
      // Use the provided map seed for consistent map generation
      this.mapSeed = mapSeed;
      
      // Regenerate maze with seed for consistency
      this.generateMazeWithSeed(mapSeed);
      
      // Initialize multiplayer client
      this.multiplayerClient = new MultiplayerClient();
      this.isMultiplayer = true;
      this.isGlobalMultiplayer = true;
      this.gameCode = gameCode;
      this.isCreator = isCreator;
      
      // Setup multiplayer event listeners
      this.multiplayerClient.on('joined', (data) => {
        this.player.color = data.playerColor;
        Log.info("Joined multiplayer game: " + gameCode);
        UI.showToast("Connected to multiplayer game!");
        this.startWave();
      });

      this.multiplayerClient.on('player_joined', (data) => {
        Log.info("Player joined: " + data.playerName);
        UI.showToast(data.playerName + " joined the game!");
      });

      this.multiplayerClient.on('player_update', (data) => {
        if (this.player2) {
          this.player2.x = data.x;
          this.player2.y = data.y;
          this.player2.hp = data.hp;
          this.player2.weaponIndex = data.weaponIndex;
        }
      });

      this.multiplayerClient.on('player_left', () => {
        Log.info("Other player disconnected");
        UI.showToast("Other player disconnected!");
        this.gameOver();
      });

      this.multiplayerClient.on('disconnected', () => {
        Log.info("Disconnected from multiplayer server");
        if (this.isRunning) {
          UI.showToast("Connection lost!");
          this.gameOver();
        }
      });

      this.multiplayerClient.on('error', (data) => {
        Log.error("Multiplayer error:", data);
        UI.showToast("Multiplayer error: " + data.message);
      });

      // Connect to server (uses configured Render URL from multiplayer_client.js)
      this.multiplayerClient.connect(gameCode, this.userName).then(() => {
        Log.info("Multiplayer connection established");
        
        // Initialize player2 (remote player)
        this.player2 = new Player(
          this.mapW * this.tileSize / 2 + randRange(200, 500),
          this.mapH * this.tileSize / 2 + randRange(200, 500),
          false
        );
        this.player2.color = this.multiplayerClient.playerColor === "#00d9ff" ? "#00ff88" : "#00d9ff";
        
        this.isRunning = true;
        this.startWave();
      }).catch(error => {
        Log.error("Failed to connect to multiplayer:", error);
        UI.showToast("Failed to connect to multiplayer server!");
      });
    }

    generateMazeWithSeed(seed) {
      // Use seed to generate deterministic maze
      const seededRandom = (s) => {
        const x = Math.sin(s) * 10000;
        return x - Math.floor(x);
      };

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
          if (rx < Math.floor(this.mapW / roomSize) - 1 && seededRandom(seed + rx + ry * 100) > 0.3) {
            for (let x = roomSize - 1; x < roomSize + corridorWidth; x++) {
              for (let y = Math.floor(roomSize / 3); y < Math.floor(roomSize * 2 / 3); y++) {
                const mx = roomX + x, my = roomY + y;
                if (mx > 0 && my > 0 && mx < this.mapW - 1 && my < this.mapH - 1) {
                  this.map[my * this.mapW + mx] = 0;
                }
              }
            }
          }
          if (ry < Math.floor(this.mapH / roomSize) - 1 && seededRandom(seed + rx * 100 + ry) > 0.3) {
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

    async gameOver() {
      if (this.isRunning === false && this.paused === true) {
        return; // Already called gameOver, prevent duplicate
      }
      this.isRunning = false;
      this.paused = true;
      
      // Save red gems to permanent upgrades (only once)
      const upgrades = PermanentUpgrades.load();
      upgrades.redGems = (upgrades.redGems || 0) + (this.player.redGems || 0);
      upgrades.rainbowCrystals = (upgrades.rainbowCrystals || 0) + (this.player.rainbowCrystals || 0);
      PermanentUpgrades.save(upgrades);
      
      if (this.isMultiplayer) {
        UI.showGameOver(this.winner + " Wins!", 0, 0);
      } else {
        const sd = Save.load();
        sd.coins += Math.floor(this.player.coins);
        if (this.wave > sd.bestWave) sd.bestWave = this.wave;
        Save.save(sd);
        
        if (!this.cheatsUsed) {
          await Leaderboard.addScore(this.userName, this.wave, this.difficulty, this.player.kills);
          if (this.player && this.player.hp <= 0) {
            UI.showGameOver("YOU DIED!", this.player.kills, Math.floor(this.player.coins));
          } else {
            UI.showGameOver(this.wave, this.player.kills, Math.floor(this.player.coins));
          }
        } else {
          if (this.player && this.player.hp <= 0) {
            UI.showGameOver("YOU DIED!", this.player.kills, Math.floor(this.player.coins));
          } else {
            UI.showGameOver(this.wave, this.player.kills, Math.floor(this.player.coins));
          }
          UI.showToast("⚠️ Cheats Used - Score Not Submitted to Leaderboard");
          Log.warn("Score not submitted - cheats were used");
        }
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
      Save.save(sd);
      UI.showToast(`Wave ${this.wave} complete! +${coinReward} coins and +25 HP. Press SPACE for next wave!`);
      Log.info(`Wave ${this.wave} complete! Press SPACE to continue.`);
    }

    update(dt) {
      if (this.paused) return;
      
      if (!this.isLoggedIn) {
        this.totalPlayTime += dt;
        if (this.totalPlayTime >= 450) {
          this.gameOver();
          UI.showToast("Guest time limit reached! Login to continue.");
          return;
        }
      }
      
      if (!this.isRunning && !this.isMultiplayer && Input.keys[' ']) {
        this.startWave();
      }
      
      if (this.isMultiplayer) {
        this.player.update(dt, this);
        this.player2.update(dt, this);
        
        this.waveTimer += dt;
        if (this.waveTimer >= this.waveTimeLimit) {
          this.winner = "Player 2";
          this.gameOver();
          return;
        }
        
        this.spawnTimer += dt;
        if (this.spawnTimer >= 10) {
          this.spawnTimer = 0;
          
          if (this.enemies.length < CONFIG.maxEnemies) {
            let x, y;
            let attempts = 0;
            do {
              x = randRange(32, this.mapW * this.tileSize - 32);
              y = randRange(32, this.mapH * this.tileSize - 32);
              attempts++;
            } while (this.checkCollision(x, y, 7) && attempts < 20);
            if (attempts < 20) {
              this.loots.push({
                x: x,
                y: y,
                type: "health",
                value: 50,
                radius: 7,
                    age: 0,
                    lifetime: 30,
                    pickupDelay: 0.12
              });
            }
          }
        }
        
        for (let i = this.bullets.length - 1; i >= 0; i--) {
          const b = this.bullets[i];
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          b.travel += Math.hypot(b.vx * dt, b.vy * dt);
          
          if (b.travel > b.maxTravel || this.checkCollision(b.x, b.y, b.radius)) {
            this.bullets.splice(i, 1);
            continue;
          }
          
          const collisionDist = (b.radius + this.player2.radius) * (b.radius + this.player2.radius);
          if (dist2(b.x, b.y, this.player2.x, this.player2.y) < collisionDist) {
            const dmg = b.dmg * (1 - (this.player2.armor || 0));
            this.player2.hp -= dmg;
            Log.info("P2 HIT! Took " + Math.round(dmg) + " damage. HP: " + Math.round(this.player2.hp));
            this.bullets.splice(i, 1);
            this.spawnParticles(this.player2.x, this.player2.y, 10, "#ffaaaa");
            sfxHit();
            if (this.player2.hp <= 0) {
              this.winner = "Player 1";
              this.gameOver();
            }
          }
        }
        
        if (this.bullets.length > CONFIG.maxBullets) {
          this.bullets.splice(0, this.bullets.length - CONFIG.maxBullets);
          Log.warn("Bullet limit reached, removing oldest bullets");
        }
        
        for (let i = this.particles.length - 1; i >= 0; i--) {
          const p = this.particles[i];
          p.age += dt;
          if (p.age >= p.life) {
            this.particles.splice(i, 1);
            continue;
          }
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vy += 100 * dt;
        }
        
        if (this.particles.length > CONFIG.maxParticles) {
          this.particles.splice(0, this.particles.length - CONFIG.maxParticles);
        }
        
        for (let i = this.loots.length - 1; i >= 0; i--) {
          const l = this.loots[i];
          l.age += dt;
          if (l.age >= l.lifetime) {
            this.loots.splice(i, 1);
            continue;
          }
          
          const pickupRadius1 = l.radius + this.player.radius + (12 * (this.player.pickupRadius || 1));
          const pickupDistSq1 = pickupRadius1 * pickupRadius1;
          if (dist2(l.x, l.y, this.player.x, this.player.y) < pickupDistSq1) {
            if (l.type === "health") {
              this.player.hp = Math.min(this.player.maxHp, this.player.hp + l.value);
            } else if (l.type === "coin") {
              this.player.coins += l.value;
            } else if (l.type === "gem") {
              this.player.gems += l.value;
            }
            this.loots.splice(i, 1);
            sfxPickup();
            continue;
          }
          
          const pickupRadius2 = l.radius + this.player2.radius + (12 * (this.player2.pickupRadius || 1));
          const pickupDistSq2 = pickupRadius2 * pickupRadius2;
          if (dist2(l.x, l.y, this.player2.x, this.player2.y) < pickupDistSq2) {
            if (l.type === "health") {
              this.player2.hp = Math.min(this.player2.maxHp, this.player2.hp + l.value);
            } else if (l.type === "coin") {
              this.player2.coins += l.value;
            } else if (l.type === "gem") {
              this.player2.gems += l.value;
            }
            this.loots.splice(i, 1);
            sfxPickup();
          }
        }
        
        const targetX1 = clamp(this.player.x - this.camera1.w / 2, 0, this.mapW * this.tileSize - this.camera1.w);
        const targetY1 = clamp(this.player.y - this.camera1.h / 2, 0, this.mapH * this.tileSize - this.camera1.h);
        this.camera1.x += (targetX1 - this.camera1.x) * 0.1;
        this.camera1.y += (targetY1 - this.camera1.y) * 0.1;
        
        const targetX2 = clamp(this.player2.x - this.camera2.w / 2, 0, this.mapW * this.tileSize - this.camera2.w);
        const targetY2 = clamp(this.player2.y - this.camera2.h / 2, 0, this.mapH * this.tileSize - this.camera2.h);
        this.camera2.x += (targetX2 - this.camera2.x) * 0.1;
        this.camera2.y += (targetY2 - this.camera2.y) * 0.1;
        
        UI.updateHUD(this);
        return;
      }
      
      if (this.isRunning) {
        this.waveTimer += dt;
        
        if (this.waveTimer >= this.waveTimeLimit) {
          Log.info("Wave " + this.wave + " time limit reached!");
          this.endWave();
          return;
        }
        
        this.spawnTimer += dt;
        if (this.spawnTimer >= CONFIG.spawnDelay) {
          this.spawnTimer = 0;
          
          if (this.enemies.length < CONFIG.maxEnemies) {
            if (this.wave % 10 !== 0) {
              const type = Math.random() < 0.5 ? "basic" : "ranged";
              this.spawnEnemy(type);
              Log.info("Spawned " + type + " (total: " + this.enemies.length + "/" + CONFIG.maxEnemies + ")");
            }
          } else {
            Log.warn("Enemy limit reached: " + CONFIG.maxEnemies);
          }
        }
      }
      
      this.player.update(dt, this);
      
      for (let i = this.bullets.length - 1; i >= 0; i--) {
        const b = this.bullets[i];
        
        if (b.isLaser) {
          // Handle laser rendering and collision
          const range = 1200;
          const endX = b.source.x + Math.cos(b.angle) * range;
          const endY = b.source.y + Math.sin(b.angle) * range;
          
          b.age += dt;
          if (b.age >= b.lifetime) {
            this.bullets.splice(i, 1);
            continue;
          }
          
          // Check collision with enemies
          for (let j = this.enemies.length - 1; j >= 0; j--) {
            const e = this.enemies[j];
            const dx = e.x - b.source.x;
            const dy = e.y - b.source.y;
            const distToEnemy = Math.hypot(dx, dy);
            
            // Check if enemy is in front of laser
            const dotProduct = dx * Math.cos(b.angle) + dy * Math.sin(b.angle);
            if (dotProduct > 0 && dotProduct < range) {
              // Check perpendicular distance
              const perpDist = Math.abs(dx * Math.sin(b.angle) - dy * Math.cos(b.angle));
              if (perpDist < e.radius + 15) {
                e.hp -= b.dmg * dt * 10; // Continuous damage
                if (e.hp <= 0) {
                  e.dead = true;
                  this.player.kills++;
                  Log.info("ENEMY KILLED BY RAILGUN!");
                  
                  const lootCount = e.type === "boss" ? 12 : 4 + Math.floor(Math.random() * 4);
                  for (let k = 0; k < lootCount; k++) {
                    const rand = Math.random();
                    let lootType = "coin";
                    let value = 1;
                    
                    if (rand < 0.5) { // 50% - 1 red gem
                      lootType = "redGem";
                      value = 1;
                    } else if (rand < 0.75) { // 25% - 4 red gems
                      lootType = "redGem";
                      value = 4;
                    } else if (rand < 0.775) { // 2.5% - 400 red gems
                      lootType = "redGem";
                      value = 400;
                    } else if (rand < 0.7750000067) { // 0.0000000067% - 600,000 red gems
                      lootType = "redGem";
                      value = 600000;
                    }
                    
                    this.loots.push({
                      x: e.x + randRange(-12, 12),
                      y: e.y + randRange(-12, 12),
                      type: lootType,
                      value: value,
                      radius: lootType === "redGem" ? 9 : 7,
                      age: 0,
                      lifetime: 30,
                      pickupDelay: 0.12
                    });
                  }
                  this.spawnParticles(e.x, e.y, 30, e.type === "boss" ? "#ff0000" : "#ff8888");
                  sfxExplosion();
                }
              }
            }
          }
          continue;
        }
        
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.travel += Math.hypot(b.vx * dt, b.vy * dt);
        
        if (b.travel > b.maxTravel || this.checkCollision(b.x, b.y, b.radius)) {
          this.bullets.splice(i, 1);
        }
      }
      
      if (this.bullets.length > CONFIG.maxBullets) {
        this.bullets.splice(0, this.bullets.length - CONFIG.maxBullets);
        Log.warn("Bullet limit reached, removing oldest bullets");
      }
      
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const e = this.enemies[i];
        e.update(dt, this);
        if (e.dead) this.enemies.splice(i, 1);
      }
      
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.age += dt;
        if (p.age >= p.life) {
          this.particles.splice(i, 1);
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 100 * dt;
      }
      
      if (this.particles.length > CONFIG.maxParticles) {
        this.particles.splice(0, this.particles.length - CONFIG.maxParticles);
      }
      
      for (let i = this.loots.length - 1; i >= 0; i--) {
        const l = this.loots[i];
        l.age += dt;
        if (l.age >= l.lifetime) {
          this.loots.splice(i, 1);
        }
      }
      
      for (let i = this.bullets.length - 1; i >= 0; i--) {
        const b = this.bullets[i];
        
        if (b.owner === "player") {
          for (let j = this.enemies.length - 1; j >= 0; j--) {
            const e = this.enemies[j];
            const collisionDist = (b.radius + e.radius) * (b.radius + e.radius);
            if (dist2(b.x, b.y, e.x, e.y) < collisionDist) {
              e.hp -= b.dmg;
              Log.info("HIT! Enemy took " + b.dmg + " damage. HP: " + Math.round(e.hp) + "/" + e.maxHp);
              this.bullets.splice(i, 1);
              this.spawnParticles(b.x, b.y, 5, "#ffcc88");
              
              if (e.hp <= 0) {
                e.dead = true;
                this.player.kills++;
                Log.info("ENEMY KILLED! Type: " + e.type);
                
                const lootCount = e.type === "boss" ? 14 : 4 + Math.floor(Math.random() * 4);
                for (let k = 0; k < lootCount; k++) {
                  const rand = Math.random();
                  let lootType = "coin";
                  let value = 1;

                  // Coins, green gems, red gems, and rainbow crystals
                  if (rand < 0.40) { // 40% -> coins (small)
                    lootType = "coin";
                    value = 1 + Math.floor(Math.random() * 3); // 1-3 coins
                  } else if (rand < 0.65) { // 25% -> green gem
                    lootType = "gem";
                    value = 1;
                  } else if (rand < 0.90) { // 25% -> rainbow crystal
                    lootType = "rainbowCrystal";
                    value = 1;
                  } else if (rand < 0.94) { // 4% -> small red gem
                    lootType = "redGem";
                    value = 1;
                  } else if (rand < 0.95) { // 1% -> 4 red gems
                    lootType = "redGem";
                    value = 4;
                  } else { // fallback to coin
                    lootType = "coin";
                    value = 1;
                  }

                  this.loots.push({
                    x: e.x + randRange(-12, 12),
                    y: e.y + randRange(-12, 12),
                    type: lootType,
                    value: value,
                    radius: lootType === "rainbowCrystal" ? 10 : (lootType === "redGem" ? 9 : 7),
                    age: 0,
                    lifetime: 30,
                    pickupDelay: lootType === "rainbowCrystal" ? 0.5 : 0.12
                  });
                }
                this.spawnParticles(e.x, e.y, 20, e.type === "boss" ? "#ff0000" : "#ff8888");
                sfxExplosion();
              } else {
                sfxHit();
              }
              break;
            }
          }
        } else if (b.owner === "enemy") {
          const collisionDist = (b.radius + this.player.radius) * (b.radius + this.player.radius);
          if (dist2(b.x, b.y, this.player.x, this.player.y) < collisionDist) {
            const dmg = b.dmg * (1 - (this.player.armor || 0));
            this.player.hp -= dmg;
            Log.info("PLAYER HIT! Took " + Math.round(dmg) + " damage. HP: " + Math.round(this.player.hp));
            this.bullets.splice(i, 1);
            this.spawnParticles(this.player.x, this.player.y, 10, "#ffaaaa");
            sfxHit();
            if (this.player.hp <= 0) {
              Log.info("PLAYER DIED!");
              this.gameOver();
            }
          }
        }
      }
      
      for (const e of this.enemies) {
        const dx = this.player.x - e.x;
        const dy = this.player.y - e.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const touchDistance = e.radius + this.player.radius;
        
        if (distance < touchDistance) {
          let rawDmg = 25 * dt;
          
          if (e.type === "boss") {
            rawDmg = 50 * dt;
          }
          
          const dmg = rawDmg * (1 - (this.player.armor || 0));
          this.player.hp -= dmg;
          
          Log.info("ENEMY CONTACT! Type: " + e.type + " dealing " + Math.round(rawDmg) + " dmg/sec. Player HP: " + Math.round(this.player.hp));
          
          if (Math.random() < 0.3) {
            this.spawnParticles(this.player.x, this.player.y, 2, "#ff0000");
          }
          
          if (this.player.hp <= 0) {
            Log.info("PLAYER KILLED BY ENEMY CONTACT!");
            this.gameOver();
          }
        }
      }
      
      for (let i = this.loots.length - 1; i >= 0; i--) {
        const l = this.loots[i];
        const pickupRadius = l.radius + this.player.radius + (12 * (this.player.pickupRadius || 1));
        const pickupDistSq = pickupRadius * pickupRadius;
        // Respect pickup delay to allow players to see loot spawned (especially large rainbow crystals)
        if ((l.age >= (l.pickupDelay || 0)) && dist2(l.x, l.y, this.player.x, this.player.y) < pickupDistSq) {
          if (l.type === "coin") {
            this.player.coins += l.value;
          } else if (l.type === "gem") {
            this.player.gems += l.value;
          } else if (l.type === "redGem") {
            this.player.redGems = (this.player.redGems || 0) + l.value;
          } else if (l.type === "rainbowCrystal") {
            this.player.rainbowCrystals = (this.player.rainbowCrystals || 0) + l.value;
          } else if (l.type === "health") {
            this.player.hp = Math.min(this.player.maxHp, this.player.hp + l.value);
          }
          this.loots.splice(i, 1);
          sfxPickup();
        }
      }
      
      if (this.isRunning && this.waveTimer >= this.waveTimeLimit) {
        this.endWave();
      }
      
      const targetX = clamp(this.player.x - this.camera.w / 2, 0, this.mapW * this.tileSize - this.camera.w);
      const targetY = clamp(this.player.y - this.camera.h / 2, 0, this.mapH * this.tileSize - this.camera.h);
      this.camera.x += (targetX - this.camera.x) * 0.1;
      this.camera.y += (targetY - this.camera.y) * 0.1;
      
      this.updateHTMLHUD();
      
      UI.updateHUD(this);
    }
    
    updateHTMLHUD() {
      if (this.isMultiplayer) return;
      
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
      
      if (this.isMultiplayer) {
        const h = this.canvas.height / 2;
        const w = this.canvas.width;
        
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, w, h);
        ctx.clip();
        ctx.translate(-this.camera1.x, -this.camera1.y);
        this.drawWorld(ctx);
        ctx.restore();
        
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, h, w, h);
        ctx.clip();
        ctx.translate(0, h);
        ctx.translate(-this.camera2.x, -this.camera2.y);
        this.drawWorld(ctx);
        ctx.restore();
        
        ctx.fillStyle = "white";
        ctx.font = "20px monospace";
        ctx.fillText("P1 HP: " + Math.round(this.player.hp), 10, 30);
        ctx.fillText("P2 HP: " + Math.round(this.player2.hp), 10, 60);
        const timeLeft = this.waveTimeLimit - this.waveTimer;
        const mins = Math.floor(timeLeft / 60);
        const secs = Math.floor(timeLeft % 60).toString().padStart(2, '0');
        ctx.fillText("Time: " + mins + ":" + secs, w / 2 - 50, 30);
        ctx.fillText("Players: " + PlayerCounter.getCount(), w - 150, 30);
        
        ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
        ctx.font = "14px monospace";
        ctx.fillText("v1.0.70", w - 60, this.canvas.height - 10);
      } else {
        ctx.save();
        ctx.translate(-this.camera.x, -this.camera.y);
        this.drawWorld(ctx);
        ctx.restore();
        
        ctx.fillStyle = "white";
        ctx.font = "bold 18px monospace";
        
        ctx.save();
        
        ctx.fillStyle = 'rgba(20, 20, 30, 0.85)';
        ctx.strokeStyle = '#00d9ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(20, 20, 220, 100, 10);
        ctx.fill();
        ctx.stroke();
        
        ctx.font = 'bold 16px "Segoe UI", sans-serif';
        ctx.fillStyle = '#ffffff';
        
        const hpPercent = this.player.hp / this.player.maxHp;
        const hpColor = hpPercent > 0.6 ? '#00ff88' : hpPercent > 0.3 ? '#ffaa00' : '#ff3366';
        ctx.fillText('HEALTH:', 40, 45);
        ctx.fillStyle = hpColor;
        ctx.fillText(`${Math.round(this.player.hp)}/${this.player.maxHp}`, 120, 45);
        
        ctx.fillStyle = '#ffffff';
        ctx.fillText('COINS:', 40, 70);
        ctx.fillStyle = '#ffdd00';
        ctx.fillText(Math.floor(this.player.coins), 120, 70);
        
        ctx.fillStyle = '#ffffff';
        ctx.fillText('KILLS:', 40, 95);
        ctx.fillStyle = '#00d9ff';
        ctx.fillText(this.player.kills, 120, 95);
        
        ctx.restore();
        
        ctx.save();
        ctx.font = 'bold 22px "Segoe UI", sans-serif';
        ctx.fillStyle = 'rgba(0, 217, 255, 0.9)';
        ctx.textAlign = 'center';
        
        if (this.isRunning) {
          const timeLeft = this.waveTimeLimit - this.waveTimer;
          const mins = Math.floor(timeLeft / 60);
          const secs = Math.floor(timeLeft % 60).toString().padStart(2, '0');
          ctx.fillText(`WAVE ${this.wave} - ${mins}:${secs}`, this.canvas.width/2, 40);
        } else {
          ctx.fillText(`PRESS SPACE TO START WAVE ${this.wave + 1}`, this.canvas.width/2, 40);
        }
        
        ctx.restore();
      }
      
      this.drawMinimap(ctx);
    }

    drawWorld(ctx) {
      const cam = this.isMultiplayer ? (ctx.getTransform().f === 0 ? this.camera1 : this.camera2) : this.camera;
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
            ctx.fillStyle = ((x + y) % 2 === 0) ? "#0e0e0e" : "#111111";
            ctx.fillRect(tx, ty, this.tileSize, this.tileSize);
          }
        }
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
          // Draw spinning laser
          const range = 1200;
          const endX = b.source.x + Math.cos(b.angle) * range;
          const endY = b.source.y + Math.sin(b.angle) * range;
          
          ctx.save();
          ctx.globalAlpha = 0.8;
          ctx.strokeStyle = "#00ff00";
          ctx.lineWidth = 8;
          ctx.lineCap = "round";
          ctx.shadowColor = "#00ff00";
          ctx.shadowBlur = 15;
          ctx.beginPath();
          ctx.moveTo(b.source.x, b.source.y);
          ctx.lineTo(endX, endY);
          ctx.stroke();
          ctx.globalAlpha = 0.4;
          ctx.strokeStyle = "#00aa00";
          ctx.lineWidth = 15;
          ctx.beginPath();
          ctx.moveTo(b.source.x, b.source.y);
          ctx.lineTo(endX, endY);
          ctx.stroke();
          ctx.restore();
        } else {
          ctx.fillStyle = b.owner === "player" ? "#ffff00" : "#ff3366";
          ctx.strokeStyle = b.owner === "player" ? "#ffaa00" : "#aa0000";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      }
      
      for (const e of this.enemies) e.draw(ctx);
      
      this.player.draw(ctx);
      if (this.player2) this.player2.draw(ctx);
      
      for (const p of this.particles) {
        const t = 1 - (p.age / p.life);
        ctx.globalAlpha = t;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * t, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    drawMinimap(ctx) {
      if (this.isMultiplayer) return;
      
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
        promoScreen: document.getElementById("promoScreen"),
        multiplayerScreen: document.getElementById("multiplayerScreen")
      };
      
      const multiplayerBtn = document.getElementById("multiplayerBtn");
      if (multiplayerBtn) {
        multiplayerBtn.addEventListener("click", () => {
          console.log("[Multiplayer] Button clicked");
          this.elements.homeScreen.style.display = "none";
          
          // Fetch multiplayerScreen if not already cached
          if (!this.elements.multiplayerScreen) {
            this.elements.multiplayerScreen = document.getElementById("multiplayerScreen");
            console.log("[Multiplayer] Fetched multiplayerScreen from DOM:", this.elements.multiplayerScreen ? "found" : "not found");
          }
          
          if (this.elements.multiplayerScreen) {
            console.log("[Multiplayer] Showing multiplayer screen");
            this.elements.multiplayerScreen.style.display = "flex";
            this.setupMultiplayerUI();
          } else {
            console.error("[Multiplayer] multiplayerScreen element not found in DOM!");
          }
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
      // Initialize from JS fallback
      this.promoCodes = window.PROMO_CODES || [];

      this.bindEvents();
      this.updateHomeStats();
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
          window.game.world.startWave();
          // Show mobile controls when game starts (if mobile device)
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
          window.game.world.startWave();
          // Show mobile controls when game starts (if mobile device)
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
      
      if (world.isMultiplayer) {
        return;
      }
      
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
    
    showGameOver(wave, kills, coins) {
      // If wave is a string (custom message), show it but still display kills/coins if provided
      if (typeof wave === "string") {
        document.getElementById("finalWave").textContent = wave;
        document.getElementById("finalKills").textContent = typeof kills !== 'undefined' && kills !== null ? kills : "";
        document.getElementById("finalCoins").textContent = typeof coins !== 'undefined' && coins !== null ? coins : "";
      } else {
        document.getElementById("finalWave").textContent = wave;
        document.getElementById("finalKills").textContent = kills;
        document.getElementById("finalCoins").textContent = coins;
      }
      this.elements.gameOverScreen.style.display = "flex";
      // Hide mobile controls when game over
      const mobileControls = document.getElementById('mobileControls');
      if (mobileControls) {
        mobileControls.style.display = "none";
      }
    },
    
    openShop() {
      if (!window.game || !window.game.world) return;
      
      window.game.world.paused = true;
      const playerCoins = Math.floor(window.game.world.player.coins);
      const playerGems = Math.floor(window.game.world.player.gems);
      
      document.getElementById("shopCoins").textContent = playerCoins;
      document.getElementById("shopGems").textContent = playerGems;
      this.populateShop(playerCoins);
      this.elements.shopScreen.style.display = "flex";
      // Hide mobile controls when shop is open
      const mobileControls = document.getElementById('mobileControls');
      if (mobileControls) {
        mobileControls.style.display = "none";
      }
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
          { name: "Buy Railgun (temp)", desc: "Temporary Railgun (short trial)", cost: 500, weaponIndex: 4 },
          { name: "Buy SMG (temp)", desc: "Lightweight rapid-fire", cost: 90, weaponIndex: 5 },
          { name: "Buy Flamethrower (temp)", desc: "Close-range crowd control", cost: 110, weaponIndex: 6 },
          { name: "Buy Plasma (temp)", desc: "Heavy plasma bolts", cost: 180, weaponIndex: 7 },
          { name: "Buy LaserSweep (temp)", desc: "Precision sweeping laser", cost: 150, weaponIndex: 8 },
          { name: "Buy Rocket (temp)", desc: "High-damage rocket launcher", cost: 280, weaponIndex: 9 }
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
    },

    setupMultiplayerUI() {
      const createBtn = document.getElementById("createGameBtn");
      const joinBtn = document.getElementById("joinGameBtn");
      const confirmCreateBtn = document.getElementById("confirmCreateBtn");
      const confirmJoinBtn = document.getElementById("confirmJoinBtn");
      const cancelWaitBtn = document.getElementById("cancelWaitBtn");
      const multiplayerCloseBtn = document.getElementById("multiplayerCloseBtn");

      const createPanel = document.getElementById("createGamePanel");
      const joinPanel = document.getElementById("joinGamePanel");
      const waitingPanel = document.getElementById("waitingPanel");

      // Create Game button
      if (createBtn) {
        createBtn.onclick = () => {
          createPanel.style.display = "block";
          joinPanel.style.display = "none";
          waitingPanel.style.display = "none";
        };
      }

      // Join Game button
      if (joinBtn) {
        joinBtn.onclick = () => {
          createPanel.style.display = "none";
          joinPanel.style.display = "block";
          waitingPanel.style.display = "none";
          document.getElementById("joinCodeInput").focus();
        };
      }

      // Confirm Create button
      if (confirmCreateBtn) {
        confirmCreateBtn.onclick = async () => {
          try {
            confirmCreateBtn.disabled = true;
            confirmCreateBtn.textContent = "Creating...";

            const api = new MultiplayerAPI();
            const result = await api.createGame(window.game.world.userName, Math.random());

            const gameCode = result.code;
            const mapSeed = result.mapSeed;

            // Show waiting panel
            createPanel.style.display = "none";
            waitingPanel.style.display = "block";
            document.getElementById("gameCode").textContent = gameCode;
            document.getElementById("waitingCode").textContent = gameCode;

            // Store for later use
            window.multiplayerGameCode = gameCode;
            window.multiplayerMapSeed = mapSeed;
            window.multiplayerIsCreator = true;

            // Start waiting for player
            UI.waitForMultiplayerPlayer(gameCode, mapSeed);
          } catch (error) {
            console.error("Failed to create game:", error);
            UI.showToast("Failed to create game. Check server connection.");
            confirmCreateBtn.disabled = false;
            confirmCreateBtn.textContent = "✨ Create & Start Waiting";
          }
        };
      }

      // Confirm Join button
      if (confirmJoinBtn) {
        confirmJoinBtn.onclick = async () => {
          const code = document.getElementById("joinCodeInput").value.toUpperCase();

          if (!code || code.length !== 4) {
            UI.showToast("Enter a valid 4-letter code!");
            return;
          }

          try {
            confirmJoinBtn.disabled = true;
            confirmJoinBtn.textContent = "Joining...";

            const api = new MultiplayerAPI();
            const result = await api.joinGame(code, window.game.world.userName);

            const mapSeed = result.mapSeed;

            // Store for later use
            window.multiplayerGameCode = code;
            window.multiplayerMapSeed = mapSeed;
            window.multiplayerIsCreator = false;

            // Start game immediately
            UI.startMultiplayerGame(code, mapSeed, false);
          } catch (error) {
            console.error("Failed to join game:", error);
            UI.showToast("Game not found or is full!");
            confirmJoinBtn.disabled = false;
            confirmJoinBtn.textContent = "🎮 Join Game";
          }
        };
      }

      // Cancel Wait button
      if (cancelWaitBtn) {
        cancelWaitBtn.onclick = () => {
          window.multiplayerGameCode = null;
          window.multiplayerMapSeed = null;
          createPanel.style.display = "none";
          joinPanel.style.display = "none";
          waitingPanel.style.display = "none";
          this.elements.multiplayerScreen.style.display = "none";
          this.elements.homeScreen.style.display = "flex";
        };
      }

      // Close button
      if (multiplayerCloseBtn) {
        multiplayerCloseBtn.onclick = () => {
          window.multiplayerGameCode = null;
          window.multiplayerMapSeed = null;
          createPanel.style.display = "none";
          joinPanel.style.display = "none";
          waitingPanel.style.display = "none";
          this.elements.multiplayerScreen.style.display = "none";
          this.elements.homeScreen.style.display = "flex";
        };
      }
    },

    async waitForMultiplayerPlayer(gameCode, mapSeed) {
      const api = new MultiplayerAPI();
      let checkCount = 0;
      const maxChecks = 120; // 2 minutes max wait

      const checkInterval = setInterval(async () => {
        checkCount++;

        try {
          const info = await api.getGameInfo(gameCode);

          if (info.playerCount >= 2) {
            clearInterval(checkInterval);
            UI.startMultiplayerGame(gameCode, mapSeed, true);
          } else if (checkCount >= maxChecks) {
            clearInterval(checkInterval);
            UI.showToast("Waiting timeout. Returning to menu.");
            setTimeout(() => {
              document.getElementById("createGamePanel").style.display = "none";
              document.getElementById("waitingPanel").style.display = "none";
              this.elements.multiplayerScreen.style.display = "none";
              this.elements.homeScreen.style.display = "flex";
            }, 1000);
          }
        } catch (error) {
          console.error("Error checking game status:", error);
        }
      }, 1000);
    },

    async startMultiplayerGame(gameCode, mapSeed, isCreator) {
      try {
        // Hide UI
        this.hideAll();
        const shopBtn = document.getElementById("shopButton");
        if (shopBtn) shopBtn.style.display = "block";

        // Start the game with multiplayer
        if (window.game && window.game.world) {
          window.game.world.startMultiplayerGame(gameCode, mapSeed, isCreator);
        }
      } catch (error) {
        console.error("Failed to start multiplayer game:", error);
        UI.showToast("Failed to start multiplayer game!");
      }
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
    
    resize() {
      this.canvas.width = Math.max(640, window.innerWidth);
      this.canvas.height = Math.max(480, window.innerHeight);
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
      
      this.canvas.width = Math.max(640, window.innerWidth);
      this.canvas.height = Math.max(480, window.innerHeight);
      if (this.world) {
        this.world.camera.w = this.canvas.width;
        this.world.camera.h = this.canvas.height;
        this.world.camera1.w = this.canvas.width;
        this.world.camera1.h = this.canvas.height / 2;
        this.world.camera2.w = this.canvas.width;
        this.world.camera2.h = this.canvas.height / 2;
      }
      
      requestAnimationFrame(() => this.loop());
    }
  }

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", () => new Game());
  } else {
    new Game();
  }
})();
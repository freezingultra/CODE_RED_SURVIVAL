// game.js - Code Red: Survival - COMPLETE WITH GLOBAL LEADERBOARD
(function() {
  "use strict";

  // Initialize Supabase
  const SUPABASE_URL = 'https://fkbnpjbbiijlprdhjnad.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZrYm5wamJiaWlqbHByZGhqbmFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0ODI0NTQsImV4cCI6MjA3NzA1ODQ1NH0.a_qtutu3Lnbr4CIu_21gpqofiOjF_ihuaUE782weutk';
  const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;
  
  if (!supabase) {
    console.warn('[GAME] Supabase not available, leaderboard features may be limited');
  } else {
    console.info('[GAME] Supabase initialized successfully');
  }

  const CONFIG = {
    tileSize: 32,
    mapW: 100,
    mapH: 100,
    maxEnemies: 15,
    maxParticles: 100,
    maxBullets: 200,
    spawnDelay: 5.0
  };

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function randRange(a, b) { return a + Math.random() * (b - a); }
  function dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }

  const Log = {
    info: (...a) => console.info("[GAME]", ...a),
    warn: (...a) => console.warn("[GAME]", ...a),
    error: (...a) => console.error("[GAME]", ...a)
  };

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

  // Audio
  let audioCtx = null;
  try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
  catch (e) { Log.warn("Audio not available"); }

  function playSound(freq, duration) {
    if (!audioCtx) return;
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
    } catch (e) {}
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

  // Global Leaderboard with Supabase
  const Leaderboard = {
    tableName: 'Lederboard',
    
    async ensureTable() {
      if (!supabase) return false;
      // Table should be created in Supabase dashboard or via SQL:
      // CREATE TABLE leaderboard (
      //   id BIGSERIAL PRIMARY KEY,
      //   name TEXT NOT NULL,
      //   waves INTEGER NOT NULL,
      //   difficulty TEXT NOT NULL,
      //   kills INTEGER DEFAULT 0,
      //   timestamp BIGINT NOT NULL,
      //   created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      // );
      return true;
    },
    
    async load() {
      try {
        if (!supabase) {
          Log.warn("Supabase not available, using fallback");
          // Fallback to localStorage
          const data = localStorage.getItem('leaderboard-fallback');
          return data ? JSON.parse(data) : [];
        }
        
        const { data, error } = await supabase
          .from(this.tableName)
          .select('*')
          .order('waves', { ascending: false })
          .order('kills', { ascending: false })
          .limit(50);
        
        if (error) {
          Log.warn("Supabase query error:", error.message);
          // Fallback to localStorage
          const fallbackData = localStorage.getItem('leaderboard-fallback');
          return fallbackData ? JSON.parse(fallbackData) : [];
        }
        
        return data || [];
      } catch (e) {
        Log.warn("Failed to load leaderboard:", e);
        // Fallback to localStorage
        const fallbackData = localStorage.getItem('leaderboard-fallback');
        return fallbackData ? JSON.parse(fallbackData) : [];
      }
    },
    
    async addScore(name, waves, difficulty, kills) {
      try {
        const timestamp = Date.now();
        const scoreData = { 
          name: name || "Anonymous", 
          waves, 
          difficulty: difficulty || "Normal",
          kills: kills || 0,
          timestamp 
        };
        
        if (!supabase) {
          Log.warn("Supabase not available, using localStorage fallback");
          // Fallback to localStorage
          let scores = [];
          const fallbackData = localStorage.getItem('leaderboard-fallback');
          if (fallbackData) {
            scores = JSON.parse(fallbackData);
          }
          scores.push(scoreData);
          scores.sort((a, b) => {
            if (b.waves !== a.waves) return b.waves - a.waves;
            return b.kills - a.kills;
          });
          scores = scores.slice(0, 50);
          localStorage.setItem('leaderboard-fallback', JSON.stringify(scores));
          Log.info("Score added to local leaderboard: " + name + " - Wave " + waves);
          return true;
        }
        
        const { data, error } = await supabase
          .from(this.tableName)
          .insert([scoreData])
          .select();
        
        if (error) {
          Log.error("Failed to save to Supabase:", error.message);
          // Save to localStorage as backup
          let scores = [];
          const fallbackData = localStorage.getItem('leaderboard-fallback');
          if (fallbackData) {
            scores = JSON.parse(fallbackData);
          }
          scores.push(scoreData);
          scores.sort((a, b) => {
            if (b.waves !== a.waves) return b.waves - a.waves;
            return b.kills - a.kills;
          });
          scores = scores.slice(0, 50);
          localStorage.setItem('leaderboard-fallback', JSON.stringify(scores));
          Log.warn("Score saved to local fallback");
          return false;
        }
        
        Log.info("Score added to Supabase leaderboard: " + name + " - Wave " + waves);
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
    keys: {}, mouse: { x: 0, y: 0, down: false },
    init(canvas) {
      window.addEventListener("keydown", e => { this.keys[e.key.toLowerCase()] = true; if (e.key === " ") e.preventDefault(); });
      window.addEventListener("keyup", e => { this.keys[e.key.toLowerCase()] = false; });
      canvas.addEventListener("mousemove", e => {
        const rect = canvas.getBoundingClientRect();
        this.mouse.x = (e.clientX - rect.left) * (canvas.width / rect.width);
        this.mouse.y = (e.clientY - rect.top) * (canvas.height / rect.height);
      });
      canvas.addEventListener("mousedown", e => { if (e.button === 0) this.mouse.down = true; });
      canvas.addEventListener("mouseup", e => { if (e.button === 0) this.mouse.down = false; });
      canvas.addEventListener("contextmenu", e => e.preventDefault());
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
      this.kills = 0;
      this.weaponIndex = 0;
      this.weapons = [
        { name: "Pistol", dmg: 18, bullets: 1, spread: 4, fireRate: 0.22 },
        { name: "Shotgun", dmg: 10, bullets: 5, spread: 18, fireRate: 0.85 },
        { name: "Burst", dmg: 12, bullets: 3, spread: 6, fireRate: 0.45 }
      ];
      this.unlockedWeapons = [0];
      this.shootCooldown = 0;
      this.armor = 0;
      this.speedMul = 1;
      this.pickupRadius = 1;
      this.color = isP1 ? "#00d9ff" : "#00ff88";
      this.isP1 = isP1;
      this.canShoot = true;
      this.magAmmo = 0;
      this.reloadTimer = 0;
    }

    update(dt, world) {
      let mx = 0, my = 0;
      if (this.isP1) {
        if (Input.keys['w']) my -= 1;
        if (Input.keys['s']) my += 1;
        if (Input.keys['a']) mx -= 1;
        if (Input.keys['d']) mx += 1;
      } else {
        if (Input.keys['arrowup']) my -= 1;
        if (Input.keys['arrowdown']) my += 1;
        if (Input.keys['arrowleft']) mx -= 1;
        if (Input.keys['arrowright']) mx += 1;
      }

      const len = Math.hypot(mx, my);
      if (len > 0) { mx /= len; my /= len; }

      const speed = this.speed * this.speedMul * (Input.keys['shift'] ? 1.4 : 1);
      const newX = this.x + mx * speed * dt;
      const newY = this.y + my * speed * dt;

      if (!world.checkCollision(newX, this.y, this.radius)) this.x = newX;
      if (!world.checkCollision(this.x, newY, this.radius)) this.y = newY;

      this.x = clamp(this.x, this.radius, world.mapW * world.tileSize - this.radius);
      this.y = clamp(this.y, this.radius, world.mapH * world.tileSize - this.radius);

      this.shootCooldown -= dt;
      this.reloadTimer -= dt;
      const weapon = this.weapons[this.weaponIndex];
      if (weapon.magSize !== undefined && this.reloadTimer <= 0 && this.magAmmo < weapon.magSize) {
        this.magAmmo = weapon.magSize;
      }
      if (this.canShoot && (Input.mouse.down || Input.keys[' ']) && this.shootCooldown <= 0) {
        this.fire(world);
      }
    }

    fire(world) {
      const weapon = this.weapons[this.weaponIndex];
      if (weapon.magSize !== undefined && (this.magAmmo <= 0 || this.reloadTimer > 0)) return;
      this.shootCooldown = weapon.fireRate;
      const angle = Math.atan2(Input.mouse.y + world.camera.y - this.y, Input.mouse.x + world.camera.x - this.x);

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
      ctx.fillStyle = this.color;
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      const barW = 36, barH = 5;
      ctx.fillStyle = "rgba(0,0,0,0.8)";
      ctx.fillRect(this.x - barW/2, this.y + 18, barW, barH);
      
      const hpPercent = this.hp / this.maxHp;
      ctx.fillStyle = hpPercent > 0.6 ? "#00ff88" : hpPercent > 0.3 ? "#ffaa00" : "#ff3366";
      ctx.fillRect(this.x - barW/2, this.y + 18, barW * hpPercent, barH);
    }
  }

  // Enemy
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
      Log.info("Enemy spawned: " + type + " with " + Math.round(hp) + " HP");
    }

    update(dt, world) {
      const p = world.player;
      const dx = p.x - this.x, dy = p.y - this.y;
      const d = Math.hypot(dx, dy) || 1;

      let vx = (dx / d) * this.speed;
      let vy = (dy / d) * this.speed;

      if (this.type === "ranged") {
        if (d > 200) {
          vx = (dx / d) * this.speed;
          vy = (dy / d) * this.speed;
        } else {
          vx = 0;
          vy = 0;
        }
        
        if (d <= 300) {
          this.fireTimer -= dt;
          if (this.fireTimer <= 0) {
            this.fireTimer = randRange(0.8, 1.5);
            const dmg = 15 * (1 - (p.armor || 0));
            p.hp -= dmg;
            Log.info("RANGED ATTACK! Player took " + Math.round(dmg) + " damage. HP: " + Math.round(p.hp));
            world.spawnParticles(p.x, p.y, 5, "#ff6600");
            sfxHit();
            
            if (p.hp <= 0) {
              world.gameOver();
            }
          }
        }
      } 
      else if (this.type === "boss") {
        vx = (dx / d) * this.speed;
        vy = (dy / d) * this.speed;
        
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

      const newX = this.x + vx * dt;
      const newY = this.y + vy * dt;

      if (!world.checkCollision(newX, this.y, this.radius)) this.x = newX;
      if (!world.checkCollision(this.x, newY, this.radius)) this.y = newY;

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

    async gameOver() {
      this.isRunning = false;
      this.paused = true;
      if (this.isMultiplayer) {
        UI.showGameOver(this.winner + " Wins!", 0, 0);
      } else {
        const sd = Save.load();
        sd.coins += Math.floor(this.player.coins);
        if (this.wave > sd.bestWave) sd.bestWave = this.wave;
        Save.save(sd);
        
        await Leaderboard.addScore(this.userName, this.wave, this.difficulty, this.player.kills);
        UI.showGameOver(this.wave, this.player.kills, Math.floor(this.player.coins));
      }
    }

    endWave() {
      this.isRunning = false;
      
      this.enemies = [];
      
      const sd = Save.load();
      const coinReward = Math.floor(this.wave * 6);
      sd.coins += coinReward;
      this.player.coins += coinReward;
      if (this.wave > sd.bestWave) sd.bestWave = this.wave;
      Save.save(sd);
      UI.showToast("Wave " + this.wave + " complete! +" + coinReward + " coins. Press SPACE for next wave!");
      Log.info("Wave " + this.wave + " complete! Press SPACE to continue.");
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
              lifetime: 30
            });
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
                
                const lootCount = e.type === "boss" ? 8 : 2 + Math.floor(Math.random() * 3);
                for (let k = 0; k < lootCount; k++) {
                  this.loots.push({
                    x: e.x + randRange(-12, 12),
                    y: e.y + randRange(-12, 12),
                    type: Math.random() < 0.15 ? "gem" : "coin",
                    value: 1,
                    radius: 7,
                    age: 0,
                    lifetime: 30
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
        const pickupDist = (l.radius + this.player.radius + (12 * (this.player.pickupRadius || 1)));
        const pickupDistSq = pickupDist * pickupDist;
        if (dist2(l.x, l.y, this.player.x, this.player.y) < pickupDistSq) {
          if (l.type === "coin") {
            this.player.coins += l.value;
          } else if (l.type === "gem") {
            this.player.gems += l.value;
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
      
      UI.updateHUD(this);
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
      } else {
        ctx.save();
        ctx.translate(-this.camera.x, -this.camera.y);
        this.drawWorld(ctx);
        ctx.restore();
        
        ctx.fillStyle = "white";
        ctx.font = "24px monospace";
        if (this.isRunning) {
          const timeLeft = this.waveTimeLimit - this.waveTimer;
          const mins = Math.floor(timeLeft / 60);
          const secs = Math.floor(timeLeft % 60).toString().padStart(2, '0');
          ctx.fillText("Wave " + this.wave + " - Time: " + mins + ":" + secs, 20, 40);
        } else {
          ctx.fillText("Press SPACE to start Wave " + (this.wave + 1), 20, 40);
        }
        ctx.font = "18px monospace";
        ctx.fillText("Players: " + PlayerCounter.getCount(), this.canvas.width - 150, 30);
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
        ctx.fillStyle = l.type === "coin" ? "#ffdd00" : l.type === "gem" ? "#00ff88" : "#ff0000";
        ctx.strokeStyle = l.type === "coin" ? "#ffaa00" : l.type === "gem" ? "#00cc66" : "#cc0000";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(l.x, l.y - bounce, l.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      
      for (const b of this.bullets) {
        ctx.fillStyle = b.owner === "player" ? "#ffff00" : "#ff3366";
        ctx.strokeStyle = b.owner === "player" ? "#ffaa00" : "#aa0000";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
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
      };
      
      if (this.elements.homeScreen) {
        const multiplayerBtn = document.createElement("button");
        multiplayerBtn.textContent = "Start Multiplayer";
        multiplayerBtn.addEventListener("click", () => {
          this.hideAll();
          if (window.game && window.game.world) {
            window.game.world.startMultiplayer();
          }
        });
        this.elements.homeScreen.appendChild(multiplayerBtn);
        
        const leaderboardBtn = document.createElement("button");
        leaderboardBtn.textContent = "🏆 Global Leaderboard";
        leaderboardBtn.addEventListener("click", async () => {
          this.elements.homeScreen.style.display = "none";
          this.elements.leaderboardScreen.style.display = "flex";
          await this.updateLeaderboard();
        });
        this.elements.homeScreen.appendChild(leaderboardBtn);
        
        const loginBtn = document.createElement("button");
        loginBtn.textContent = window.game.world.isLoggedIn ? "Logout" : "Login";
        this.loginBtn = loginBtn;
        loginBtn.addEventListener("click", () => {
          if (window.game.world.isLoggedIn) {
            this.handleLogout();
          } else {
            this.handleLogin();
          }
        });
        this.elements.homeScreen.appendChild(loginBtn);
      }
      
      this.bindEvents();
      this.updateHomeStats();
    },
    
    createLeaderboardScreen() {
      const screen = document.createElement("div");
      screen.id = "leaderboardScreen";
      screen.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.95);z-index:9999;display:none;flex-direction:column;align-items:center;justify-content:center;color:white;font-family:monospace;padding:20px;overflow-y:auto;";
      screen.innerHTML = `
        <div style="max-width:900px;width:100%;">
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
        if (window.game && window.game.world) window.game.world.startWave();
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
        if (window.game && window.game.world) window.game.world.startWave();
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
        if (window.game && window.game.world) window.game.world.paused = false;
      });
      
      document.addEventListener("keydown", e => {
        if (!window.game || !window.game.world) return;
        
        if (e.key === "F12" || e.key === "`") {
          e.preventDefault();
          if (window.game.devConsole) window.game.devConsole.toggle();
        }
        
        if (e.key.toLowerCase() === "p") {
          window.game.world.paused = !window.game.world.paused;
          this.elements.pauseScreen.style.display = window.game.world.paused ? "flex" : "none";
        }
        
        if (e.key.toLowerCase() === "f") {
          e.preventDefault();
          this.openShop();
        }
        
        if (e.key.toLowerCase() === "q") {
          const world = window.game.world;
          if (!world.player.unlockedWeapons) world.player.unlockedWeapons = [0];
          let nextIndex = (world.player.weaponIndex + 1) % 3;
          let attempts = 0;
          while (!world.player.unlockedWeapons.includes(nextIndex) && attempts < 3) {
            nextIndex = (nextIndex + 1) % 3;
            attempts++;
          }
          if (world.player.unlockedWeapons.includes(nextIndex)) {
            world.player.weaponIndex = nextIndex;
            this.showToast("Switched to " + world.player.weapons[world.player.weaponIndex].name);
          }
        }
      });
    },
    
    hideAll() {
      Object.values(this.elements).forEach(el => {
        if (el && el.style) el.style.display = "none";
      });
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
      this.elements.currentWeapon.textContent = world.player.weapons[world.player.weaponIndex].name;
      
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
      if (typeof wave === "string") {
        document.getElementById("finalWave").textContent = wave;
        document.getElementById("finalKills").textContent = "";
        document.getElementById("finalCoins").textContent = "";
      } else {
        document.getElementById("finalWave").textContent = wave;
        document.getElementById("finalKills").textContent = kills;
        document.getElementById("finalCoins").textContent = coins;
      }
      this.elements.gameOverScreen.style.display = "flex";
    },
    
    openShop() {
      if (!window.game || !window.game.world) return;
      
      window.game.world.paused = true;
      const playerCoins = Math.floor(window.game.world.player.coins);
      
      document.getElementById("shopCoins").textContent = playerCoins;
      this.populateShop(playerCoins);
      this.elements.shopScreen.style.display = "flex";
    },
    
    populateShop(playerCoins) {
      const world = window.game.world;
      
      const upgrades = {
        offense: [
          { name: "Damage +6", desc: "Pistol damage", cost: 55, apply: () => { 
            world.player.weapons[0].dmg += 6;
          }},
          { name: "Fire Rate", desc: "-12% cooldown", cost: 80, apply: () => { 
            world.player.weapons.forEach(w => w.fireRate *= 0.88);
          }},
          { name: "Unlock Shotgun", desc: "Buy shotgun", cost: 150, apply: () => { 
            if (!world.player.unlockedWeapons.includes(1)) {
              world.player.unlockedWeapons.push(1);
              UI.showToast("Shotgun unlocked!");
            }
          }},
          { name: "Unlock Burst", desc: "Buy burst rifle", cost: 200, apply: () => { 
            if (!world.player.unlockedWeapons.includes(2)) {
              world.player.unlockedWeapons.push(2);
              UI.showToast("Burst unlocked!");
            }
          }}
        ],
        defense: [
          { name: "Max HP +25", desc: "Health boost", cost: 65, apply: () => { 
            world.player.maxHp += 25; 
            world.player.hp += 25;
          }},
          { name: "Armor 12%", desc: "Damage reduction", cost: 130, apply: () => { 
            world.player.armor = Math.min(0.75, world.player.armor + 0.12);
          }},
          { name: "Health Pack", desc: "Restore 60 HP", cost: 45, apply: () => { 
            world.player.hp = Math.min(world.player.maxHp, world.player.hp + 60);
          }}
        ],
        utility: [
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
      
      ["offense", "defense", "utility"].forEach(category => {
        const container = document.getElementById(category + "Upgrades");
        container.innerHTML = "";
        
        upgrades[category].forEach(u => {
          const div = document.createElement("div");
          div.className = "shop-item";
          div.innerHTML = "<h4>" + u.name + "</h4><p>" + u.desc + "</p><p style='color: #ffdd00;'>" + u.cost + " coins</p>";
          
          const btn = document.createElement("button");
          btn.textContent = "Buy";
          btn.disabled = playerCoins < u.cost;
          if (playerCoins < u.cost) {
            btn.style.opacity = "0.5";
            btn.style.cursor = "not-allowed";
          }
          
          btn.onclick = () => {
            if (world.player.coins >= u.cost) {
              world.player.coins -= u.cost;
              document.getElementById("shopCoins").textContent = Math.floor(world.player.coins);
              u.apply();
              UI.showToast("Bought " + u.name + "!");
              btn.disabled = true;
              btn.textContent = "Purchased";
              btn.style.opacity = "0.5";
              UI.populateShop(Math.floor(world.player.coins));
            }
          };
          div.appendChild(btn);
          container.appendChild(div);
        });
      });
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
      
      this.devConsole = new DevConsole();
      
      this.resize();
      window.addEventListener("resize", () => this.resize());
      
      Input.init(canvas);
      
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
            this.world = new World(canvas);
            const activeBtn = document.querySelector(".difficulty-btn.active");
            if (activeBtn) this.world.difficulty = activeBtn.dataset.difficulty;
            
            UI.init();
            
            const loadingScreen = document.getElementById("loadingScreen");
            const homeScreen = document.getElementById("homeScreen");
            
            if (loadingScreen) {
              loadingScreen.style.display = "none";
            }
            if (homeScreen) {
              homeScreen.style.display = "flex";
            }
            
            this.running = true;
            this.loop();
            Log.info("Game Ready! Press SPACE to start wave 1");
          }, 300);
        }
      }, 100);
      
      window.game = this;
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
        this.world.camera1.w = this.canvas.width;
        this.world.camera1.h = this.canvas.height / 2;
        this.world.camera2.w = this.canvas.width;
        this.world.camera2.h = this.canvas.height / 2;
      }
    }
  }

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", () => new Game());
  } else {
    new Game();
  }
})();

// Multiplayer Client for Code Red: Survival
// Handles WebSocket communication and game synchronization

// Configuration - Update this with your Render server URL
const MULTIPLAYER_CONFIG = {
  // For local development: 'ws://localhost:3000'
  // For Render production: 'wss://your-app-name.onrender.com'
  // Leave empty to auto-detect based on current page
  SERVER_URL: ''
};

class MultiplayerClient {
  constructor(serverUrl = null) {
    this.serverUrl = serverUrl || this.getServerUrl();
    this.ws = null;
    this.gameCode = null;
    this.playerId = null;
    this.playerName = null;
    this.playerColor = null;
    this.mapSeed = null;
    this.remotePlayer = null;
    this.isConnected = false;
    this.callbacks = {};
  }

  // Determine the correct server URL
  getServerUrl() {
    // If explicitly configured, use that
    if (MULTIPLAYER_CONFIG.SERVER_URL) {
      return MULTIPLAYER_CONFIG.SERVER_URL;
    }

    // Auto-detect based on current page
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;

    // If localhost, use localhost:3000 for development
    if (host.includes('localhost') || host.includes('127.0.0.1')) {
      return 'ws://localhost:3000';
    }

    // Otherwise, use same host as the page (for Render, Netlify, etc.)
    return `${protocol}//${host}`;
  }

  // Register callback for events
  on(event, callback) {
    if (!this.callbacks[event]) {
      this.callbacks[event] = [];
    }
    this.callbacks[event].push(callback);
  }

  // Emit event to callbacks
  emit(event, data) {
    if (this.callbacks[event]) {
      this.callbacks[event].forEach(cb => cb(data));
    }
  }

  // Connect to multiplayer server
  connect(gameCode, playerName) {
    return new Promise((resolve, reject) => {
      try {
        // Get the WebSocket URL
        let wsUrl = this.serverUrl;
        console.log('[Multiplayer] Connecting to:', wsUrl);

        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          this.isConnected = true;
          this.gameCode = gameCode;
          this.playerName = playerName;

          // Send join message
          this.ws.send(JSON.stringify({
            type: 'join',
            code: gameCode,
            playerName: playerName
          }));

          // Set timeout for join confirmation
          const timeout = setTimeout(() => {
            reject(new Error('Join timeout'));
          }, 5000);

          // Wait for joined confirmation
          const originalOnMessage = this.ws.onmessage;
          this.ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            if (message.type === 'joined') {
              clearTimeout(timeout);
              this.playerId = message.playerId;
              this.playerColor = message.playerColor;
              this.mapSeed = message.mapSeed;

              // Set up remote players
              message.players.forEach(p => {
                if (p.id !== this.playerId) {
                  this.remotePlayer = {
                    id: p.id,
                    name: p.name,
                    color: p.color,
                    x: p.x,
                    y: p.y,
                    hp: 100,
                    maxHp: 100
                  };
                }
              });

              this.emit('joined', {
                playerId: this.playerId,
                playerColor: this.playerColor,
                mapSeed: this.mapSeed
              });

              // Restore normal message handler
              this.ws.onmessage = (e) => this.handleMessage(e);
              resolve();
            }
          };
        };

        this.ws.onerror = (error) => {
          this.isConnected = false;
          reject(error);
        };

        this.ws.onclose = () => {
          this.isConnected = false;
          this.emit('disconnected');
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  // Handle incoming WebSocket messages
  handleMessage(event) {
    try {
      const message = JSON.parse(event.data);

      switch (message.type) {
        case 'player_joined':
          this.remotePlayer = {
            id: message.playerId,
            name: message.playerName,
            color: message.playerColor,
            x: 0,
            y: 0,
            hp: 100,
            maxHp: 100
          };
          this.emit('player_joined', message);
          break;

        case 'player_update':
          if (this.remotePlayer && message.playerId === this.remotePlayer.id) {
            this.remotePlayer.x = message.x;
            this.remotePlayer.y = message.y;
            this.remotePlayer.hp = message.hp;
            this.remotePlayer.weaponIndex = message.weaponIndex;
            this.emit('player_update', message);
          }
          break;

        case 'bullet':
          this.emit('remote_bullet', message);
          break;

        case 'enemy_update':
          this.emit('enemy_update', message);
          break;

        case 'wave_update':
          this.emit('wave_update', message);
          break;

        case 'player_left':
          this.emit('player_left', message);
          break;

        case 'game_over':
          this.emit('game_over', message);
          break;

        case 'error':
          this.emit('error', message);
          break;
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  }

  // Send player update
  sendPlayerUpdate(x, y, hp, weaponIndex) {
    if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'player_update',
        x,
        y,
        hp,
        weaponIndex
      }));
    }
  }

  // Send bullet fired
  sendBullet(x, y, vx, vy, damage) {
    if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'bullet',
        x,
        y,
        vx,
        vy,
        damage
      }));
    }
  }

  // Send enemy update
  sendEnemyUpdate(enemies) {
    if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'enemy_update',
        enemies
      }));
    }
  }

  // Send wave update
  sendWaveUpdate(wave) {
    if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'wave_update',
        wave
      }));
    }
  }

  // Send game over
  sendGameOver(winner, stats) {
    if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'game_over',
        winner,
        stats
      }));
    }
  }

  // Disconnect from server
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.isConnected = false;
    }
  }
}

// REST API helper for game creation/joining
class MultiplayerAPI {
  constructor(apiUrl = 'http://localhost:3000') {
    this.apiUrl = apiUrl;
  }

  // Create a new game room
  async createGame(playerName, mapSeed) {
    try {
      const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
      const url = `${protocol}//${window.location.host}/api/games/create`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName, mapSeed })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to create game:', error);
      throw error;
    }
  }

  // Join an existing game room
  async joinGame(code, playerName) {
    try {
      const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
      const url = `${protocol}//${window.location.host}/api/games/join`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, playerName })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to join game:', error);
      throw error;
    }
  }

  // Get game room info
  async getGameInfo(code) {
    try {
      const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
      const url = `${protocol}//${window.location.host}/api/games/${code}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get game info:', error);
      throw error;
    }
  }
}

// Export for use in game.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MultiplayerClient, MultiplayerAPI };
}

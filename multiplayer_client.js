// Multiplayer Client for Code Red: Survival
// Handles local lobby communication and game synchronization

class MultiplayerClient {
  constructor(serverUrl = null) {
    // Use local lobby system instead of WebSocket
    this.lobbySystem = window.localLobby;
    this.gameCode = null;
    this.playerId = null;
    this.playerName = null;
    this.playerColor = null;
    this.mapSeed = null;
    this.isConnected = false;
    this.callbacks = {};
    
    // Set up lobby event listeners
    this.setupLobbyEvents();
  }

  // Set up lobby system event listeners
  setupLobbyEvents() {
    this.lobbySystem.on('playerJoined', (data) => {
      this.emit('playerJoined', data.player);
    });

    this.lobbySystem.on('playerLeft', (data) => {
      this.emit('playerLeft', data.player);
    });

    this.lobbySystem.on('gameStarted', (data) => {
      this.isConnected = true;
      this.emit('gameStarted', data.lobby);
    });
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

// REST API helper for game creation/joining (now uses local lobby system)
class MultiplayerAPI {
  constructor(apiUrl = 'http://localhost:3000') {
    this.apiUrl = apiUrl;
    this.lobbySystem = window.localLobby;
  }

  // Create a new game room
  async createGame(playerName, mapSeed) {
    try {
      const result = this.lobbySystem.createLobby(playerName, mapSeed);
      
      if (result.success) {
        return {
          success: true,
          code: result.code,
          playerId: result.playerId,
          players: result.lobby.players
        };
      } else {
        throw new Error(result.error || 'Failed to create game');
      }
    } catch (error) {
      console.error('Failed to create game:', error);
      throw error;
    }
  }

  // Join an existing game room
  async joinGame(code, playerName) {
    try {
      const result = this.lobbySystem.joinLobby(code, playerName);
      
      if (result.success) {
        return {
          success: true,
          code: result.code,
          playerId: result.playerId,
          players: result.lobby.players
        };
      } else {
        throw new Error(result.error || 'Failed to join game');
      }
    } catch (error) {
      console.error('Failed to join game:', error);
      throw error;
    }
  }

  // Start the game (host only)
  async startGame() {
    try {
      const result = this.lobbySystem.startGame();
      
      if (result.success) {
        return {
          success: true,
          lobby: result.lobby
        };
      } else {
        throw new Error(result.error || 'Failed to start game');
      }
    } catch (error) {
      console.error('Failed to start game:', error);
      throw error;
    }
  }
}

// Export for use in game.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MultiplayerClient, MultiplayerAPI };
}

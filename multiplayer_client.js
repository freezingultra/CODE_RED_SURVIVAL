// Multiplayer Client for Code Red: Survival
// Handles WebSocket communication and game synchronization

// Use the existing MULTIPLAYER_CONFIG from multiplayer.config.js
const config = typeof MULTIPLAYER_CONFIG !== 'undefined' ? MULTIPLAYER_CONFIG : {
  // Fallback config if not defined
  // NOTE: This should match your Render multiplayer server subdomain
  SERVER_URL: 'wss://multiplayer-for-code-red-survival.onrender.com'
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
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.eventListeners = {};
    this.pendingMessages = [];
    this.playerColor = this.getRandomColor();
  }

  getServerUrl() {
    // Use the config's SERVER_URL if available, otherwise fallback to auto-detect
    if (config.SERVER_URL) {
      return config.SERVER_URL;
    }
    
    // Auto-detect based on current page
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}`;
  }

  getApiUrl() {
    // Convert WebSocket URL to HTTP URL
    return this.serverUrl.replace('ws://', 'http://').replace('wss://', 'https://');
  }

  getRandomColor() {
    const colors = ['#00d9ff', '#00ff88', '#ff6b6b', '#ff9f43', '#5f27cd', '#1dd1a1'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  on(event, callback) {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(callback);
  }

  emit(event, data) {
    if (this.eventListeners[event]) {
      this.eventListeners[event].forEach(callback => callback(data));
    }
  }

  async connect(gameCode, playerName) {
    try {
      this.gameCode = gameCode.toUpperCase();
      this.playerName = playerName;

      // Connect WebSocket
      this.ws = new WebSocket(this.serverUrl);

      this.ws.onopen = () => {
        console.log('[Multiplayer] WebSocket connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;

        // Send join message
        this.ws.send(JSON.stringify({
          type: 'join',
          code: this.gameCode,
          playerName: this.playerName
        }));
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error('[Multiplayer] Failed to parse message:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('[Multiplayer] WebSocket disconnected');
        this.isConnected = false;
        this.emit('disconnected');
        
        // Attempt reconnection
        if (this.reconnectAttempts < 3) {
          this.reconnectAttempts++;
          setTimeout(() => {
            console.log(`[Multiplayer] Reconnection attempt ${this.reconnectAttempts}`);
            this.connect(this.gameCode, this.playerName);
          }, 3000);
        }
      };

      this.ws.onerror = (error) => {
        console.error('[Multiplayer] WebSocket error:', error);
        this.emit('error', { message: 'Connection error' });
      };

    } catch (error) {
      console.error('[Multiplayer] Connection failed:', error);
      throw error;
    }
  }

  handleMessage(data) {
    switch (data.type) {
      case 'joined':
        this.playerId = data.playerId;
        this.playerColor = data.playerColor;
        this.mapSeed = data.mapSeed;
        this.emit('joined', data);
        break;
      
      case 'player_joined':
        this.emit('player_joined', data);
        break;
      
      case 'player_update':
        this.emit('player_update', data);
        break;
      
      case 'player_left':
        this.emit('player_left');
        break;
      
      case 'game_state':
        this.emit('game_state', data);
        break;
      
      case 'error':
        this.emit('error', data);
        break;
      
      default:
        console.log('[Multiplayer] Unknown message type:', data.type);
    }
  }

  sendPlayerUpdate(x, y, hp, weaponIndex) {
    if (this.isConnected && this.ws) {
      this.ws.send(JSON.stringify({
        type: 'player_update',
        x,
        y,
        hp,
        weaponIndex
      }));
    }
  }

  sendGameAction(action, data) {
    if (this.isConnected && this.ws) {
      this.ws.send(JSON.stringify({
        type: 'game_action',
        action,
        data
      }));
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }
}

class MultiplayerAPI {
  constructor(serverUrl = null) {
    if (serverUrl) {
      this.baseUrl = serverUrl.replace('ws://', 'http://').replace('wss://', 'https://');
    } else if (config.SERVER_URL && config.SERVER_URL.trim() !== '') {
      // Use configured server URL
      this.baseUrl = config.SERVER_URL.replace('ws://', 'http://').replace('wss://', 'https://');
    } else {
      // Auto-detect based on current page (same logic as MultiplayerClient)
      const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
      const host = window.location.host;
      this.baseUrl = `${protocol}//${host}`;
    }
  }

  async createGame(playerName, mapSeed = null) {
    try {
      console.log(`[MultiplayerAPI] Creating game at: ${this.baseUrl}/api/games`);
      
      const response = await fetch(`${this.baseUrl}/api/games`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          playerName,
          mapSeed: mapSeed || Math.floor(Math.random() * 1000000)
        })
      });

      console.log(`[MultiplayerAPI] Response status: ${response.status}`);
      console.log(`[MultiplayerAPI] Response headers:`, response.headers);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[MultiplayerAPI] Error response: ${errorText}`);
        throw new Error(`Server error: ${response.status} - ${errorText}`);
      }

      const responseText = await response.text();
      console.log(`[MultiplayerAPI] Response text: ${responseText}`);
      
      if (!responseText) {
        throw new Error('Server returned empty response. Is the multiplayer server running?');
      }

      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error(`[MultiplayerAPI] Failed to parse JSON: ${parseError}`);
        throw new Error(`Invalid server response: ${responseText}`);
      }

      return {
        code: result.code,
        mapSeed: result.mapSeed
      };
    } catch (error) {
      console.error('Failed to create game:', error);
      throw error;
    }
  }

  async joinGame(code, playerName) {
    try {
      const response = await fetch(`${this.baseUrl}/api/games/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          code: code.toUpperCase(), 
          playerName 
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to join game');
      }

      const result = await response.json();
      return {
        code: result.code,
        mapSeed: result.mapSeed,
        creatorName: result.creatorName,
        playerCount: result.playerCount
      };
    } catch (error) {
      console.error('Failed to join game:', error);
      // Provide more helpful error messages
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        const displayUrl = (config.SERVER_URL && config.SERVER_URL.trim() !== '')
          ? config.SERVER_URL
          : this.baseUrl;
        throw new Error(`Cannot connect to multiplayer server at ${displayUrl}. Please check if the server is running and accessible.`);
      }
      throw error;
    }
  }

  async getGameInfo(code) {
    try {
      const response = await fetch(`${this.baseUrl}/api/games/${code.toUpperCase()}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get game info');
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get game info:', error);
      throw error;
    }
  }

  async startGame(code) {
    try {
      const response = await fetch(`${this.baseUrl}/api/games/${code.toUpperCase()}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to start game');
      }

      const result = await response.json();
      return {
        success: result.success,
        message: result.message
      };
    } catch (error) {
      console.error('Failed to start game:', error);
      throw error;
    }
  }
}

// Make classes available globally for browser
if (typeof window !== 'undefined') {
  window.MultiplayerClient = MultiplayerClient;
  window.MultiplayerAPI = MultiplayerAPI;
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MultiplayerClient, MultiplayerAPI };
}

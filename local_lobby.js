// Local Lobby System for Code Red: Survival
// Handles 4-character lobby codes and local multiplayer

class LocalLobbySystem {
  constructor() {
    this.lobbies = new Map(); // code -> lobby data
    this.currentLobby = null;
    this.playerId = this.generatePlayerId();
    this.callbacks = {};
  }

  generatePlayerId() {
    return 'player_' + Math.random().toString(36).substr(2, 9);
  }

  generateLobbyCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  // Create a new lobby
  createLobby(playerName, mapSeed) {
    const code = this.generateLobbyCode();
    
    // Ensure code is unique
    while (this.lobbies.has(code)) {
      code = this.generateLobbyCode();
    }

    const lobby = {
      code: code,
      hostId: this.playerId,
      hostName: playerName,
      players: [{
        id: this.playerId,
        name: playerName,
        color: this.getRandomColor(),
        isHost: true
      }],
      mapSeed: mapSeed,
      createdAt: Date.now(),
      gameStarted: false
    };

    this.lobbies.set(code, lobby);
    this.currentLobby = lobby;

    console.log(`[LOBBY] Created lobby ${code} with host ${playerName}`);
    
    return {
      success: true,
      code: code,
      playerId: this.playerId,
      lobby: lobby
    };
  }

  // Join an existing lobby
  joinLobby(code, playerName) {
    code = code.toUpperCase();
    
    if (!this.lobbies.has(code)) {
      return {
        success: false,
        error: 'Invalid lobby code'
      };
    }

    const lobby = this.lobbies.get(code);
    
    if (lobby.players.length >= 6) {
      return {
        success: false,
        error: 'Lobby is full'
      };
    }

    if (lobby.gameStarted) {
      return {
        success: false,
        error: 'Game already started'
      };
    }

    const player = {
      id: this.playerId,
      name: playerName,
      color: this.getRandomColor(),
      isHost: false
    };

    lobby.players.push(player);
    this.currentLobby = lobby;

    console.log(`[LOBBY] ${playerName} joined lobby ${code}`);
    
    // Notify other players
    this.emit('playerJoined', { lobby, player });

    return {
      success: true,
      code: code,
      playerId: this.playerId,
      lobby: lobby
    };
  }

  // Leave current lobby
  leaveLobby() {
    if (!this.currentLobby) return;

    const lobby = this.currentLobby;
    const playerIndex = lobby.players.findIndex(p => p.id === this.playerId);
    
    if (playerIndex !== -1) {
      const player = lobby.players[playerIndex];
      lobby.players.splice(playerIndex, 1);
      
      // If host leaves, assign new host or close lobby
      if (player.isHost && lobby.players.length > 0) {
        lobby.players[0].isHost = true;
        lobby.hostId = lobby.players[0].id;
        lobby.hostName = lobby.players[0].name;
      } else if (player.isHost && lobby.players.length === 0) {
        // Close empty lobby
        this.lobbies.delete(lobby.code);
      }

      console.log(`[LOBBY] ${player.name} left lobby ${lobby.code}`);
      this.emit('playerLeft', { lobby, player });
    }

    this.currentLobby = null;
  }

  // Start the game (host only)
  startGame() {
    if (!this.currentLobby) {
      return { success: false, error: 'Not in a lobby' };
    }

    const lobby = this.currentLobby;
    const player = lobby.players.find(p => p.id === this.playerId);
    
    if (!player || !player.isHost) {
      return { success: false, error: 'Only host can start the game' };
    }

    if (lobby.players.length < 1) {
      return { success: false, error: 'Need at least 1 player to start' };
    }

    lobby.gameStarted = true;
    console.log(`[LOBBY] Game started in lobby ${lobby.code}`);
    
    this.emit('gameStarted', { lobby });
    
    return { success: true, lobby };
  }

  // Get random player color
  getRandomColor() {
    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#f0932b', '#eb4d4b', '#6ab04c', '#c44569'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  // Event handling
  on(event, callback) {
    if (!this.callbacks[event]) {
      this.callbacks[event] = [];
    }
    this.callbacks[event].push(callback);
  }

  emit(event, data) {
    if (this.callbacks[event]) {
      this.callbacks[event].forEach(callback => callback(data));
    }
  }

  // Get current lobby info
  getCurrentLobby() {
    return this.currentLobby;
  }

  // Get all active lobbies (for debugging)
  getAllLobbies() {
    return Array.from(this.lobbies.values());
  }
}

// Global instance
window.localLobby = new LocalLobbySystem();

// Multiplayer Server - Node.js with Express and WebSocket
// Run with: node multiplayer_server.js

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());

// Store active game rooms
const gameRooms = new Map();

// Generate 4-letter code
function generateGameCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Game Room class
class GameRoom {
  constructor(code, creatorName, mapSeed) {
    this.code = code;
    this.creatorName = creatorName;
    this.mapSeed = mapSeed;
    this.players = new Map();
    this.createdAt = Date.now();
    this.gameState = {
      wave: 0,
      enemies: [],
      bullets: [],
      loots: [],
      gameTime: 0
    };
  }

  addPlayer(ws, playerName) {
    const playerId = `${playerName}_${Date.now()}`;
    this.players.set(playerId, {
      ws,
      name: playerName,
      x: 0,
      y: 0,
      hp: 100,
      maxHp: 100,
      color: this.players.size === 0 ? '#00d9ff' : '#00ff88',
      weaponIndex: 0,
      joinedAt: Date.now()
    });
    return playerId;
  }

  removePlayer(playerId) {
    this.players.delete(playerId);
    return this.players.size === 0;
  }

  broadcast(message, excludeId = null) {
    this.players.forEach((player, playerId) => {
      if (excludeId !== playerId && player.ws.readyState === WebSocket.OPEN) {
        player.ws.send(JSON.stringify(message));
      }
    });
  }

  broadcastToAll(message) {
    this.players.forEach((player) => {
      if (player.ws.readyState === WebSocket.OPEN) {
        player.ws.send(JSON.stringify(message));
      }
    });
  }
}

// REST API Endpoints

// Create a new game room
app.post('/api/games/create', (req, res) => {
  const { playerName, mapSeed } = req.body;

  if (!playerName || playerName.length < 3) {
    return res.status(400).json({ error: 'Invalid player name' });
  }

  let code;
  let attempts = 0;
  do {
    code = generateGameCode();
    attempts++;
  } while (gameRooms.has(code) && attempts < 100);

  if (attempts >= 100) {
    return res.status(500).json({ error: 'Could not generate unique code' });
  }

  const room = new GameRoom(code, playerName, mapSeed || Math.random());
  gameRooms.set(code, room);

  // Clean up old rooms (older than 1 hour)
  gameRooms.forEach((r, k) => {
    if (Date.now() - r.createdAt > 3600000) {
      gameRooms.delete(k);
    }
  });

  res.json({
    success: true,
    code,
    mapSeed: room.mapSeed
  });
});

// Join an existing game room
app.post('/api/games/join', (req, res) => {
  const { code, playerName } = req.body;

  if (!code || !playerName) {
    return res.status(400).json({ error: 'Missing code or player name' });
  }

  const room = gameRooms.get(code.toUpperCase());
  if (!room) {
    return res.status(404).json({ error: 'Game room not found' });
  }

  if (room.players.size >= 2) {
    return res.status(400).json({ error: 'Game room is full' });
  }

  res.json({
    success: true,
    code: room.code,
    mapSeed: room.mapSeed,
    creatorName: room.creatorName,
    playerCount: room.players.size + 1
  });
});

// Get game room info
app.get('/api/games/:code', (req, res) => {
  const room = gameRooms.get(req.params.code.toUpperCase());
  if (!room) {
    return res.status(404).json({ error: 'Game room not found' });
  }

  res.json({
    code: room.code,
    creatorName: room.creatorName,
    playerCount: room.players.size,
    createdAt: room.createdAt,
    gameState: room.gameState
  });
});

// WebSocket connection handler
wss.on('connection', (ws) => {
  let currentRoom = null;
  let playerId = null;

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);

      switch (message.type) {
        case 'join':
          {
            const room = gameRooms.get(message.code.toUpperCase());
            if (!room) {
              ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
              return;
            }

            if (room.players.size >= 2) {
              ws.send(JSON.stringify({ type: 'error', message: 'Room is full' }));
              return;
            }

            currentRoom = room;
            playerId = room.addPlayer(ws, message.playerName);

            // Send join confirmation
            ws.send(JSON.stringify({
              type: 'joined',
              playerId,
              playerColor: room.players.get(playerId).color,
              mapSeed: room.mapSeed,
              players: Array.from(room.players.entries()).map(([id, p]) => ({
                id,
                name: p.name,
                color: p.color,
                x: p.x,
                y: p.y
              }))
            }));

            // Notify other players
            room.broadcast({
              type: 'player_joined',
              playerId,
              playerName: message.playerName,
              playerColor: room.players.get(playerId).color
            }, playerId);
          }
          break;

        case 'player_update':
          if (currentRoom && playerId) {
            const player = currentRoom.players.get(playerId);
            if (player) {
              player.x = message.x;
              player.y = message.y;
              player.hp = message.hp;
              player.weaponIndex = message.weaponIndex;

              currentRoom.broadcast({
                type: 'player_update',
                playerId,
                x: message.x,
                y: message.y,
                hp: message.hp,
                weaponIndex: message.weaponIndex
              }, playerId);
            }
          }
          break;

        case 'bullet':
          if (currentRoom) {
            currentRoom.broadcast({
              type: 'bullet',
              playerId,
              x: message.x,
              y: message.y,
              vx: message.vx,
              vy: message.vy,
              damage: message.damage
            });
          }
          break;

        case 'enemy_update':
          if (currentRoom) {
            currentRoom.gameState.enemies = message.enemies;
            currentRoom.broadcast({
              type: 'enemy_update',
              enemies: message.enemies
            });
          }
          break;

        case 'wave_update':
          if (currentRoom) {
            currentRoom.gameState.wave = message.wave;
            currentRoom.broadcastToAll({
              type: 'wave_update',
              wave: message.wave
            });
          }
          break;

        case 'game_over':
          if (currentRoom) {
            currentRoom.broadcastToAll({
              type: 'game_over',
              winner: message.winner,
              stats: message.stats
            });
          }
          break;
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  });

  ws.on('close', () => {
    if (currentRoom && playerId) {
      const isEmpty = currentRoom.removePlayer(playerId);

      if (isEmpty) {
        gameRooms.delete(currentRoom.code);
      } else {
        currentRoom.broadcast({
          type: 'player_left',
          playerId
        });
      }
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    activeRooms: gameRooms.size,
    timestamp: Date.now()
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Multiplayer server running on port ${PORT}`);
});

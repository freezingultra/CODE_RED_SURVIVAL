# Code Red: Survival - Global Multiplayer Setup Guide

## Overview

The global multiplayer system allows players to create games and join with friends using 4-letter codes. Both players play on the same internet connection and share a procedurally generated map.

## Features

- **4-Letter Game Codes**: Simple codes for sharing between players
- **Shared Map Generation**: Both players see the same maze using seed-based generation
- **Real-time Synchronization**: Player positions, health, and actions sync via WebSocket
- **Same Internet Play**: Works on local networks or over the internet

## Architecture

### Components

1. **Frontend (Browser)**
   - `multiplayer_client.js` - WebSocket client for real-time communication
   - `index.html` - UI for creating/joining games
   - `game.js` - Game logic integration with multiplayer

2. **Backend (Node.js)**
   - `multiplayer_server.js` - WebSocket server managing game rooms
   - `package.json` - Dependencies

## Installation & Setup

### Prerequisites

- Node.js 14+ installed
- npm or yarn package manager

### Backend Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start the Server**
   ```bash
   npm start
   ```
   
   The server will run on `http://localhost:3000` by default.
   
   For production, set the PORT environment variable:
   ```bash
   PORT=8080 npm start
   ```

3. **Verify Server is Running**
   ```bash
   curl http://localhost:3000/health
   ```
   
   Should return: `{"status":"ok","activeRooms":0,"timestamp":...}`

### Frontend Setup

1. **Update Server URL** (if not using localhost)
   
   In `multiplayer_client.js`, update the default server URL:
   ```javascript
   constructor(serverUrl = 'ws://your-server.com:3000')
   ```

2. **Deploy Frontend**
   
   The game can be hosted on any static hosting service:
   - Netlify
   - Vercel
   - GitHub Pages
   - Your own web server

## How to Use

### Creating a Game

1. Click **🌐 Multiplayer** on the home screen
2. Click **➕ Create Game**
3. Click **✨ Create & Start Waiting**
4. A 4-letter code will be generated (e.g., `AB12`)
5. Share this code with your friend
6. Wait for them to join (max 2 minutes)
7. Game starts automatically when both players are connected

### Joining a Game

1. Click **🌐 Multiplayer** on the home screen
2. Click **🔗 Join Game**
3. Enter the 4-letter code from your friend
4. Click **🎮 Join Game**
5. Game starts automatically

## API Endpoints

### REST API

#### Create Game
```
POST /api/games/create
Content-Type: application/json

{
  "playerName": "PlayerName",
  "mapSeed": 0.12345
}

Response:
{
  "success": true,
  "code": "AB12",
  "mapSeed": 0.12345
}
```

#### Join Game
```
POST /api/games/join
Content-Type: application/json

{
  "code": "AB12",
  "playerName": "PlayerName"
}

Response:
{
  "success": true,
  "code": "AB12",
  "mapSeed": 0.12345,
  "creatorName": "Creator",
  "playerCount": 2
}
```

#### Get Game Info
```
GET /api/games/AB12

Response:
{
  "code": "AB12",
  "creatorName": "Creator",
  "playerCount": 2,
  "createdAt": 1234567890,
  "gameState": {...}
}
```

#### Health Check
```
GET /health

Response:
{
  "status": "ok",
  "activeRooms": 5,
  "timestamp": 1234567890
}
```

### WebSocket Messages

#### Join Message (Client → Server)
```javascript
{
  "type": "join",
  "code": "AB12",
  "playerName": "PlayerName"
}
```

#### Joined Confirmation (Server → Client)
```javascript
{
  "type": "joined",
  "playerId": "PlayerName_1234567890",
  "playerColor": "#00d9ff",
  "mapSeed": 0.12345,
  "players": [
    { "id": "...", "name": "...", "color": "...", "x": 0, "y": 0 }
  ]
}
```

#### Player Update (Client → Server)
```javascript
{
  "type": "player_update",
  "x": 100,
  "y": 200,
  "hp": 85,
  "weaponIndex": 0
}
```

#### Player Update Broadcast (Server → Clients)
```javascript
{
  "type": "player_update",
  "playerId": "PlayerName_1234567890",
  "x": 100,
  "y": 200,
  "hp": 85,
  "weaponIndex": 0
}
```

#### Bullet Message (Client → Server)
```javascript
{
  "type": "bullet",
  "x": 100,
  "y": 200,
  "vx": 10,
  "vy": 5,
  "damage": 18
}
```

#### Wave Update (Client → Server)
```javascript
{
  "type": "wave_update",
  "wave": 5
}
```

#### Game Over (Client → Server)
```javascript
{
  "type": "game_over",
  "winner": "PlayerName",
  "stats": { "kills": 50, "coins": 1000 }
}
```

## Deployment

### Render Deployment (Recommended)

Since your game runs on Render, deploy the server there too!

1. **See `RENDER_DEPLOYMENT.md` for complete step-by-step guide**
2. Quick summary:
   - Create Render Web Service
   - Connect GitHub repo
   - Set build: `npm install`
   - Set start: `npm start`
   - Update `multiplayer_client.js` with server URL
   - Redeploy game frontend

### Heroku Deployment

1. **Create Procfile**
   ```
   web: node multiplayer_server.js
   ```

2. **Deploy**
   ```bash
   heroku create your-app-name
   heroku config:set PORT=3000
   git push heroku main
   ```

### Docker Deployment

1. **Create Dockerfile**
   ```dockerfile
   FROM node:18-alpine
   WORKDIR /app
   COPY package*.json ./
   RUN npm install
   COPY . .
   EXPOSE 3000
   CMD ["npm", "start"]
   ```

2. **Build and Run**
   ```bash
   docker build -t code-red-multiplayer .
   docker run -p 3000:3000 code-red-multiplayer
   ```

### AWS/GCP/Azure Deployment

Deploy the Node.js server to your cloud provider's app hosting service (App Engine, Lambda, etc.) and update the frontend with the server URL.

## Troubleshooting

### Connection Issues

**Problem**: "Failed to connect to multiplayer server"

**Solutions**:
- Verify the server is running: `curl http://localhost:3000/health`
- Check firewall allows WebSocket connections (port 3000)
- Ensure frontend URL matches server URL
- Check browser console for detailed errors (F12)

### Game Code Not Found

**Problem**: "Game room not found"

**Solutions**:
- Verify the 4-letter code is correct (case-insensitive)
- Ensure the creator hasn't cancelled the game
- Game codes expire after 1 hour of inactivity
- Try creating a new game

### Map Mismatch

**Problem**: Players see different maps

**Solutions**:
- This shouldn't happen - maps are generated from the same seed
- If it occurs, check that both clients are using the same `mapSeed`
- Verify `generateMazeWithSeed()` is deterministic

### Lag/Desync

**Problem**: Players see each other in wrong positions

**Solutions**:
- Check internet connection quality
- Reduce number of active games on server
- Increase update frequency in `game.js` update loop
- Consider implementing client-side prediction

## Performance Optimization

### Server-Side

1. **Increase Update Frequency**
   - Modify `CONFIG.pathRecalcInterval` in game.js
   - Reduce from 0.85s to 0.5s for faster updates

2. **Optimize Room Cleanup**
   - Adjust room expiration time in `multiplayer_server.js`
   - Currently: 1 hour

3. **Database Integration**
   - Replace in-memory storage with Redis/MongoDB for persistence
   - Allows server restarts without losing game state

### Client-Side

1. **Client-Side Prediction**
   - Predict remote player movement locally
   - Reduce perceived lag

2. **Compression**
   - Compress WebSocket messages
   - Reduce bandwidth usage

## Security Considerations

1. **Input Validation**
   - All player names validated (3+ characters, no numbers)
   - Game codes validated (4 alphanumeric characters)

2. **Rate Limiting**
   - Consider implementing rate limiting on REST endpoints
   - Prevent abuse of game creation

3. **Authentication**
   - Currently uses player names only
   - For production, implement proper authentication (OAuth, JWT)

4. **HTTPS/WSS**
   - Always use HTTPS and WSS in production
   - Certificates required for secure connections

## Future Enhancements

- [ ] Persistent game state (database)
- [ ] Spectator mode
- [ ] Replay system
- [ ] Ranked matchmaking
- [ ] Team-based gameplay
- [ ] Voice chat integration
- [ ] Mobile app
- [ ] Cross-platform support

## Support

For issues or questions:
1. Check browser console (F12) for errors
2. Check server logs for backend errors
3. Verify network connectivity
4. Test with localhost first before deploying

## License

MIT License - See LICENSE file for details

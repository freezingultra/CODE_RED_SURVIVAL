# Quick Start: Global Multiplayer

## Setup for Render Deployment

Since your game runs on Render, you need to deploy the multiplayer server there too.

### Option 1: Deploy Server to Render (Recommended)

1. **Create a Render Web Service**
   - Go to https://render.com
   - Click "New +" → "Web Service"
   - Connect your GitHub repo (or upload files)
   - Set build command: `npm install`
   - Set start command: `npm start`
   - Set environment: Node
   - Click "Create Web Service"

2. **Get Your Server URL**
   - After deployment, you'll get a URL like: `https://your-app-name.onrender.com`
   - Copy this URL

3. **Update Game Configuration**
   - In `multiplayer_client.js`, update line 9:
   ```javascript
   const MULTIPLAYER_CONFIG = {
     SERVER_URL: 'wss://your-app-name.onrender.com'
   };
   ```
   - Replace `your-app-name` with your actual Render app name

4. **Redeploy Your Game**
   - Update and redeploy your frontend to Render/Netlify
   - Now multiplayer will work!

### Option 2: Local Development (Testing)

For testing locally before deploying:

1. **Start Server Locally**
```bash
npm install
npm start
```

2. **Keep Configuration Empty**
   - Leave `SERVER_URL: ''` in `multiplayer_client.js`
   - The game will auto-detect localhost:3000

3. **Open Game**
   - Open `http://localhost:3000` in browser
   - Login with your name

## 30-Second Setup (Local Testing)

### Step 1: Install & Start Server
```bash
npm install
npm start
```

Server runs on `http://localhost:3000`

### Step 2: Open Game
- Open `index.html` in your browser
- Login with your name

### Step 3: Create/Join Game

**To Create:**
1. Click 🌐 **Multiplayer**
2. Click ➕ **Create Game**
3. Click ✨ **Create & Start Waiting**
4. Share the 4-letter code with friend

**To Join:**
1. Click 🌐 **Multiplayer**
2. Click 🔗 **Join Game**
3. Enter the 4-letter code
4. Click 🎮 **Join Game**

### Step 4: Play!
- Both players see the same map
- Real-time position sync
- Defeat enemies together!

## Testing Locally

### Two Browser Windows

1. **Terminal 1**: Start server
   ```bash
   npm start
   ```

2. **Browser Window 1**: Open `http://localhost:3000`
   - Login as "Player1"
   - Click Multiplayer → Create Game
   - Note the code (e.g., "AB12")

3. **Browser Window 2**: Open `http://localhost:3000`
   - Login as "Player2"
   - Click Multiplayer → Join Game
   - Enter code "AB12"
   - Click Join

4. **Play!** Both windows now show the same game

## Deployment

### For Friends on Same WiFi

1. Find your computer's IP: `ipconfig` (Windows) or `ifconfig` (Mac/Linux)
2. Start server: `npm start`
3. Friend opens: `http://YOUR_IP:3000`
4. Create/join game normally

### For Friends Over Internet

1. Deploy server to cloud (Heroku, AWS, etc.)
2. Update frontend server URL in `multiplayer_client.js`
3. Deploy frontend to hosting (Netlify, Vercel, etc.)
4. Share game link with friends

## Common Issues

| Issue | Solution |
|-------|----------|
| "Connection refused" | Make sure server is running (`npm start`) |
| "Game not found" | Check 4-letter code is correct |
| Different maps | Restart both clients and rejoin |
| Lag/desync | Check internet connection quality |

## Next Steps

- Read `MULTIPLAYER_SETUP.md` for detailed documentation
- Check `multiplayer_server.js` for server code
- Check `multiplayer_client.js` for client code
- Modify `game.js` for custom gameplay rules

## Architecture

```
┌─────────────────────────────────────────┐
│         Browser (Frontend)              │
│  ┌──────────────────────────────────┐   │
│  │  index.html + game.js            │   │
│  │  multiplayer_client.js (WebSocket)   │
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
           ↕ WebSocket
┌─────────────────────────────────────────┐
│    Node.js Server (Backend)             │
│  ┌──────────────────────────────────┐   │
│  │  multiplayer_server.js           │   │
│  │  - Game room management          │   │
│  │  - Player sync                   │   │
│  │  - Message routing               │   │
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

## File Structure

```
Code red survival/
├── index.html                    # Main game UI
├── game.js                       # Game logic + multiplayer integration
├── multiplayer_client.js         # WebSocket client
├── multiplayer_server.js         # WebSocket server
├── package.json                  # Node dependencies
├── MULTIPLAYER_SETUP.md          # Detailed guide
└── QUICK_START_MULTIPLAYER.md    # This file
```

## Key Features

✅ 4-letter game codes  
✅ Shared map generation  
✅ Real-time player sync  
✅ Same internet play  
✅ Easy create/join flow  
✅ Automatic cleanup  

## Performance

- Supports 2 players per room
- Unlimited concurrent games
- ~50ms latency on local network
- ~200ms latency over internet

Enjoy playing with friends! 🎮

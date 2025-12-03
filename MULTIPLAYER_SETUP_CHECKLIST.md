# Multiplayer Setup Checklist

Follow these steps to enable global multiplayer for your Code Red: Survival game on Render.

## ✅ Pre-Deployment Checklist

### Local Testing (Optional but Recommended)

- [ ] Run `npm install` to install dependencies
- [ ] Run `npm start` to start local server
- [ ] Open `http://localhost:3000` in browser
- [ ] Test creating a game
- [ ] Test joining a game in another browser window
- [ ] Verify both players see the same map
- [ ] Verify player positions sync in real-time

## ✅ Configuration

- [ ] Open `multiplayer.config.js`
- [ ] Review the configuration options
- [ ] Leave `SERVER_URL: ''` for auto-detection (recommended)
- [ ] Or set explicit URL for your Render server

## ✅ Render Deployment

### Deploy Multiplayer Server

- [ ] Go to https://render.com
- [ ] Click "New +" → "Web Service"
- [ ] Connect your GitHub repository
- [ ] Set service name: `code-red-multiplayer` (or your choice)
- [ ] Set environment: `Node`
- [ ] Set build command: `npm install`
- [ ] Set start command: `npm start`
- [ ] Click "Create Web Service"
- [ ] Wait for deployment (2-5 minutes)
- [ ] Copy the service URL (e.g., `https://code-red-multiplayer.onrender.com`)

### Update Game Configuration

- [ ] Open `multiplayer.config.js` in your game repository
- [ ] Update `SERVER_URL` to your Render server:
  ```javascript
  SERVER_URL: 'wss://code-red-multiplayer.onrender.com'
  ```
- [ ] Replace `code-red-multiplayer` with your actual service name
- [ ] Save the file
- [ ] Commit and push to GitHub

### Redeploy Game Frontend

If frontend is on Render:
- [ ] Push changes to GitHub
- [ ] Render auto-redeploys (wait 2-5 minutes)
- [ ] Verify deployment succeeded

If frontend is on Netlify:
- [ ] Push changes to GitHub
- [ ] Netlify auto-redeploys (wait 1-2 minutes)
- [ ] Verify deployment succeeded

## ✅ Testing

### Verify Server is Running

- [ ] Open browser developer console (F12)
- [ ] Open your game
- [ ] Click 🌐 **Multiplayer**
- [ ] Check console for: `[Multiplayer] Connecting to: wss://...`
- [ ] Should NOT see connection errors

### Test Multiplayer

- [ ] **Player 1**: Click Multiplayer → Create Game
- [ ] **Player 1**: Note the 4-letter code
- [ ] **Player 2**: Click Multiplayer → Join Game
- [ ] **Player 2**: Enter the code
- [ ] Both players should connect
- [ ] Both should see the same map
- [ ] Both should see each other's positions
- [ ] Start playing!

## ✅ Troubleshooting

### Connection Issues

- [ ] Check Render service is running (go to Render dashboard)
- [ ] Check server URL is correct in `multiplayer.config.js`
- [ ] Verify using `wss://` (not `ws://`) for HTTPS
- [ ] Check browser console (F12) for errors
- [ ] Try refreshing the page

### Game Code Issues

- [ ] Verify 4-letter code is typed correctly
- [ ] Ensure code hasn't expired (max 1 hour)
- [ ] Try creating a new game
- [ ] Check that both players are on same server

### Performance Issues

- [ ] Check internet connection quality
- [ ] Render free tier may have higher latency
- [ ] Consider upgrading to Render paid tier
- [ ] Check browser console for errors

## ✅ Production Readiness

- [ ] Multiplayer server deployed to Render
- [ ] Game frontend updated with server URL
- [ ] Frontend redeployed
- [ ] Multiplayer tested with 2 players
- [ ] No console errors
- [ ] Connection stable for 5+ minutes
- [ ] Ready to share with friends!

## ✅ Sharing with Friends

- [ ] Share your game URL: `https://your-game.onrender.com`
- [ ] Friend opens link and logs in
- [ ] Friend clicks 🌐 **Multiplayer**
- [ ] One creates game, one joins with code
- [ ] Play together!

## 📚 Documentation

- [ ] Read `QUICK_START_MULTIPLAYER.md` for quick reference
- [ ] Read `RENDER_DEPLOYMENT.md` for detailed Render setup
- [ ] Read `MULTIPLAYER_SETUP.md` for technical details
- [ ] Check `multiplayer_client.js` for client code
- [ ] Check `multiplayer_server.js` for server code

## 🎮 You're Ready!

Once all items are checked, your multiplayer game is ready for friends to play!

### Next Steps

1. Share your game link with friends
2. Have them create/join games
3. Play together!
4. Collect feedback and iterate

### Optional Enhancements

- [ ] Add spectator mode
- [ ] Add team gameplay
- [ ] Add voice chat
- [ ] Add replay system
- [ ] Add ranked matchmaking
- [ ] Add persistent leaderboard

## Support

If you encounter issues:

1. **Check Console**: Press F12 and look for errors
2. **Check Render Logs**: Go to Render dashboard → Logs
3. **Read Docs**: Check `RENDER_DEPLOYMENT.md`
4. **Test Locally**: Run `npm start` and test on localhost
5. **Verify URL**: Make sure server URL is correct

## Quick Links

- Game: https://your-game.onrender.com
- Multiplayer Server: https://your-server.onrender.com
- Render Dashboard: https://render.com/dashboard
- Documentation: See `MULTIPLAYER_SETUP.md`

---

**Last Updated**: November 2025  
**Status**: Ready for Production ✅

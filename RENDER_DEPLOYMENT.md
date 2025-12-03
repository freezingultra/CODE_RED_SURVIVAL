# Deploying Multiplayer Server to Render

Since your game is hosted on Render, deploy the multiplayer server there too for seamless integration.

## Prerequisites

- Render account (free tier available)
- GitHub repository with your code (or use Render's Git integration)

## Step-by-Step Deployment

### Step 1: Prepare Your Repository

Your repository should have:
```
Code red survival/
├── multiplayer_server.js
├── package.json
├── index.html
├── game.js
└── ... other game files
```

### Step 2: Create Render Web Service

1. Go to https://render.com
2. Sign in or create account
3. Click **"New +"** in top right
4. Select **"Web Service"**

### Step 3: Connect Repository

1. Choose **"Build and deploy from a Git repository"**
2. Connect your GitHub account
3. Select your repository
4. Click **"Connect"**

### Step 4: Configure Service

Fill in the following:

| Field | Value |
|-------|-------|
| **Name** | `code-red-multiplayer` (or your choice) |
| **Environment** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Plan** | `Free` (or paid for better performance) |

### Step 5: Deploy

1. Click **"Create Web Service"**
2. Wait for deployment (2-5 minutes)
3. You'll see a URL like: `https://code-red-multiplayer.onrender.com`

### Step 6: Update Game Configuration

In your game's `multiplayer_client.js`, update line 9:

```javascript
const MULTIPLAYER_CONFIG = {
  SERVER_URL: 'wss://code-red-multiplayer.onrender.com'
};
```

Replace `code-red-multiplayer` with your actual Render service name.

### Step 7: Redeploy Game Frontend

If your frontend is also on Render:
1. Push the updated `multiplayer_client.js` to GitHub
2. Render will auto-redeploy
3. Wait for deployment to complete

If your frontend is on Netlify:
1. Push the updated `multiplayer_client.js` to GitHub
2. Netlify will auto-redeploy
3. Wait for deployment to complete

## Verification

### Test Connection

1. Open your game: `https://your-game.onrender.com`
2. Click **🌐 Multiplayer**
3. Click **➕ Create Game**
4. Check browser console (F12) for connection logs
5. Should see: `[Multiplayer] Connecting to: wss://code-red-multiplayer.onrender.com`

### Test Multiplayer

1. **Player 1**: Create game, get code (e.g., "AB12")
2. **Player 2**: Join with code "AB12"
3. Both should connect and see the same map

## Troubleshooting

### "Connection refused"

**Problem**: WebSocket connection fails

**Solutions**:
1. Verify Render service is running (check Render dashboard)
2. Check server URL is correct in `multiplayer_client.js`
3. Ensure using `wss://` (secure WebSocket) for HTTPS
4. Check browser console for exact error

### "Game room not found"

**Problem**: Join fails with "Game not found"

**Solutions**:
1. Verify 4-letter code is correct
2. Ensure creator hasn't cancelled game
3. Check both players are connecting to same server
4. Try creating a new game

### Slow Connection

**Problem**: High latency or lag

**Solutions**:
1. Render free tier has limited resources - consider upgrading
2. Check internet connection quality
3. Reduce update frequency in game.js if needed
4. Consider using Render's paid tier for better performance

## Environment Variables (Optional)

If you want to customize server behavior, add environment variables in Render:

1. Go to your service settings
2. Click **"Environment"**
3. Add variables:

```
PORT=3000
NODE_ENV=production
```

## Monitoring

### View Logs

1. Go to your Render service
2. Click **"Logs"** tab
3. See real-time server logs

### Check Status

1. Go to https://render.com/status
2. Verify Render services are operational

## Performance Tips

### For Free Tier

- Supports ~10-20 concurrent games
- ~200-500ms latency
- Auto-spins down after 15 minutes of inactivity

### For Paid Tier

- Better performance
- No spin-down
- More concurrent connections
- Recommended for production

## Updating Server Code

### Auto-Deploy from GitHub

1. Push changes to GitHub
2. Render automatically redeploys
3. No manual action needed

### Manual Redeploy

1. Go to your Render service
2. Click **"Manual Deploy"**
3. Select branch to deploy
4. Wait for deployment

## Backup & Recovery

### Database Persistence

Currently, game rooms are stored in memory. To add persistence:

1. Add MongoDB or Redis
2. Update `multiplayer_server.js` to use database
3. Redeploy

### Backup Code

Always keep your code in Git:
```bash
git push origin main
```

## Cost

### Free Tier
- $0/month
- Auto-spins down after 15 min inactivity
- Good for testing/development

### Paid Tier
- $7/month (starter)
- Always running
- Better performance
- Recommended for production

## Next Steps

1. ✅ Deploy server to Render
2. ✅ Update game configuration
3. ✅ Redeploy game frontend
4. ✅ Test multiplayer
5. Share game link with friends!

## Support

For Render-specific issues:
- https://render.com/docs
- https://render.com/support

For game-specific issues:
- Check browser console (F12)
- Check Render service logs
- Review `MULTIPLAYER_SETUP.md`

Enjoy multiplayer gaming! 🎮

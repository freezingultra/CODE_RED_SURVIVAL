/**
 * Multiplayer Configuration
 * 
 * Update this file with your server details
 */

const MULTIPLAYER_CONFIG = {
  // ========================================
  // IMPORTANT: Update this with your server URL
  // ========================================
  
  // For local development (testing):
  // SERVER_URL: 'ws://localhost:3000'
  
  // For Render deployment:
  // SERVER_URL: 'wss://your-app-name.onrender.com'
  
  // For Heroku deployment:
  // SERVER_URL: 'wss://your-app-name.herokuapp.com'
  
  // Leave empty to auto-detect based on current page:
  SERVER_URL: 'wss://code-red-survival.onrender.com',
  
  // ========================================
  // Optional: Game settings
  // ========================================
  
  // Maximum players per room
  MAX_PLAYERS_PER_ROOM: 2,
  
  // Game timeout (milliseconds)
  GAME_TIMEOUT: 3600000, // 1 hour
  
  // Connection timeout
  CONNECTION_TIMEOUT: 5000, // 5 seconds
  
  // Reconnection attempts
  MAX_RECONNECT_ATTEMPTS: 3,
  
  // Debug mode (logs to console)
  DEBUG: false
};

// Export for use in multiplayer_client.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MULTIPLAYER_CONFIG;
}

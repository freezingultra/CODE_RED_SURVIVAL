// Multiplayer Shop System for Code Red: Survival
// Handles shop items for multiplayer mode

class MultiplayerShop {
  constructor() {
    this.items = [];
    this.initializeShopItems();
  }

  initializeShopItems() {
    // Get 5 random weapons (excluding pistol, SMG, railgun)
    const allWeapons = [
      { name: "Shotgun", dmg: 10, bullets: 5, spread: 18, fireRate: 0.85, magSize: 6, cost: 150 },
      { name: "Burst", dmg: 12, bullets: 3, spread: 6, fireRate: 0.45, magSize: 24, cost: 200 },
      { name: "Sniper", dmg: 75, bullets: 1, spread: 0.5, fireRate: 0.9, magSize: 5, cost: 300 },
      { name: "Flamethrower", dmg: 6, bullets: 6, spread: 20, fireRate: 0.12, magSize: Math.round(60 * 6.7), cost: 250 },
      { name: "Plasma", dmg: 40, bullets: 1, spread: 2, fireRate: 0.6, magSize: 15, cost: 280 },
      { name: "LaserSweep", dmg: 25, bullets: 1, spread: 0.5, fireRate: 1.5, magSize: 10, cost: 220 },
      { name: "Rocket", dmg: 120, bullets: 1, spread: 3, fireRate: 1.8, magSize: 3, cost: 400 }
    ];

    // Select 5 random weapons
    const shuffled = [...allWeapons].sort(() => Math.random() - 0.5);
    const selectedWeapons = shuffled.slice(0, 5);

    this.items = [
      // Speed boost
      {
        name: "Speed Boost",
        type: "upgrade",
        cost: 100,
        description: "Increase movement speed by 25%",
        effect: () => {
          if (window.game && window.game.world.player) {
            window.game.world.player.speed *= 1.25;
          }
        }
      },
      // Health boost
      {
        name: "Health Boost", 
        type: "upgrade",
        cost: 80,
        description: "Restore 50 HP",
        effect: () => {
          if (window.game && window.game.world.player) {
            window.game.world.player.hp = Math.min(window.game.world.player.maxHp, window.game.world.player.hp + 50);
          }
        }
      },
      // Random weapons
      ...selectedWeapons.map(weapon => ({
        name: weapon.name,
        type: "weapon",
        cost: weapon.cost,
        description: `${weapon.name} - Damage: ${weapon.dmg}`,
        weapon: weapon
      }))
    ];
  }

  showShop() {
    // Create shop overlay if it doesn't exist
    let shopOverlay = document.getElementById("multiplayerShopOverlay");
    if (!shopOverlay) {
      shopOverlay = this.createShopOverlay();
      document.body.appendChild(shopOverlay);
    }

    this.updateShopDisplay();
    shopOverlay.style.display = "flex";
  }

  createShopOverlay() {
    const overlay = document.createElement("div");
    overlay.id = "multiplayerShopOverlay";
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.9);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;

    const shopContent = document.createElement("div");
    shopContent.style.cssText = `
      background: linear-gradient(135deg, #1a1a2e, #16213e);
      border: 2px solid #00d9ff;
      border-radius: 15px;
      padding: 30px;
      max-width: 600px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 0 30px rgba(0, 217, 255, 0.5);
    `;

    shopContent.innerHTML = `
      <h2 style="color: #00d9ff; text-align: center; margin-bottom: 20px;">🛒 Multiplayer Shop</h2>
      <div id="shopCoins" style="color: #ffa500; text-align: center; margin-bottom: 20px; font-size: 18px;">Coins: 0</div>
      <div id="shopItems" style="display: grid; gap: 15px;">
        <!-- Shop items will be populated here -->
      </div>
      <button id="closeShopBtn" style="width: 100%; padding: 12px; margin-top: 20px; background: #ff3366; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 16px;">✖️ Close Shop</button>
    `;

    overlay.appendChild(shopContent);

    // Add close button event listener
    document.getElementById("closeShopBtn").onclick = () => {
      overlay.style.display = "none";
    };

    return overlay;
  }

  updateShopDisplay() {
    const shopItemsDiv = document.getElementById("shopItems");
    const shopCoinsDiv = document.getElementById("shopCoins");
    
    if (!shopItemsDiv || !shopCoinsDiv) return;

    // Update coins display
    const coins = window.game && window.game.world.player ? window.game.world.player.coins : 0;
    shopCoinsDiv.textContent = `Coins: ${coins}`;

    // Update shop items
    shopItemsDiv.innerHTML = this.items.map((item, index) => `
      <div style="background: rgba(255,255,255,0.05); border: 1px solid #00d9ff; border-radius: 8px; padding: 15px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h3 style="color: #fff; margin: 0 0 5px 0;">${item.name}</h3>
            <p style="color: #aaa; margin: 0; font-size: 14px;">${item.description}</p>
          </div>
          <button 
            onclick="window.multiplayerShop.buyItem(${index})"
            style="padding: 8px 16px; background: #00ff88; color: #000; border: none; border-radius: 5px; cursor: pointer; font-weight: bold;"
            ${coins < item.cost ? 'disabled style="background: #666; color: #999;"' : ''}
          >
            ${item.cost} coins
          </button>
        </div>
      </div>
    `).join('');
  }

  buyItem(index) {
    const item = this.items[index];
    const player = window.game && window.game.world.player;
    
    if (!player) return;

    if (player.coins < item.cost) {
      if (window.UI) UI.showToast("Not enough coins!");
      return;
    }

    player.coins -= item.cost;

    if (item.type === "weapon") {
      // Add weapon to player's arsenal
      player.weapons.push(item.weapon);
      if (window.UI) UI.showToast(`Purchased ${item.name}!`);
    } else if (item.type === "upgrade") {
      // Apply upgrade effect
      item.effect();
      if (window.UI) UI.showToast(`Purchased ${item.name}!`);
    }

    // Update shop display
    this.updateShopDisplay();
    
    // Update game UI
    if (window.UI) UI.updateCoinCount();
  }

  hideShop() {
    const shopOverlay = document.getElementById("multiplayerShopOverlay");
    if (shopOverlay) {
      shopOverlay.style.display = "none";
    }
  }
}

// Create global instance
window.multiplayerShop = new MultiplayerShop();

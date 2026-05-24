# Code Red: Survival

This is a top-down survival game where you fight waves of enemies and try to survive as long as possible.

You may look at the source code and learn from it, but you may not copy it.

## Online Multiplayer

The game uses Cloudflare Workers and Durable Objects for global room-code multiplayer.

1. Player 1 opens the game and clicks `Multiplayer`.
2. Player 1 clicks `Host Game`.
3. The game creates a random 7-character code, like `1A2B3C4`.
4. Player 2 opens the same game site, clicks `Multiplayer`, enters the code, and joins.

The host browser runs the world simulation. Cloudflare only keeps the room together and relays messages between players.

## Deployment

Cloudflare builds from the `codered/code-red-survival` branch.

For local Cloudflare preview:

```bash
npm run preview
```

For a manual Cloudflare deploy:

```bash
npm run deploy
```

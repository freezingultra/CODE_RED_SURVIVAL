# topdown-gun-game
This is a topdown gun game where you fight waves of enemies and try to survive as long as possible(its still in its early stages so its not the best)
You may look at the souce code and learn from it but you may not copy it

## Local hosted multiplayer

This multiplayer mode runs on the host player's laptop/device. The host simulates the world, enemies, loot, and waves, while other players send controls to the host.

### Start hosting

1. Install dependencies once:
   ```bash
   npm install
   ```
2. Start the local server:
   ```bash
   npm run host
   ```
3. Open the printed local URL, usually `http://localhost:3000`.
4. Click `Multiplayer`, then `Host Game`.

The host screen automatically shows detected LAN links such as `http://192.168.x.x:3000` and IPv6 links when available. Players on the same Wi-Fi can open one of those links and click `Join This Server`.

If the game warns about VPN-like adapters, turn off VPNs temporarily when same-internet players cannot connect. VPNs can make the game show the wrong network address or block LAN traffic.

### Global hosting with Playit

Run the game server with `npm run host`, keep it open, then create a Playit tunnel that forwards to local port `3000`.

For browser play, an HTTP/HTTPS tunnel is best because it lets players open the game page and WebSocket connection through the same public address. Playit says its proxy lets you host from your own computer without port forwarding, and its docs for HTTPs tunnels describe pointing a public domain at a local website port.

After the tunnel is active, paste/share the Playit URL shown by Playit. Players open that URL and click `Join This Server`.

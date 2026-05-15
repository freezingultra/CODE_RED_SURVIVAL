const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const { WebSocketServer } = require("ws");

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".css": "text/css; charset=utf-8",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8"
};

const clients = new Map();
let hostId = null;
let seed = Date.now();
let latestSnapshot = null;
let matchStarted = false;

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

function send(client, message) {
  if (client.socket.readyState === client.socket.OPEN) {
    client.socket.send(JSON.stringify(message));
  }
}

function broadcast(message, filter = () => true) {
  for (const client of clients.values()) {
    if (filter(client)) send(client, message);
  }
}

function playerList() {
  return [...clients.values()]
    .filter((client) => client.role)
    .map((client) => ({
      id: client.id,
      name: client.name,
      role: client.role,
      color: client.color
    }));
}

function broadcastLobby() {
  broadcast({
    type: "lobby",
    hostId,
    matchStarted,
    players: playerList()
  });
}

function localAddresses() {
  const urls = [`http://localhost:${PORT}`];
  const vpnHints = [];
  const interfaces = os.networkInterfaces();
  for (const [ifaceName, iface] of Object.entries(interfaces)) {
    const vpnName = /vpn|wireguard|tailscale|zerotier|hamachi|nord|proton|surfshark|expressvpn|tun|tap/i.test(ifaceName);
    for (const details of iface || []) {
      if (details.internal) continue;
      const address = details.family === "IPv6" ? `[${details.address}]` : details.address;
      if (details.family === "IPv4" || details.family === "IPv6") {
        urls.push(`http://${address}:${PORT}`);
      }
      if (vpnName || /^(10\.|100\.64\.|172\.(1[6-9]|2\d|3[0-1])\.|192\.168\.)/.test(details.address) === false && details.family === "IPv4") {
        vpnHints.push(`${ifaceName} (${details.address})`);
      }
    }
  }
  return { urls: [...new Set(urls)], vpnHints: [...new Set(vpnHints)] };
}

function serveStatic(req, res) {
  if (req.url === "/api/host-info") {
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ port: PORT, ...localAddresses() }));
    return;
  }

  const requestPath = decodeURIComponent(new URL(req.url, `http://localhost:${PORT}`).pathname);
  const safePath = path.normalize(requestPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(ROOT, safePath === "/" ? "index.html" : safePath);

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    res.writeHead(200, {
      "content-type": MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream"
    });
    res.end(data);
  });
}

const server = http.createServer(serveStatic);
const wss = new WebSocketServer({ server, path: "/multiplayer" });

wss.on("connection", (socket) => {
  const id = makeId();
  const client = { id, socket, role: null, name: "Player", color: "#00d9ff" };
  clients.set(id, client);
  send(client, { type: "welcome", id, seed, matchStarted });

  socket.on("message", (raw) => {
    let message;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      send(client, { type: "error", message: "Bad message format." });
      return;
    }

    if (message.type === "host") {
      if (hostId && hostId !== id) {
        send(client, { type: "error", message: "A host is already running this room." });
        return;
      }
      hostId = id;
      seed = message.seed || Date.now();
      latestSnapshot = null;
      matchStarted = false;
      client.role = "host";
      client.name = message.name || "Host";
      client.color = message.color || "#00d9ff";
      send(client, { type: "hostAccepted", id, seed, ...localAddresses() });
      broadcastLobby();
      return;
    }

    if (message.type === "join") {
      if (!hostId || !clients.has(hostId)) {
        send(client, { type: "error", message: "No host is active yet." });
        return;
      }
      client.role = "guest";
      client.name = message.name || "Player";
      client.color = message.color || "#00ff88";
      send(client, { type: "joinAccepted", id, seed, matchStarted, snapshot: latestSnapshot });
      send(clients.get(hostId), {
        type: "guestJoined",
        player: { id, name: client.name, color: client.color }
      });
      broadcastLobby();
      return;
    }

    if (message.type === "input" && hostId && client.role === "guest") {
      send(clients.get(hostId), { type: "guestInput", playerId: id, input: message.input });
      return;
    }

    if (message.type === "snapshot" && client.id === hostId) {
      latestSnapshot = message.snapshot;
      broadcast({ type: "snapshot", snapshot: latestSnapshot }, (target) => target.id !== hostId);
      return;
    }

    if (message.type === "startMatch" && client.id === hostId) {
      matchStarted = true;
      broadcast({ type: "matchStarted" });
      broadcastLobby();
      return;
    }
  });

  socket.on("close", () => {
    const wasHost = id === hostId;
    clients.delete(id);
    if (wasHost) {
      hostId = null;
      latestSnapshot = null;
      matchStarted = false;
      broadcast({ type: "hostClosed" });
    } else if (hostId && clients.has(hostId)) {
      send(clients.get(hostId), { type: "guestLeft", playerId: id });
    }
    broadcastLobby();
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("Code Red local multiplayer server is running.");
  const info = localAddresses();
  for (const url of info.urls) console.log(`  ${url}`);
  if (info.vpnHints.length) {
    console.log("VPN-like network adapters detected. If friends cannot join on the same Wi-Fi, turn off VPNs temporarily:");
    for (const hint of info.vpnHints) console.log(`  ${hint}`);
  }
  console.log(`For global play, point your playit/HTTP tunnel at local port ${PORT}.`);
});

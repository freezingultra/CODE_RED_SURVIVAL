const ROOM_CODE_PATTERN = /^[0-9A-Z]{7}$/;

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init.headers || {})
    }
  });
}

function getRoomCode(request) {
  const url = new URL(request.url);
  const code = (url.searchParams.get("room") || url.searchParams.get("code") || "").trim().toUpperCase();
  return ROOM_CODE_PATTERN.test(code) ? code : null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/multiplayer") {
      return json({
        ok: true,
        mode: "cloudflare-room-relay",
        codeLength: 7
      });
    }

    if (url.pathname === "/multiplayer") {
      if (request.headers.get("Upgrade") !== "websocket") {
        return json({ error: "Expected a WebSocket upgrade." }, { status: 426 });
      }

      const roomCode = getRoomCode(request);
      if (!roomCode) {
        return json({ error: "Room code must be 7 uppercase letters or numbers." }, { status: 400 });
      }

      const id = env.ROOMS.idFromName(roomCode);
      return env.ROOMS.get(id).fetch(request);
    }

    return env.ASSETS.fetch(request);
  }
};

export class MultiplayerRoom {
  constructor(state, ctx) {
    this.state = state;
    this.ctx = ctx;
    this.code = null;
    this.hostId = null;
    this.seed = null;
    this.matchStarted = false;
    this.latestSnapshot = null;
    this.clients = new Map();
  }

  async fetch(request) {
    const roomCode = getRoomCode(request);
    if (!roomCode) return json({ error: "Invalid room code." }, { status: 400 });
    this.code = roomCode;

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.acceptSocket(server);

    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }

  acceptSocket(socket) {
    socket.accept();

    const id = this.createPlayerId();
    const client = {
      id,
      socket,
      role: "pending",
      name: "Player",
      color: "#00d9ff"
    };

    this.clients.set(id, client);
    this.send(client, { type: "connected", id, roomCode: this.code });

    socket.addEventListener("message", event => {
      this.handleMessage(client, event.data);
    });

    socket.addEventListener("close", () => {
      this.removeClient(id);
    });

    socket.addEventListener("error", () => {
      this.removeClient(id);
    });
  }

  handleMessage(client, rawMessage) {
    let message;
    try {
      message = JSON.parse(rawMessage);
    } catch {
      this.send(client, { type: "error", message: "Bad multiplayer message." });
      return;
    }

    if (message.type === "host") {
      this.handleHost(client, message);
      return;
    }

    if (message.type === "join") {
      this.handleJoin(client, message);
      return;
    }

    if (message.type === "snapshot" && this.clients.has(client.id)) {
      // Peer simulation: relay each player's state to all other clients
      this.latestSnapshot = message.snapshot || null;
      this.broadcast({ type: "snapshot", snapshot: this.latestSnapshot }, other => other.id !== client.id);
      return;
    }

    if (message.type === "startMatch" && (client.id === this.hostId || this.clients.has(client.id))) {
      this.matchStarted = true;
      this.broadcast({ type: "matchStarted" });
      return;
    }
  }

  handleHost(client, message) {
    if (this.hostId && this.hostId !== client.id && this.clients.has(this.hostId)) {
      this.send(client, { type: "error", message: "That room code is already in use. Try hosting again." });
      client.socket.close(1008, "Room already has a host.");
      return;
    }

    this.hostId = client.id;
    this.seed = Number.isFinite(message.seed) ? message.seed : Date.now();
    this.matchStarted = false;
    this.latestSnapshot = null;
    client.role = "host";
    client.name = this.cleanName(message.name, "Host");
    client.color = this.cleanColor(message.color, "#00d9ff");

    this.send(client, {
      type: "hostAccepted",
      id: client.id,
      seed: this.seed,
      roomCode: this.code,
      joinCode: this.code,
      players: this.playerList()
    });
    this.broadcastLobby();
  }

  handleJoin(client, message) {
    if (!this.hostId || !this.clients.has(this.hostId)) {
      this.send(client, { type: "error", message: "No host is using that code yet." });
      client.socket.close(1008, "No host in room.");
      return;
    }

    client.role = "guest";
    client.name = this.cleanName(message.name, "Player");
    client.color = this.cleanColor(message.color, "#00ff88");

    this.send(client, {
      type: "joinAccepted",
      id: client.id,
      seed: this.seed,
      roomCode: this.code,
      matchStarted: this.matchStarted,
      players: this.playerList(),
      snapshot: this.latestSnapshot
    });

    const host = this.clients.get(this.hostId);
    if (host) {
      this.send(host, {
        type: "guestJoined",
        player: this.publicPlayer(client)
      });
    }

    this.broadcastLobby();
  }

  removeClient(id) {
    const client = this.clients.get(id);
    if (!client) return;
    this.clients.delete(id);

    if (id === this.hostId) {
      this.hostId = null;
      this.matchStarted = false;
      this.latestSnapshot = null;
      this.broadcast({ type: "hostClosed" });
      for (const other of this.clients.values()) {
        try {
          other.socket.close(1001, "Host left.");
        } catch {
          // The close may already be in progress.
        }
      }
      this.clients.clear();
      return;
    }

    const host = this.hostId ? this.clients.get(this.hostId) : null;
    if (host && client.role === "guest") {
      this.send(host, { type: "guestLeft", playerId: id });
    }
    this.broadcastLobby();
  }

  broadcastLobby() {
    this.broadcast({
      type: "lobby",
      players: this.playerList()
    });
  }

  broadcast(message, filter = () => true) {
    for (const client of this.clients.values()) {
      if (filter(client)) this.send(client, message);
    }
  }

  send(client, message) {
    try {
      client.socket.send(JSON.stringify(message));
    } catch {
      // Defer removal to avoid mutating clients map during iteration
      Promise.resolve().then(() => this.removeClient(client.id));
    }
  }

  playerList() {
    return [...this.clients.values()]
      .filter(client => client.role === "host" || client.role === "guest")
      .map(client => this.publicPlayer(client));
  }

  publicPlayer(client) {
    return {
      id: client.id,
      role: client.role,
      name: client.name,
      color: client.color
    };
  }

  createPlayerId() {
    if (crypto.randomUUID) return crypto.randomUUID().slice(0, 8);
    const bytes = new Uint8Array(4);
    crypto.getRandomValues(bytes);
    return [...bytes].map(byte => byte.toString(16).padStart(2, "0")).join("");
  }

  cleanName(value, fallback) {
    const cleaned = String(value || "").trim().slice(0, 24);
    return cleaned || fallback;
  }

  cleanColor(value, fallback) {
    const cleaned = String(value || "").trim();
    return /^#[0-9A-Fa-f]{6}$/.test(cleaned) ? cleaned : fallback;
  }
}

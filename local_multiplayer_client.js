(function() {
  "use strict";

  class LocalMultiplayerClient {
    constructor() {
      this.socket = null;
      this.id = null;
      this.seed = null;
      this.role = null;
      this.handlers = new Map();
      this.connected = false;
    }

    on(type, handler) {
      if (!this.handlers.has(type)) this.handlers.set(type, []);
      this.handlers.get(type).push(handler);
    }

    emit(type, payload) {
      for (const handler of this.handlers.get(type) || []) {
        handler(payload);
      }
    }

    connect() {
      if (this.socket && this.connected) return Promise.resolve();

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const url = `${protocol}//${window.location.host}/multiplayer`;

      return new Promise((resolve, reject) => {
        this.socket = new WebSocket(url);
        this.socket.addEventListener("open", () => {
          this.connected = true;
          resolve();
        }, { once: true });
        this.socket.addEventListener("error", () => {
          reject(new Error("Could not connect to the local multiplayer server."));
        }, { once: true });
        this.socket.addEventListener("close", () => {
          this.connected = false;
          this.emit("closed");
        });
        this.socket.addEventListener("message", (event) => this.handleMessage(event));
      });
    }

    handleMessage(event) {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }

      if (message.id) this.id = message.id;
      if (message.seed) this.seed = message.seed;
      if (message.type === "hostAccepted") this.role = "host";
      if (message.type === "joinAccepted") this.role = "guest";
      this.emit(message.type, message);
    }

    send(message) {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify(message));
      }
    }

    async hostGame(details) {
      await this.connect();
      this.send({ type: "host", ...details });
    }

    async joinGame(details) {
      await this.connect();
      this.send({ type: "join", ...details });
    }

    sendInput(input) {
      this.send({ type: "input", input });
    }

    sendSnapshot(snapshot) {
      this.send({ type: "snapshot", snapshot });
    }

    startMatch() {
      this.send({ type: "startMatch" });
    }
  }

  window.LocalMultiplayerClient = LocalMultiplayerClient;
})();

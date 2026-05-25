(function() {
  "use strict";

  const ROOM_CODE_PATTERN = /^[0-9A-Z]{7}$/;
  const ROOM_CODE_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  function generateRoomCode() {
    const bytes = new Uint8Array(7);
    crypto.getRandomValues(bytes);
    let code = "";
    for (const byte of bytes) {
      code += ROOM_CODE_ALPHABET[byte % ROOM_CODE_ALPHABET.length];
    }
    return code;
  }

  function cleanRoomCode(code) {
    return String(code || "").trim().toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 7);
  }

  class MultiplayerClient {
    constructor(options = {}) {
      this.socket = null;
      this.id = null;
      this.seed = null;
      this.role = null;
      this.roomCode = cleanRoomCode(options.roomCode || "");
      this.handlers = new Map();
      this.connected = false;
    }

    on(type, handler) {
      if (!this.handlers.has(type)) this.handlers.set(type, []);
      this.handlers.get(type).push(handler);
      return () => {
        const handlers = this.handlers.get(type) || [];
        this.handlers.set(type, handlers.filter(item => item !== handler));
      };
    }

    emit(type, payload) {
      for (const handler of this.handlers.get(type) || []) {
        handler(payload);
      }
    }

    connect() {
      if (this.socket && this.connected) return Promise.resolve();
      if (!ROOM_CODE_PATTERN.test(this.roomCode)) {
        return Promise.reject(new Error("Enter a 7-character room code."));
      }

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const url = `${protocol}//${window.location.host}/multiplayer?room=${encodeURIComponent(this.roomCode)}`;

      return new Promise((resolve, reject) => {
        let settled = false;
        this.socket = new WebSocket(url);
        this.socket.addEventListener("open", () => {
          this.connected = true;
          settled = true;
          resolve();
        }, { once: true });
        this.socket.addEventListener("error", () => {
          if (!settled) reject(new Error("Could not connect to the multiplayer server."));
        }, { once: true });
        this.socket.addEventListener("close", () => {
          this.connected = false;
          this.emit("closed");
        });
        this.socket.addEventListener("message", event => this.handleMessage(event));
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
      if (message.roomCode || message.joinCode) this.roomCode = message.roomCode || message.joinCode;
      if (message.type === "hostAccepted") this.role = "host";
      if (message.type === "joinAccepted") this.role = "guest";
      this.emit(message.type, message);
    }

    send(message) {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify(message));
      }
    }

    waitFor(types, timeoutMs = 8000) {
      return new Promise((resolve, reject) => {
        const removers = [];
        const timer = setTimeout(() => {
          cleanup();
          reject(new Error("Multiplayer server did not respond."));
        }, timeoutMs);

        const cleanup = () => {
          clearTimeout(timer);
          for (const remove of removers) remove();
        };

        for (const type of types) {
          const remove = this.on(type, payload => {
            cleanup();
            if (type === "error") {
              reject(new Error(payload?.message || "Multiplayer error."));
            } else {
              resolve(payload);
            }
          });
          removers.push(remove);
        }
      });
    }

    async hostGame(details) {
      this.roomCode = generateRoomCode();
      await this.connect();
      const accepted = this.waitFor(["hostAccepted", "error"]);
      this.send({ type: "host", ...details });
      return accepted;
    }

    async joinGame(details) {
      this.roomCode = cleanRoomCode(details.code || this.roomCode);
      if (!ROOM_CODE_PATTERN.test(this.roomCode)) {
        throw new Error("Enter a 7-character room code.");
      }
      await this.connect();
      const accepted = this.waitFor(["joinAccepted", "error"]);
      this.send({ type: "join", ...details, code: this.roomCode });
      return accepted;
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

  window.MultiplayerClient = MultiplayerClient;
  window.MultiplayerRoomCode = {
    clean: cleanRoomCode,
    isValid(code) {
      return ROOM_CODE_PATTERN.test(cleanRoomCode(code));
    }
  };
})();
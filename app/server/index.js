const path = require("path");
const express = require("express");
const QRCode = require("qrcode");
const http = require("http");
const { Server } = require("socket.io");

const {
  makeSession,
  validateCard,
  calcBN,
  drawNumber,
  recomputeWins,
  generateRandomCard,
} = require("./game");

const PORT = process.env.PORT || 8080;

const app = express();
app.use(express.json());

// QR code as PNG (server-side)
app.get("/api/qr", async (req, res) => {
  try {
    const text = String(req.query.text || "").trim();
    if (!text) return res.status(400).send("Missing text");
    res.setHeader("Content-Type", "image/png");
    const png = await QRCode.toBuffer(text, {
      type: "png",
      width: 320,
      margin: 1,
      errorCorrectionLevel: "M",
    });
    res.send(png);
  } catch (e) {
    res.status(500).send("QR error");
  }
});

// static build
app.use(express.static(path.join(__dirname, "public")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const sessions = new Map(); // code -> session
const socketToSession = new Map(); // socketId -> {code, role, playerId?}

function publicSessionView(session) {
  const { totalCards, totalBN } = calcBN(session);
  return {
    code: session.code,
    createdAt: session.createdAt,
    hostName: session.host.name,
    settings: session.settings,
    state: {
      started: session.state.started,
      ended: session.state.ended,
      drawn: session.state.drawn,
      last5: session.state.drawn.slice(-5),
    },
    stats: { totalCards, totalBN },

    // backward-compatible
    drawn: session.state.drawn,
    lastNumbers: session.state.drawn.slice(-5),

    winners: session.winners,
    players: Object.values(session.players).map((p) => ({
      id: p.id,
      name: p.name,
      cardsCount: p.cards.length,
    })),
  };
}

function hostSessionView(session) {
  const pub = publicSessionView(session);
  return {
    ...pub,
    playersFull: Object.values(session.players).map((p) => ({
      id: p.id,
      name: p.name,
      socketId: p.socketId,
      cards: (p.cards || []).map((c) => ({
        id: c.id,
        numbers: c.numbers,
        wins: c.wins,
      })),
    })),
  };
}

function broadcastSession(code) {
  const session = sessions.get(code);
  if (!session) return;

  io.to(code).emit("session:update", publicSessionView(session));

  if (session.host?.socketId) {
    io.to(session.host.socketId).emit("host:update", hostSessionView(session));
  }
}

function parseDrawnInput(raw) {
  const s = String(raw || "");
  const nums = s
    .split(/[^0-9]+/g)
    .map((x) => x.trim())
    .filter(Boolean)
    .map((n) => Number(n))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 90);

  const seen = new Set();
  const out = [];
  for (const n of nums) {
    if (!seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  return out;
}

io.on("connection", (socket) => {
  // --- Host: create session
  socket.on("host:create", (payload, cb) => {
    try {
      const hostName = String(payload?.hostName || "Tomboliere").slice(0, 40);
      const session = makeSession({ hostName, settings: payload?.settings || {} });
      session.host.socketId = socket.id;

      sessions.set(session.code, session);
      socketToSession.set(socket.id, { code: session.code, role: "host" });
      socket.join(session.code);

      cb?.({ ok: true, code: session.code, session: publicSessionView(session) });
      broadcastSession(session.code);
    } catch (e) {
      cb?.({ ok: false, error: e.message });
    }
  });

  // --- Join session (player)
  socket.on("session:join", (payload, cb) => {
    try {
      const code = String(payload?.code || "").toUpperCase().trim();
      const name = String(payload?.name || "Giocatore").slice(0, 40);
      const session = sessions.get(code);
      if (!session) return cb?.({ ok: false, error: "Codice sessione non valido." });
      if (session.state.ended) return cb?.({ ok: false, error: "Sessione terminata." });

      const playerId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      session.players[playerId] = { id: playerId, name, socketId: socket.id, cards: [] };

      socketToSession.set(socket.id, { code, role: "player", playerId });
      socket.join(code);

      cb?.({ ok: true, playerId, session: publicSessionView(session) });
      broadcastSession(code);
    } catch (e) {
      cb?.({ ok: false, error: e.message });
    }
  });

  // --- Pull session snapshot (useful for "refresh numbers")
  socket.on("session:get", (payload, cb) => {
    try {
      const code = String(payload?.code || "").toUpperCase().trim();
      const session = sessions.get(code);
      if (!session) return cb?.({ ok: false, error: "Sessione non trovata." });
      cb?.({ ok: true, session: publicSessionView(session) });
    } catch (e) {
      cb?.({ ok: false, error: e.message });
    }
  });

  // --- Player: add manual card
  socket.on("player:addCard", (payload, cb) => {
    try {
      const meta = socketToSession.get(socket.id);
      if (!meta || meta.role !== "player") return cb?.({ ok: false, error: "Non autorizzato." });

      const session = sessions.get(meta.code);
      if (!session) return cb?.({ ok: false, error: "Sessione non trovata." });

      const player = session.players[meta.playerId];
      if (!player) return cb?.({ ok: false, error: "Giocatore non trovato." });

      const numbers = payload?.numbers;
      const v = validateCard(numbers);
      if (!v.ok) return cb?.({ ok: false, error: v.err });

      const cardId = `C${player.cards.length + 1}`;
      player.cards.push({
        id: cardId,
        numbers,
        wins: { ambo: false, terno: false, quaterna: false, cinquina: false, tombola: false },
      });

      cb?.({ ok: true, cardId });
      broadcastSession(meta.code);
      socket.emit("player:me", { ok: true, me: player });
    } catch (e) {
      cb?.({ ok: false, error: e.message });
    }
  });

  // --- Player: add random card
  socket.on("player:addRandomCard", (_, cb) => {
    try {
      const meta = socketToSession.get(socket.id);
      if (!meta || meta.role !== "player") return cb?.({ ok: false, error: "Non autorizzato." });

      const session = sessions.get(meta.code);
      if (!session) return cb?.({ ok: false, error: "Sessione non trovata." });

      const player = session.players[meta.playerId];
      if (!player) return cb?.({ ok: false, error: "Giocatore non trovato." });

      const numbers = generateRandomCard();
      const cardId = `C${player.cards.length + 1}`;
      player.cards.push({
        id: cardId,
        numbers,
        wins: { ambo: false, terno: false, quaterna: false, cinquina: false, tombola: false },
      });

      cb?.({ ok: true, cardId, numbers });
      broadcastSession(meta.code);
      socket.emit("player:me", { ok: true, me: player });
    } catch (e) {
      cb?.({ ok: false, error: e.message });
    }
  });

  socket.on("player:getMe", (_, cb) => {
    const meta = socketToSession.get(socket.id);
    if (!meta || meta.role !== "player") return cb?.({ ok: false, error: "Non autorizzato." });

    const session = sessions.get(meta.code);
    if (!session) return cb?.({ ok: false, error: "Sessione non trovata." });

    const player = session.players[meta.playerId];
    if (!player) return cb?.({ ok: false, error: "Giocatore non trovato." });

    cb?.({ ok: true, me: player });
  });

  // --- Host: send message to player
  socket.on("host:sendMessage", (payload, cb) => {
    try {
      const meta = socketToSession.get(socket.id);
      if (!meta || meta.role !== "host") return cb?.({ ok: false, error: "Non autorizzato." });

      const session = sessions.get(meta.code);
      if (!session) return cb?.({ ok: false, error: "Sessione non trovata." });

      const playerId = payload?.playerId;
      const message = String(payload?.message || "").trim();
      
      if (!playerId || !message) return cb?.({ ok: false, error: "Player ID e messaggio richiesti." });

      const player = session.players[playerId];
      if (!player) return cb?.({ ok: false, error: "Giocatore non trovato." });

      if (player.socketId) {
        io.to(player.socketId).emit("player:message", {
          message,
          timestamp: new Date().toISOString(),
          fromHost: session.host.name
        });
        cb?.({ ok: true });
      } else {
        cb?.({ ok: false, error: "Giocatore non connesso." });
      }
    } catch (e) {
      cb?.({ ok: false, error: e.message });
    }
  });

  // --- Player: leave session (fix: players is object, not array)
  socket.on("session:leave", (payload, cb) => {
    try {
      const code = String(payload?.code || "").toUpperCase().trim();
      const session = sessions.get(code);
      if (!session) return cb?.({ ok: true });

      const entries = Object.entries(session.players);
      for (const [pid, p] of entries) {
        if (p?.socketId === socket.id) {
          delete session.players[pid];
          break;
        }
      }

      broadcastSession(code);
      cb?.({ ok: true });
    } catch (e) {
      cb?.({ ok: true });
    }
  });

  // --- Host: draw - MODIFICATO per inviare evento numero estratto
  socket.on("host:draw", (_, cb) => {
    try {
      const meta = socketToSession.get(socket.id);
      if (!meta || meta.role !== "host") return cb?.({ ok: false, error: "Non autorizzato." });

      const session = sessions.get(meta.code);
      if (!session) return cb?.({ ok: false, error: "Sessione non trovata." });

      const result = drawNumber(session);
      if (result.done) {
        broadcastSession(meta.code);
        return cb?.({ ok: true, done: true });
      }

      // Invia evento per il numero estratto
      io.to(meta.code).emit("number:drawn", { number: result.number });

      const winEvents = recomputeWins(session);
      broadcastSession(meta.code);

      for (const ev of winEvents) io.to(meta.code).emit("win:event", ev);

      cb?.({ ok: true, number: result.number, ended: session.state.ended });
    } catch (e) {
      cb?.({ ok: false, error: e.message });
    }
  });

  // --- Host: end
  socket.on("host:end", (_, cb) => {
    const meta = socketToSession.get(socket.id);
    if (!meta || meta.role !== "host") return cb?.({ ok: false, error: "Non autorizzato." });

    const session = sessions.get(meta.code);
    if (!session) return cb?.({ ok: false, error: "Sessione non trovata." });

    session.state.ended = true;
    broadcastSession(meta.code);
    cb?.({ ok: true });
  });

  // --- Host: set drawn numbers from pasted text/array
  socket.on("host:setDrawn", (payload, cb) => {
    try {
      const meta = socketToSession.get(socket.id);
      if (!meta || meta.role !== "host") return cb?.({ ok: false, error: "Non autorizzato." });

      const session = sessions.get(meta.code);
      if (!session) return cb?.({ ok: false, error: "Sessione non trovata." });

      const arr = Array.isArray(payload?.numbers) ? payload.numbers : parseDrawnInput(payload?.text);

      if (!Array.isArray(arr)) return cb?.({ ok: false, error: "Formato non valido." });
      if (arr.some((n) => !Number.isInteger(n) || n < 1 || n > 90))
        return cb?.({ ok: false, error: "Numeri validi: interi tra 1 e 90." });

      // apply
      session.state.drawn = [...arr];
      session.state.drawnSet = new Set(arr);
      session.state.started = arr.length > 0;
      session.state.ended = false;

      // reset winners + card wins then recompute
      session.winners = { ambo: [], terno: [], quaterna: [], cinquina: [], tombola: [] };
      for (const p of Object.values(session.players)) {
        for (const c of p.cards) {
          c.wins = { ambo: false, terno: false, quaterna: false, cinquina: false, tombola: false };
        }
      }
      recomputeWins(session);

      broadcastSession(meta.code);
      cb?.({ ok: true });
    } catch (e) {
      cb?.({ ok: false, error: e.message });
    }
  });

  socket.on("disconnect", () => {
    const meta = socketToSession.get(socket.id);
    if (!meta) return;

    const session = sessions.get(meta.code);
    socketToSession.delete(socket.id);

    if (!session) return;

    if (meta.role === "player" && meta.playerId && session.players[meta.playerId]) {
      session.players[meta.playerId].socketId = null;
      broadcastSession(meta.code);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Tombola online on http://localhost:${PORT}`);
});
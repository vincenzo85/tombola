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

const SESSION_TTL = 24 * 60 * 60 * 1000; // 24 ore dopo fine partita

function cleanupOldSessions() {
  const now = Date.now();
  for (const [code, session] of sessions.entries()) {
    if (session.state.ended) {
      const endTime = new Date(session.state.endedAt || session.createdAt).getTime();
      if (now - endTime > SESSION_TTL) {
        console.log(`Cleaning up old session: ${code}`);
        sessions.delete(code);
      }
    }
  }
}

setInterval(cleanupOldSessions, 60 * 60 * 1000);
app.use(express.json());

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

app.use(express.static(path.join(__dirname, "public")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const server = http.createServer(app);
const io = new Server(server, { 
  cors: { 
    origin: process.env.NODE_ENV === 'production' 
      ? ["https://tombola.freeinfo.it"]
      : ["http://localhost:8080", "http://localhost:5173"],
    credentials: true
  },
  connectionStateRecovery: {
    maxDisconnectionDuration: 20 * 60 * 1000, // 20 minuti
    skipMiddlewares: true
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

const rateLimit = new Map();
const RATE_LIMIT_WINDOW = 60000;
const MAX_EVENTS_PER_WINDOW = 30;

io.use((socket, next) => {
  const ip = socket.handshake.address;
  const now = Date.now();
  
  if (!rateLimit.has(ip)) {
    rateLimit.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
  } else {
    const data = rateLimit.get(ip);
    if (now > data.resetTime) {
      data.count = 1;
      data.resetTime = now + RATE_LIMIT_WINDOW;
    } else {
      data.count++;
      if (data.count > MAX_EVENTS_PER_WINDOW) {
        console.log(`Rate limit exceeded for IP: ${ip}`);
        return next(new Error("Rate limit exceeded. Please slow down."));
      }
    }
  }
  
  if (Math.random() < 0.01) {
    for (const [key, value] of rateLimit.entries()) {
      if (now > value.resetTime + RATE_LIMIT_WINDOW * 10) {
        rateLimit.delete(key);
      }
    }
  }
  
  next();
});

const sessions = new Map();
const socketToSession = new Map();

function publicSessionView(session) {
  const { totalCards, totalBN } = calcBN(session);
  return {
    code: session.code,
    createdAt: session.createdAt,
    hostName: session.host.name,
    settings: {
      bnPerCard: session.settings.bnPerCard,
      splits: session.settings.splits,
      allowNewCards: session.settings.allowNewCards 
    },
    state: {
      started: session.state.started,
      ended: session.state.ended,
      drawn: session.state.drawn,
      last5: session.state.drawn.slice(-5),
    },
    stats: { totalCards, totalBN },
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
        manuallyMarked: c.manuallyMarked ? Array.from(c.manuallyMarked) : []
      })),
    })),
  };
}

function broadcastSession(code) {
  const session = sessions.get(code);
  if (!session) return;

  io.to(code).emit("session:update", publicSessionView(session));

  if (session.host?.socketId) {
    sendHostView(code);
  }
}

function sendHostView(code) {
  const session = sessions.get(code);
  if (!session || !session.host?.socketId) return;

  io.to(session.host.socketId).emit("host:update", { 
    ...hostSessionView(session),
    eventLog: session.eventLog || []
  });
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

// ✅ FUNZIONE LOG EVENTI
function logEvent(code, type, message, data = {}) {
  const session = sessions.get(code);
  if (!session) return;
  
  if (!session.eventLog) session.eventLog = [];
  
  const event = {
    timestamp: new Date().toISOString(),
    type,
    message,
    data
  };
  
  session.eventLog.unshift(event);
  
  if (session.eventLog.length > 100) {
    session.eventLog = session.eventLog.slice(0, 100);
  }
  
  console.log(`[SESSION ${code}] ${type.toUpperCase()}: ${message}`, data);
  
  sendHostView(code);
}

io.on("connection", (socket) => {
  console.log(`[CONNECT] Socket ${socket.id} connected`);
  
  // Ping/pong automatico ogni 25 secondi
  const heartbeatInterval = setInterval(() => {
    socket.emit("ping");
  }, 25000);
  
  socket.on("pong", () => {
    // Client risponde, connessione ok
  });
  
  socket.on("disconnect", (reason) => {
    console.log(`[DISCONNECT] Socket ${socket.id} disconnected: ${reason}`);
    clearInterval(heartbeatInterval);
  });
  
  socket.on("host:create", (payload, cb) => {
    try {
      const hostName = String(payload?.hostName || "Tomboliere").slice(0, 40);
      const session = makeSession({ hostName, settings: payload?.settings || {} });
      session.host.socketId = socket.id;

      sessions.set(session.code, session);
      socketToSession.set(socket.id, { code: session.code, role: "host" });
      socket.join(session.code);

      logEvent(session.code, 'session_created', `Sessione creata da ${hostName}`);

      cb?.({ ok: true, code: session.code, session: publicSessionView(session) });
      broadcastSession(session.code);
    } catch (e) {
      cb?.({ ok: false, error: e.message });
    }
  });

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

      logEvent(code, 'player_joined', `${name} si è unito alla partita`, { playerId });

      cb?.({ ok: true, playerId, session: publicSessionView(session) });
      broadcastSession(code);
    } catch (e) {
      cb?.({ ok: false, error: e.message });
    }
  });

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

  socket.on("player:addCard", (payload, cb) => {
    try {
      const meta = socketToSession.get(socket.id);
      if (!meta || meta.role !== "player") return cb?.({ ok: false, error: "Non autorizzato." });

      const session = sessions.get(meta.code);
      if (!session) return cb?.({ ok: false, error: "Sessione non trovata." });

      if (!session.settings.allowNewCards) {
        return cb?.({ ok: false, error: "⛔ L'host ha disabilitato l'aggiunta di nuove cartelle." });
      }

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

      logEvent(meta.code, 'card_added', `${player.name} ha aggiunto la cartella ${cardId}`, { 
        playerId: player.id, 
        cardId 
      });

      cb?.({ ok: true, cardId });
      broadcastSession(meta.code);
      socket.emit("player:me", { 
        ok: true, 
        me: {
          ...player,
          cards: player.cards.map(c => ({
            ...c,
            manuallyMarked: c.manuallyMarked ? Array.from(c.manuallyMarked) : []
          }))
        }
      });
    } catch (e) {
      logEvent(meta?.code, 'error', `Errore aggiunta cartella`, { error: e.message });
      cb?.({ ok: false, error: e.message });
    }
  });

  socket.on("host:toggleNewCards", (payload, cb) => {
    try {
      const meta = socketToSession.get(socket.id);
      if (!meta || meta.role !== "host") return cb?.({ ok: false, error: "Non autorizzato." });

      const session = sessions.get(meta.code);
      if (!session) return cb?.({ ok: false, error: "Sessione non trovata." });

      const allowNewCards = payload?.allowNewCards !== undefined 
        ? Boolean(payload.allowNewCards)
        : !session.settings.allowNewCards;

      session.settings.allowNewCards = allowNewCards;

      logEvent(meta.code, 'settings', `Iscrizioni cartelle ${allowNewCards ? 'APERTE' : 'CHIUSE'}`);

      broadcastSession(meta.code);
      
      io.to(meta.code).emit("cards:statusChanged", { 
        allowed: allowNewCards,
        message: allowNewCards 
          ? "✅ Il tomboliere ha riattivato l'aggiunta di nuove cartelle"
          : "⛔ Il tomboliere ha disattivato l'aggiunta di nuove cartelle"
      });

      cb?.({ ok: true, allowNewCards });
    } catch (e) {
      logEvent(meta?.code, 'error', 'Errore cambio stato cartelle', { error: e.message });
      cb?.({ ok: false, error: e.message });
    }
  });

  socket.on("player:addRandomCard", (_, cb) => {
    try {
      const meta = socketToSession.get(socket.id);
      if (!meta || meta.role !== "player") return cb?.({ ok: false, error: "Non autorizzato." });

      const session = sessions.get(meta.code);
      if (!session) return cb?.({ ok: false, error: "Sessione non trovata." });

      if (!session.settings.allowNewCards) {
        return cb?.({ ok: false, error: "⛔ L'host ha disabilitato l'aggiunta di nuove cartelle." });
      }

      const player = session.players[meta.playerId];
      if (!player) return cb?.({ ok: false, error: "Giocatore non trovato." });

      const numbers = generateRandomCard();
      const cardId = `C${player.cards.length + 1}`;
      player.cards.push({
        id: cardId,
        numbers,
        wins: { ambo: false, terno: false, quaterna: false, cinquina: false, tombola: false },
      });

      logEvent(meta.code, 'card_added', `${player.name} ha aggiunto cartella CASUALE ${cardId}`, { 
        playerId: player.id, 
        cardId 
      });

      cb?.({ ok: true, cardId, numbers });
      broadcastSession(meta.code);
      socket.emit("player:me", { ok: true, me: player });
    } catch (e) {
      logEvent(meta?.code, 'error', `Errore cartella casuale`, { error: e.message });
      cb?.({ ok: false, error: e.message });
    }
  });

  socket.on("host:updateSettings", (payload, cb) => {
    try {
      const meta = socketToSession.get(socket.id);
      if (!meta || meta.role !== "host") return cb?.({ ok: false, error: "Non autorizzato." });

      const session = sessions.get(meta.code);
      if (!session) return cb?.({ ok: false, error: "Sessione non trovata." });

      if (payload.settings) {
        session.settings = { ...session.settings, ...payload.settings };
        logEvent(meta.code, 'settings', 'Impostazioni aggiornate', { settings: payload.settings });
      }

      broadcastSession(meta.code);
      cb?.({ ok: true });
    } catch (e) {
      logEvent(meta?.code, 'error', 'Errore aggiornamento impostazioni', { error: e.message });
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
        
        logEvent(meta.code, 'message', `Messaggio inviato a ${player.name}: "${message}"`);
        
        cb?.({ ok: true });
      } else {
        cb?.({ ok: false, error: "Giocatore non connesso." });
      }
    } catch (e) {
      cb?.({ ok: false, error: e.message });
    }
  });

  socket.on("session:leave", (payload, cb) => {
    try {
      const code = String(payload?.code || "").toUpperCase().trim();
      const playerId = payload?.playerId;
      
      const session = sessions.get(code);
      if (!session) return cb?.({ ok: true });

      if (playerId && session.players[playerId]) {
        const playerName = session.players[playerId].name;
        delete session.players[playerId];
        logEvent(code, 'player_left', `${playerName} ha lasciato la partita`);
      } else {
        const entries = Object.entries(session.players);
        for (const [pid, p] of entries) {
          if (p?.socketId === socket.id) {
            logEvent(code, 'player_left', `${p.name} ha lasciato la partita`);
            delete session.players[pid];
            break;
          }
        }
      }

      broadcastSession(code);
      cb?.({ ok: true });
    } catch (e) {
      cb?.({ ok: true });
    }
  });

  socket.on("host:draw", (_, cb) => {
    try {
      const meta = socketToSession.get(socket.id);
      if (!meta || meta.role !== "host") return cb?.({ ok: false, error: "Non autorizzato." });

      const session = sessions.get(meta.code);
      if (!session) return cb?.({ ok: false, error: "Sessione non trovata." });

      const result = drawNumber(session);
      if (result.done) {
        logEvent(meta.code, 'draw', 'Tentativo estrazione con numeri finiti');
        broadcastSession(meta.code);
        return cb?.({ ok: true, done: true });
      }

      const remaining = 90 - session.state.drawn.length;
      logEvent(meta.code, 'draw', `Numero estratto: ${result.number}`, { 
        number: result.number, 
        remaining 
      });

      io.to(meta.code).emit("number:drawn", { number: result.number });

      const winEvents = recomputeWins(session);
      
      if (winEvents.length) {
        winEvents.forEach(w => {
          logEvent(meta.code, 'win', `${w.playerName} - ${w.type.toUpperCase()} sulla cartella ${w.cardId}!`, w);
        });
      }

      if (session.state.ended) {
        logEvent(meta.code, 'game_end', 'TOMBOLA! Partita terminata');
      }

      broadcastSession(meta.code);

      for (const ev of winEvents) io.to(meta.code).emit("win:event", ev);

      cb?.({ ok: true, number: result.number, ended: session.state.ended });
    } catch (e) {
      logEvent(meta?.code, 'error', 'Errore durante estrazione', { error: e.message });
      cb?.({ ok: false, error: e.message });
    }
  });

  socket.on("host:end", (_, cb) => {
    const meta = socketToSession.get(socket.id);
    if (!meta || meta.role !== "host") return cb?.({ ok: false, error: "Non autorizzato." });

    const session = sessions.get(meta.code);
    if (!session) return cb?.({ ok: false, error: "Sessione non trovata." });

    session.state.ended = true;
    session.state.endedAt = new Date().toISOString();

    logEvent(meta.code, 'game_end', 'Partita terminata manualmente dall\'host');

    broadcastSession(meta.code);
    cb?.({ ok: true });
  });

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

      session.state.drawn = [...arr];
      session.state.drawnSet = new Set(arr);
      session.state.started = arr.length > 0;
      session.state.ended = false;

      session.winners = { ambo: [], terno: [], quaterna: [], cinquina: [], tombola: [] };
      for (const p of Object.values(session.players)) {
        for (const c of p.cards) {
          c.wins = { ambo: false, terno: false, quaterna: false, cinquina: false, tombola: false };
        }
      }
      recomputeWins(session);

      logEvent(meta.code, 'import', `Importati ${arr.length} numeri estratti`, { numbers: arr });

      broadcastSession(meta.code);
      cb?.({ ok: true });
    } catch (e) {
      logEvent(meta?.code, 'error', 'Errore importazione numeri', { error: e.message });
      cb?.({ ok: false, error: e.message });
    }
  });

  socket.on("host:deleteCard", (payload, cb) => {
    try {
      const meta = socketToSession.get(socket.id);
      if (!meta || meta.role !== "host") return cb?.({ ok: false, error: "Non autorizzato." });

      const session = sessions.get(meta.code);
      if (!session) return cb?.({ ok: false, error: "Sessione non trovata." });

      const { playerId, cardId } = payload;
      const player = session.players[playerId];
      if (!player) return cb?.({ ok: false, error: "Giocatore non trovato." });

      const cardIndex = player.cards.findIndex(c => c.id === cardId);
      if (cardIndex === -1) return cb?.({ ok: false, error: "Cartella non trovata." });

      player.cards.splice(cardIndex, 1);
      
      player.cards.forEach((card, idx) => {
        card.id = `C${idx + 1}`;
      });

      logEvent(meta.code, 'card_deleted', `Host ha eliminato cartella ${cardId} di ${player.name}`, { playerId, cardId });

      broadcastSession(meta.code);
      
      if (player.socketId) {
        io.to(player.socketId).emit("player:me", { 
          ok: true, 
          me: {
            ...player,
            cards: player.cards.map(c => ({
              ...c,
              manuallyMarked: c.manuallyMarked ? Array.from(c.manuallyMarked) : []
            }))
          }
        });
      }
      
      cb?.({ ok: true });
    } catch (e) {
      logEvent(meta?.code, 'error', 'Errore eliminazione cartella', { error: e.message });
      cb?.({ ok: false, error: e.message });
    }
  });

  socket.on("player:deleteCard", (payload, cb) => {
    try {
      const meta = socketToSession.get(socket.id);
      if (!meta || meta.role !== "player") return cb?.({ ok: false, error: "Non autorizzato." });
      
      const session = sessions.get(meta.code);
      if (!session) return cb?.({ ok: false, error: "Sessione non trovata." });
      
      const player = session.players[meta.playerId];
      if (!player) return cb?.({ ok: false, error: "Giocatore non trovato." });
      
      const cardIndex = player.cards.findIndex(c => c.id === payload.cardId);
      if (cardIndex === -1) return cb?.({ ok: false, error: "Cartella non trovata." });
      
      player.cards.splice(cardIndex, 1);
      player.cards.forEach((card, idx) => { card.id = `C${idx + 1}`; });
      
      logEvent(meta.code, 'card_deleted', `${player.name} ha eliminato la propria cartella ${payload.cardId}`);
      
      broadcastSession(meta.code);
      socket.emit("player:me", { ok: true, me: player });
      cb?.({ ok: true });
    } catch (e) {
      cb?.({ ok: false, error: e.message });
    }
  });

  socket.on("host:drawSpecific", (payload, cb) => {
    try {
      const meta = socketToSession.get(socket.id);
      if (!meta || meta.role !== "host") return cb?.({ ok: false, error: "Non autorizzato." });
      
      const session = sessions.get(meta.code);
      if (!session) return cb?.({ ok: false, error: "Sessione non trovata." });
      
      const number = parseInt(payload.number);
      if (!Number.isInteger(number) || number < 1 || number > 90) {
        return cb?.({ ok: false, error: "Numero non valido (1-90)." });
      }
      
      if (session.state.drawnSet.has(number)) {
        return cb?.({ ok: false, error: `Il numero ${number} è già stato estratto.` });
      }
      
      session.state.drawn.push(number);
      session.state.drawnSet.add(number);
      session.state.started = true;
      
      logEvent(meta.code, 'draw', `Numero estratto MANUALMENTE: ${number}`, { number, manual: true });
      
      io.to(meta.code).emit("number:drawn", { number });
      
      const winEvents = recomputeWins(session);
      
      if (winEvents.length) {
        winEvents.forEach(w => {
          logEvent(meta.code, 'win', `${w.playerName} - ${w.type.toUpperCase()} sulla cartella ${w.cardId}!`, w);
        });
      }

      if (session.state.ended) {
        logEvent(meta.code, 'game_end', 'TOMBOLA! Partita terminata');
      }
      
      broadcastSession(meta.code);
      
      for (const ev of winEvents) io.to(meta.code).emit("win:event", ev);
      
      cb?.({ ok: true, number, ended: session.state.ended });
    } catch (e) {
      logEvent(meta?.code, 'error', 'Errore estrazione manuale', { error: e.message });
      cb?.({ ok: false, error: e.message });
    }
  });

  socket.on("host:resetPartial", (_, cb) => {
    try {
      const meta = socketToSession.get(socket.id);
      if (!meta || meta.role !== "host") return cb?.({ ok: false, error: "Non autorizzato." });
      
      const session = sessions.get(meta.code);
      if (!session) return cb?.({ ok: false, error: "Sessione non trovata." });
      
      session.state.drawn = [];
      session.state.drawnSet = new Set();
      session.state.started = false;
      session.state.ended = false;
      delete session.state.endedAt;
      
      session.winners = { ambo: [], terno: [], quaterna: [], cinquina: [], tombola: [] };
      
      for (const p of Object.values(session.players)) {
        for (const c of p.cards) {
          c.wins = { ambo: false, terno: false, quaterna: false, cinquina: false, tombola: false };
          delete c.manuallyMarked;
        }
      }
      
      logEvent(meta.code, 'reset', 'Reset parziale - cartelle mantenute, numeri azzerati');
      
      broadcastSession(meta.code);
      cb?.({ ok: true });
    } catch (e) {
      logEvent(meta?.code, 'error', 'Errore reset parziale', { error: e.message });
      cb?.({ ok: false, error: e.message });
    }
  });

  socket.on("player:markNumber", (payload, cb) => {
    try {
      const meta = socketToSession.get(socket.id);
      if (!meta || meta.role !== "player") return cb?.({ ok: false, error: "Non autorizzato." });
      
      const session = sessions.get(meta.code);
      if (!session) return cb?.({ ok: false, error: "Sessione non trovata." });
      
      const player = session.players[meta.playerId];
      if (!player) return cb?.({ ok: false, error: "Giocatore non trovato." });
      
      const { cardId, number } = payload;
      const card = player.cards.find(c => c.id === cardId);
      if (!card) return cb?.({ ok: false, error: "Cartella non trovata." });
      
      if (!card.manuallyMarked) card.manuallyMarked = new Set();
      
      if (card.manuallyMarked.has(number)) {
        card.manuallyMarked.delete(number);
      } else {
        card.manuallyMarked.add(number);
      }
      
      socket.emit("player:me", { ok: true, me: player });
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

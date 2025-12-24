function randCode(len = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function nowIso() {
  return new Date().toISOString();
}

// cartella: 3 righe x 5 numeri
function detectRowCombos(cardNumbers, drawnSet) {
  const combos = { ambo: false, terno: false, quaterna: false, cinquina: false };
  for (const row of cardNumbers) {
    const hits = row.filter(n => drawnSet.has(n)).length;
    if (hits >= 2) combos.ambo = true;
    if (hits >= 3) combos.terno = true;
    if (hits >= 4) combos.quaterna = true;
    if (hits >= 5) combos.cinquina = true;
  }
  return combos;
}

function isTombola(cardNumbers, drawnSet) {
  const flat = cardNumbers.flat();
  return flat.every(n => drawnSet.has(n));
}

function validateCard(cardNumbers) {
  if (!Array.isArray(cardNumbers) || cardNumbers.length !== 3) return { ok: false, err: "La cartella deve avere 3 righe." };
  for (const row of cardNumbers) {
    if (!Array.isArray(row) || row.length !== 5) return { ok: false, err: "Ogni riga deve avere 5 numeri." };
  }
  const flat = cardNumbers.flat();
  if (flat.some(n => typeof n !== "number" || !Number.isInteger(n))) return { ok: false, err: "I numeri devono essere interi." };
  if (flat.some(n => n < 1 || n > 90)) return { ok: false, err: "I numeri devono essere tra 1 e 90." };
  const set = new Set(flat);
  if (set.size !== flat.length) return { ok: false, err: "Niente numeri duplicati nella stessa cartella." };
  return { ok: true };
}

function calcBN(session) {
  const bn = Number(session.settings.bnPerCard ?? 2);
  let totalCards = 0;
  for (const p of Object.values(session.players)) totalCards += p.cards.length;
  return { totalCards, totalBN: bn * totalCards };
}

function makeSession({ hostName, settings }) {
  const code = randCode(6);
  return {
    code,
    createdAt: nowIso(),
    host: { name: hostName, socketId: null },
    settings: {
      bnPerCard: Number(settings?.bnPerCard ?? 2),
      splits: settings?.splits ?? { ambo: 15, terno: 20, quaterna: 20, cinquina: 20, tombola: 25 }
    },
    allowNewCards: settings?.allowNewCards ?? true,
    state: {
      started: false,
      ended: false,
      drawn: [],
      drawnSet: new Set()
    },
    players: {},
    winners: { ambo: [], terno: [], quaterna: [], cinquina: [], tombola: [] }
  };
}

function drawNumber(session) {
  if (session.state.ended) throw new Error("Sessione terminata.");
  const all = [];
  for (let i = 1; i <= 90; i++) if (!session.state.drawnSet.has(i)) all.push(i);
  if (all.length === 0) {
    session.state.ended = true;
    return { done: true };
  }
  const n = all[Math.floor(Math.random() * all.length)];
  session.state.drawn.push(n);
  session.state.drawnSet.add(n);
  session.state.started = true;
  return { done: false, number: n };
}

function recomputeWins(session) {
  const drawnSet = session.state.drawnSet;
  const newEvents = [];

  for (const p of Object.values(session.players)) {
    for (const card of p.cards) {
      const rowCombos = detectRowCombos(card.numbers, drawnSet);
      const tombola = isTombola(card.numbers, drawnSet);

      // Per ogni tipo di vincita, controlla se è la PRIMA di quel tipo
      for (const t of ["ambo","terno","quaterna","cinquina"]) {
        if (rowCombos[t] && !card.wins[t]) {
          card.wins[t] = true;
          const isFirstWin = session.winners[t].length === 0; // Controlla se è la prima di questo tipo
          session.winners[t].push({ playerName: p.name, cardId: card.id, atNumber: session.state.drawn.at(-1) });
          newEvents.push({ 
            type: t, 
            playerName: p.name, 
            cardId: card.id,
            isFirst: isFirstWin // Flag per il primo vincitore
          });
        }
      }

      if (tombola && !card.wins.tombola) {
        card.wins.tombola = true;
        const isFirstWin = session.winners.tombola.length === 0;
        session.winners.tombola.push({ playerName: p.name, cardId: card.id, atNumber: session.state.drawn.at(-1) });
        newEvents.push({ 
          type: "tombola", 
          playerName: p.name, 
          cardId: card.id,
          isFirst: isFirstWin
        });
        session.state.ended = true;
      }
    }
  }

  return newEvents;
}

function colIndexFor(n) {
  if (n >= 1 && n <= 9) return 0;
  if (n >= 10 && n <= 19) return 1;
  if (n >= 20 && n <= 29) return 2;
  if (n >= 30 && n <= 39) return 3;
  if (n >= 40 && n <= 49) return 4;
  if (n >= 50 && n <= 59) return 5;
  if (n >= 60 && n <= 69) return 6;
  if (n >= 70 && n <= 79) return 7;
  return 8; // 80-90
}

function rangeForCol(col) {
  if (col === 0) return [1, 9];
  if (col === 8) return [80, 90];
  return [col * 10, col * 10 + 9];
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateRandomCard() {
  // 1) quante celle per colonna (9 colonne): totale 15, min 1, max 3
  const counts = Array(9).fill(1);
  let remaining = 15 - 9; // 6 extra da distribuire

  while (remaining > 0) {
    const c = randInt(0, 8);
    if (counts[c] < 3) {
      counts[c]++;
      remaining--;
    }
  }

  // 2) estrai numeri unici per colonna
  const used = new Set();
  const cols = Array.from({ length: 9 }, () => []);

  for (let c = 0; c < 9; c++) {
    const [a, b] = rangeForCol(c);
    while (cols[c].length < counts[c]) {
      const n = randInt(a, b);
      if (!used.has(n)) {
        used.add(n);
        cols[c].push(n);
      }
    }
    cols[c].sort((x, y) => x - y);
  }

  // 3) distribuisci su 3 righe con max 5 numeri per riga
  const rows = [[], [], []];
  const rowCount = [0, 0, 0];

  // distribuzione bilanciata: riempi sempre la riga più “vuota”
  for (let c = 0; c < 9; c++) {
    for (const n of cols[c]) {
      const options = [0, 1, 2].filter(r => rowCount[r] < 5);
      options.sort((r1, r2) => rowCount[r1] - rowCount[r2]);
      const r = options[0];

      rows[r].push(n);
      rowCount[r]++;
    }
  }

  // sicurezza: devono essere 5/5/5
  if (rowCount.some(x => x !== 5)) {
    // fallback semplice (rarissimo): rigenera
    return generateRandomCard();
  }

  // opzionale: ordina ogni riga per colonna (così “visivamente” ha senso)
  rows.forEach(row => row.sort((a, b) => colIndexFor(a) - colIndexFor(b) || a - b));

  return rows;
}


module.exports = { makeSession, validateCard, calcBN, drawNumber, recomputeWins, generateRandomCard };

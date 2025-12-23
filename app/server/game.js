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

function generateRandomCard() {
  const nums = new Set();
  while (nums.size < 15) {
    nums.add(Math.floor(Math.random() * 90) + 1);
  }
  const arr = Array.from(nums).sort((a, b) => a - b);
  return [arr.slice(0, 5), arr.slice(5, 10), arr.slice(10, 15)];
}

module.exports = { makeSession, validateCard, calcBN, drawNumber, recomputeWins, generateRandomCard };

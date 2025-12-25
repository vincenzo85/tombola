# Tombola Online (Docker) 🎄

Sistema completo per giocare a tombola online con gestione realtime, notifiche, e strumenti avanzati per il tomboliere.

## 🚀 Avvio Rapido

### Sviluppo locale
```
docker compose up --build
```

Apri: http://localhost:8080

Da mobile (stessa rete): http://IP_DEL_PC:8080

### Produzione (con SSL)
```
# Prima volta: genera certificati SSL
./scripts/init-letsencrypt.sh

# Avvia servizi
docker compose up -d

# Verifica logs
docker compose logs -f tombola
```

Accedi: https://tombola.freeinfo.it

---

## 🎮 Funzionalità Principali

### **Core Gameplay**
1. **Tomboliere** crea una sessione e condivide il codice (6 caratteri)
2. **Giocatori** entrano con codice + nickname
3. Inserimento cartelle **manuale** (3 righe × 5 numeri) o **casuali** (🎲)
4. **Spunta automatica** numeri estratti su tutte le cartelle
5. **Rilevamento vincite realtime**: ambo, terno, quaterna, cinquina, tombola
6. **Notifiche** toast + popup per ogni vincita

---

## 💰 Sistema Punti BN (Babbi Natali)

L'app calcola premi in **"Babbi Natali (BN)"** - punti virtuali, **NON denaro reale**.

- **Montepremi**: `Totale cartelle × BN per cartella`
- **Ripartizione personalizzabile**: slider % per ogni premio (ambo, terno, ecc.)
- **Algoritmo "Largest Remainder"**: garantisce somma esatta senza arrotondamenti strani

> ⚠️ **Disclaimer**: Eventuali accordi economici tra partecipanti avvengono **fuori dall'app**.

---

## ⚙️ Strumenti Tomboliere (Host)

### **Gestione Partita**
- ✅ **Estrazione casuale**: pulsante 🎲 per numero random
- ✅ **Estrazione manuale**: input 1-90 per forzare numero specifico
- ✅ **Reset parziale**: azzera numeri ma mantiene cartelle
- ✅ **Reset totale**: azzera tutto (con conferma)
- ✅ **Importa partita**: incolla lista numeri estratti (con validazione e conferma)
- ✅ **Copia numeri**: esporta estratti in formato CSV

### **Gestione Iscrizioni**
- ✅ **Blocco cartelle**: toggle per chiudere/aprire iscrizioni
  - 🟢 APERTE: giocatori possono aggiungere cartelle
  - 🔴 CHIUSE: nessuna nuova cartella accettata
- ✅ **Elimina cartelle**: rimuovi cartelle di giocatori (con conferma)

### **Gestione Premi**
- ✅ **Slider BN/cartella**: 0-10, step 0.5
- ✅ **Ripartizione live**: modifica % premi durante partita
- ✅ **Blocco slider**: congela premi specifici mentre modifichi altri

### **Comunicazione**
- ✅ **Messaggi ai giocatori**: invia testo a singoli partecipanti
- ✅ **QR Code**: condivisione link join con scansione
- ✅ **Visualizzazione cartelle**: vedi tutte le cartelle dei giocatori in tempo reale

### **🆕 Sistema di Resilienza Connessione**
- ✅ **Heartbeat automatico**: ping/pong ogni 25s mantiene connessione viva
- ✅ **Auto-reconnect**: riconnessione automatica se si disconnette
- ✅ **Indicatore visivo**: badge colorato mostra stato connessione
  - 🟢 **CONNESSO**: tutto ok
  - 🟡 **RICONNESSIONE**: tentativo di recupero in corso
  - 🔴 **DISCONNESSO**: connessione persa
- ✅ **Refresh manuale**: pulsante "🔄 Aggiorna Stato" per forzare ricaricamento
- ✅ **Persistenza sessione**: recupera automaticamente la sessione dopo ricarica pagina (fino a 2 ore)
- ✅ **Pulsanti intelligenti**: disabilitati automaticamente se disconnesso

### **🆕 Log Eventi Live**
- ✅ **Pannello eventi realtime**: tutti gli eventi visibili all'host
- ✅ **Filtri per tipo**: draw, win, card_added, settings, error
- ✅ **Timestamp**: ora esatta di ogni evento
- ✅ **Dettagli espandibili**: dati JSON per debug
- ✅ **Ultimi 100 eventi**: auto-cleanup vecchi record
- ✅ **Eventi tracciati**:
  - Estrazioni numeri (casuali e manuali)
  - Cartelle aggiunte/eliminate
  - Vincite (con dettagli giocatore/cartella)
  - Cambio impostazioni
  - Join/leave giocatori
  - Errori e problemi

---

## 🎉 Funzionalità Player (Giocatore)

### **Gestione Cartelle**
- ✅ **Inserimento manuale**: griglia 3×5 con validazione
- ✅ **Cartelle casuali**: genera 15 numeri validi automaticamente
- ✅ **Elimina cartelle**: rimuovi le tue cartelle (prima di vincite)
- ✅ **Spunta automatica**: numeri estratti evidenziati in verde
- ✅ **Badge vincite**: ambo/terno/quaterna/cinquina/tombola visibili su ogni cartella

### **Visualizzazione**
- ✅ **Tabellone 1-90**: tutti i numeri con evidenziazione estratti
- ✅ **Ultimi 5 numeri**: sempre visibili in alto
- ✅ **🆕 Smorfia Napoletana**: ogni numero mostra significato tradizionale con emoji
  - Es: 48 → "🗣️ Il morto che parla"
  - Es: 90 → "😱 La paura"

### **Notifiche**
- ✅ **Popup numero estratto**: appare ad ogni estrazione (3s)
- ✅ **Popup vincite**: 
  - Solo **primo** ambo/terno/quaterna/cinquina di tutta la partita
  - **Tutte** le tombola
  - Animazione fuochi d'artificio 🎆
- ✅ **Toast vincite**: notifica permanente per ogni vincita
- ✅ **Toggle popup globale**: 🔔/🔕 disabilita/abilita popup (salvato in localStorage)
- ✅ **Messaggi host**: ricevi comunicazioni dal tomboliere

### **Utilità**
- ✅ **Copia numeri**: esporta estratti facilmente
- ✅ **Refresh automatico**: aggiornamento realtime senza ricaricare

---

## 🔧 Architettura Tecnica

```
┌──────────────────────────────────────────────┐
│         Browser Client (React)               │
│  -  Vite build ottimizzata                    │
│  -  Socket.IO client con auto-reconnect       │
│  -  LocalStorage per persistenza              │
└────────────────┬─────────────────────────────┘
                 │ HTTPS/WSS
┌────────────────▼─────────────────────────────┐
│         Nginx Reverse Proxy                  │
│  -  TLS/SSL termination (Let's Encrypt)       │
│  -  WebSocket proxy                           │
│  -  Gzip compression                          │
└────────────────┬─────────────────────────────┘
                 │ HTTP/WS (interno)
┌────────────────▼─────────────────────────────┐
│      Node.js Server (Express)                │
│  -  Socket.IO server con heartbeat            │
│  -  Session management in-memory              │
│  -  Game logic (game.js)                      │
│  -  QR code generation                        │
│  -  Event logging system                      │
└──────────────────────────────────────────────┘
```

### **Stack Tecnologico**
- **Frontend**: React 18, Vite, Socket.IO-client
- **Backend**: Node.js 20, Express, Socket.IO
- **Infrastruttura**: Docker, Nginx, Let's Encrypt
- **Persistenza**: In-memory (session recovery via localStorage client-side)

---

## 📱 Test Funzionalità

### **Scenario Base**
```
# 1. Host crea sessione
Vai su /host → Imposta BN e ripartizione → "Crea sessione"

# 2. Player si unisce
Scansiona QR o vai su /join → Inserisci codice

# 3. Aggiungi cartelle
Player: inserisci numeri manualmente o usa 🎲

# 4. Chiudi iscrizioni
Host: clicca "⛔ Chiudi Iscrizioni"

# 5. Estrai numeri
Host: usa "🎲 Estrai Casuale" o inserisci numero manuale

# 6. Verifica vincite
Player: vedi popup + toast + badge su cartella
Host: vedi log eventi con dettagli
```

### **Test Resilienza**
```
# Simula disconnessione
1. Host estrae alcuni numeri
2. Spegni WiFi per 1 minuto
3. Riaccendi → badge diventa 🟡 poi 🟢
4. Clicca "🔄 Aggiorna Stato"
5. Verifica che numeri estratti siano sincronizzati
```

### **Test Import/Export**
```
# Export numeri
Host: clicca "📋 Copia Estratti"
Ctrl+V in un file → vedi "5, 12, 33, 45, 90"

# Import numeri
Host: incolla "1 2 3 10 20 30" → "✅ Imposta estratti"
Conferma → Verifica tabellone aggiornato
```

---

## 🐛 Troubleshooting

### **Problema: Disconnessioni frequenti dopo 15 minuti**
**Soluzione**: Implementato heartbeat automatico (ping ogni 25s) + auto-reconnect

### **Problema: Non posso estrarre dopo ricarica pagina**
**Soluzione**: Usa pulsante "🔄 Aggiorna Stato" o clicca sul badge connessione

### **Problema: Popup troppo invasivi**
**Soluzione**: Clicca 🔔 → 🔕 nell'header per disabilitare

### **Problema: Certificati SSL scaduti**
```
# Rinnova manualmente
docker compose run --rm certbot renew

# Riavvia nginx
docker compose restart nginx
```

### **Problema: Porta 80/443 già in uso**
```
# Trova processo
sudo lsof -i :80
sudo lsof -i :443

# Stoppa servizio
sudo systemctl stop apache2  # o nginx

# Riavvia tombola
docker compose up -d
```

---

## 📦 Struttura Progetto

```
tombola/
├── app/
│   ├── client/              # React frontend
│   │   ├── src/
│   │   │   ├── pages/       # Host, Player, Join, Home
│   │   │   ├── components/  # Board, CartellaView, etc.
│   │   │   ├── App.jsx      # Main component con socket
│   │   │   └── styles.css   # Tema natalizio + animazioni
│   │   └── vite.config.js
│   ├── server/              # Node.js backend
│   │   ├── index.js         # Express + Socket.IO + logging
│   │   ├── game.js          # Logica tombola
│   │   └── package.json
│   └── Dockerfile
├── nginx/
│   └── conf.d/tombola.conf  # Proxy config con WebSocket
├── certbot/                 # Certificati SSL
├── scripts/
│   └── init-letsencrypt.sh  # Setup SSL automatico
├── docker-compose.yml
└── README.md
```

---

## 🎯 Roadmap Future (Possibili Estensioni)

- [ ] **Persistenza Redis**: salvare sessioni su database
- [ ] **Replay partite**: rivedere partite passate
- [ ] **Statistiche**: vincite per giocatore, numeri più estratti
- [ ] **Tema personalizzabile**: switch dark/light mode
- [ ] **Audio**: suoni per estrazioni e vincite
- [ ] **Multiplayer lobbies**: multiple sessioni contemporanee gestite
- [ ] **OCR cartelle**: carica cartella da foto (sperimentale)

---

## 👨‍💻 Credits & Contatti

**Ideato e realizzato da**: Vincenzo Di Franco

📧 Email: [vincenzo.difranco@gmail.com](mailto:vincenzo.difranco@gmail.com)  
💼 LinkedIn: [Vincenzo Di Franco](https://www.linkedin.com/in/vincenzo-di-franco-38216645/)  
☕ PayPal: [Regalami un caffè](https://www.paypal.com/paypalme/vincenzodifranco)

---

## 📄 Licenza

Progetto ricreativo per uso personale e familiare.  
I "Babbi Natali (BN)" sono un'unità ludica senza valore economico reale.

**Disclaimer**: Questo software è fornito "as-is" senza garanzie.  
L'autore non è responsabile per eventuali problemi derivanti dall'uso.

---

## 🎄 Buon Divertimento!

**Tombola Natalizia** - Gioca responsabilmente con amici e famiglia! 🎅✨

---

_Ultimo aggiornamento: 25 Dicembre 2025_
```

***

Vuoi che aggiunga anche:
1. **CHANGELOG.md** con tutte le modifiche per versione?
2. **CONTRIBUTING.md** per eventuali collaboratori?
3. **API.md** con documentazione Socket.IO events?

[1](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/33947840/ce8960b8-7e24-429c-85f5-7738976bbed5/paste.txt)
[2](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/33947840/758c261f-899b-4e1d-b604-489dddd37cbd/paste.txt)
[3](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/33947840/1dd4a3ad-e532-4331-85d1-7f962f445e17/paste.txt)
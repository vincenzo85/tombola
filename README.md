# Tombola Online (Docker)

## Avvio
```bash
docker compose up --build
```

Apri: http://localhost:8080

Da mobile (stessa rete): http://IP_DEL_PC:8080

## Funzionalità principali

1. **Tomboliere** crea una sessione e condivide il codice
2. I **giocatori** entrano con codice + nickname
3. Inserimento cartelle manuale (3 righe x 5 numeri)
4. Spunta automatica e notifiche vincite realtime

## Punti BN (Babbi Natali)
L'app mostra e calcola in "Babbi Natali (BN)" - punti fittizi, **NON denaro**.  
Eventuali accordi tra amici avvengono **fuori dall'app**.

## Funzionalità avanzate
- **Blocco Cartelle**: Toggle per abilitare/disabilitare l'aggiunta di nuove cartelle da parte dei giocatori (utile a partita iniziata).
- **Smorfia Napoletana**: Ogni numero estratto mostra la frase tradizionale della tombola (es. 48: "Il morto che parla") con relativa emoji.

### Cartelle casuali
I player possono aggiungere una cartella casuale (15 numeri unici 1-90, 3 righe da 5) con il bottone 🎲.

### Popup notifiche
- **Ogni numero estratto**: popup centrale con animazione
- **Primo ambo/terno/quaterna/cinquina**: popup con fuochi d'artificio
- **Ogni tombola**: popup celebrativo
- **Disabilita/Abilita popup**: toggle per spegnere i popup se desiderato

### Strumenti tomboliere
- **Copia numeri estratti**: per condividere facilmente la sequenza
- **Importazione estratti**: incolla lista di numeri già estratti (con conferma)
- **Messaggi ai giocatori**: invia comunicazioni testuali ai singoli partecipanti
- **Slider BN**: definisci i BN per cartella (0-10, step 0.5)
- **Ripartizione premi**: slider per distribuzione percentuale (somma sempre 100%)

### Aggiornamenti in tempo reale
- Numeri estratti visibili immediatamente a tutti i giocatori
- Tabellone e cartelle si aggiornano automaticamente
- Vincite riconosciute e notificate istantaneamente

## Credits
Ideato e realizzato da **Vincenzo Di Franco**  
vincenzo.difranco@gmail.com  
https://www.linkedin.com/in/vincenzo-di-franco-38216645/

---

**Nota**: Questo gioco è puramente ricreativo. I "Babbi Natali (BN)" sono un'unità ludica per conti tra amici/famiglia, senza valore economico.
Perfetto! Ecco un **riepilogo completo** di tutto il progetto Tombola, aggiornato con tutte le modifiche implementate.

---

## 📦 **ELENCO COMPLETO DEL PROGETTO TOMBOLA**

### **🧩 File Principali dell'Applicazione**

#### **Frontend (React - `app/client/`)**:
- **`src/App.jsx`** - Componente principale con gestione route, socket, popup numero/vincite, toggle popup globale
- **`src/pages/Home.jsx`** - Pagina iniziale con scelta ruolo + sezione credits (email, LinkedIn, PayPal)
- **`src/pages/Host.jsx`** - Pannello Tomboliere: creazione sessione, estrazione numeri, gestione giocatori, importazione estratti con conferma, invio messaggi, slider BN
- **`src/pages/Player.jsx`** - Pannello Giocatore: inserimento cartelle, tabellone, toggle popup, copia numeri
- **`src/pages/Join.jsx`** - Pagina join con scanner QR code
- **`src/components/`** - Componenti riutilizzabili (Board, CartellaView, LastNumbers, CardInput)
- **`src/api.js`** - Configurazione Socket.IO client
- **`src/styles.css`** - Stili completi con tema natalizio, animazioni fuochi d'artificio, popup
- **`vite.config.js`** - Configurazione build

#### **Backend (Node.js - `app/server/`)**:
- **`index.js`** - Server principale Express + Socket.IO, gestione sessioni, eventi realtime, messaggi host→player
- **`game.js`** - Logica di gioco: estrazione numeri, rilevamento vincite (ambo, terno, quaterna, cinquina, tombola), validazione cartelle, generazione casuale
- **`package.json`** - Dipendenze (express, socket.io, qrcode)

#### **Infrastruttura & Deployment**:
- **`docker-compose.yml`** - Servizi: tombola (app), nginx (proxy TLS), certbot (SSL automatico)
- **`nginx/conf.d/tombola.conf`** - Configurazione nginx con proxy WebSocket
- **`scripts/init-letsencrypt.sh`** - Script inizializzazione certificati SSL
- **`bundle_project.sh`** - Script per creare bundle sorgenti
- **`README.md`** - Documentazione aggiornata con tutte le funzionalità

---

## ✅ **FUNZIONALITÀ COMPLETE IMPLEMENTATE**

### **1. Core Gameplay**
- ✅ Creazione sessione con codice 6 caratteri
- ✅ Join giocatori via codice/nickname
- ✅ Inserimento cartelle manuale (3×5 numeri)
- ✅ Cartelle casuali automatiche (🎲)
- ✅ Estrazione numeri realtime
- ✅ Rilevamento automatico vincite: ambo, terno, quaterna, cinquina, tombola
- ✅ Tabellone 1-90 con numeri estratti evidenziati

### **2. Notifiche & UI Avanzate**
- ✅ **Popup numeri estratti** (ogni estrazione, 3 secondi)
- ✅ **Popup vincite speciali**: solo primo ambo/terno/quaterna/cinquina + tutte le tombola
- ✅ **Toggle globale popup** (🔔/🔕) salvato in localStorage
- ✅ **Toast** per tutte le vincite
- ✅ **Fuochi d'artificio** animati per vincite importanti
- ✅ **Tema natalizio** completo con decorazioni

### **3. Strumenti Tomboliere**
- ✅ **Slider BN** (0-10, step 0.5) per definire punti/cartella
- ✅ **Slider ripartizione premi** (somma sempre 100%)
- ✅ **Importazione estratti** con popup conferma e avviso perdita dati
- ✅ **Copia numeri estratti** (formato CSV)
- ✅ **Invio messaggi** a singoli giocatori
- ✅ **QR code** per join rapido
- ✅ **Visualizzazione cartelle** di tutti i giocatori (solo host)

### **4. Gestione Punti (BN - Babbi Natali)**
- ✅ Calcolo automatico montepremi: `cartelle × BN/cartella`
- ✅ Ripartizione premi con algoritmo "Largest Remainder" per valori interi
- ✅ Avvisi chiari: BN sono punti fittizi, non denaro

### **5. Credits & Contatti**
- ✅ **Sezione credits** in Home page
- ✅ **Link email**: `vincenzo.difranco@gmail.com`
- ✅ **Link LinkedIn**: profilo completo
- ✅ **Link PayPal**: "Regalami un caffè" con gradiente blu
- ✅ Messaggio ringraziamento finale

### **6. Deployment Docker**
- ✅ Container app Node.js + React build
- ✅ Nginx con TLS/SSL automatico (Let's Encrypt)
- ✅ Configurazione WebSocket per Socket.IO
- ✅ Certificati autorenew ogni 12 ore

---

## 🚀 **ISTRUZIONI AVVIO**

```bash
# 1. Clona/estrai il progetto
# 2. Genera certificati SSL (prima volta)
./scripts/init-letsencrypt.sh

# 3. Avvia tutti i servizi
docker compose up --build

# 4. Accedi a:
#    https://tombola.freeinfo.it (produzione)
#    http://localhost:8080       (sviluppo)
```

### **📱 Test Funzionalità Chiave**

1. **Creazione sessione** → `/host`
2. **Join giocatore** → `/join` (scansiona QR o inserisci codice)
3. **Popup test** → Estrai numero → Verifica popup
4. **Toggle popup** → Clicca 🔔/🔕 in header
5. **Importazione** → Host: incolla "5 12 33 45 90" → Conferma
6. **Messaggi** → Host: seleziona giocatore → "Test ripartire"
7. **Credits** → Home page → Verifica link funzionanti

---

## 🎯 **Architettura Tecnica**

```
┌─────────────────────────────────────────────┐
│              Browser (Client)               │
│  React + Vite + Socket.IO-client            │
└─────────────────┬───────────────────────────┘
                  │ HTTPS/WSS
┌─────────────────▼───────────────────────────┐
│              Nginx (Proxy)                  │
│  TLS termination + WebSocket proxy          │
└─────────────────┬───────────────────────────┘
                  │ HTTP/WS (internal)
┌─────────────────▼───────────────────────────┐
│        Node.js Server (Express)             │
│  Session management + Game logic + QR gen   │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│          Redis/Session Storage              │
│  (In-memory nel codice attuale)             │
└─────────────────────────────────────────────┘
```

---

## 📝 **Note Finali**

Il progetto è **completo e pronto per produzione** con:

1. **🔒 Sicurezza**: TLS/SSL, validazione input, sanitizzazione dati
2. **📱 Responsive**: Adatta a mobile/desktop
3. **⚡ Performance**: Build Vite ottimizzata, WebSocket per aggiornamenti realtime
4. **🎨 UX/UI**: Tema coerente, feedback visivi chiari, animazioni non intrusive
5. **🛠️ Manutenibilità**: Codice modulare, struttura chiara, documentazione

**Crediti finali**: Ideato e realizzato da **Vincenzo Di Franco**  
📧 vincenzo.difranco@gmail.com | 💼 LinkedIn | ☕ PayPal

**Buon divertimento con la Tombola Natalizia!** 🎄✨
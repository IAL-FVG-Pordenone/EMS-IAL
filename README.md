# EMS-IAL - Energy Monitor System

Monitoraggio intelligente del consumo energetico negli ambienti scolastici.

Il progetto integra automazione industriale e sviluppo software per acquisire, storicizzare e visualizzare i consumi dei laboratori, con gestione allarmi e supporto operativo al distacco controllato dei carichi.

Repository ufficiale:
https://github.com/IAL-FVG-Pordenone/EMS-IAL

## Obiettivi

- Rilevare picchi di consumo in tempo quasi reale.
- Individuare anomalie di misura e possibili malfunzionamenti.
- Fornire uno strumento operativo per la gestione allarmi.
- Supportare, con autorizzazione, il distacco controllato dei carichi.
- Costruire una piattaforma didattica replicabile in altri istituti.

## Architettura

Il sistema e organizzato in 4 livelli:

1. Campo/impianto
   - PLC Siemens S7-1200
   - Sonde di corrente connesse via Modbus RS485
2. Acquisizione
   - Servizio C# (.NET) con lettura dati PLC
3. Persistenza
   - Database relazionale (SQL Express / SQLite, in base al contesto)
4. Visualizzazione e controllo
   - Dashboard desktop con Electron + Node.js (HTML/CSS/JavaScript)

## Funzionalita principali

- Acquisizione periodica dei consumi per laboratorio.
- Storicizzazione su database.
- Dashboard con aggiornamento ogni 5 secondi.
- Vista storico con finestre temporali predefinite:
  - Ore: ultime 12 ore
  - Giorni: ultimi 10 giorni
  - Mesi: ultimi 8 mesi
  - 3 mesi: ultimi 90 giorni
  - Anni: ultimi 6 anni
- Storico consumi per laboratorio con limite massimo 90 giorni.
- Storico eventi dashboard:
  - ultimi 40 eventi da DB
  - buffer locale limitato agli ultimi 80 eventi
- Gestione allarmi critici (es. picco potenza, anomalia misura, malfunzionamento sonda).
- Controllo distacco con doppia conferma, password e motivazione.

## Stack tecnologico

- PLC Siemens S7-1200 (TIA Portal, Ladder)
- C# / .NET
- T-SQL
- JavaScript, HTML, CSS
- Electron + Node.js

## Struttura repository

- ConsoleDbPlc/
  - Program.cs
  - ConsoleDbPlc.csproj
  - ConsoleDbPlc.slnx
- electron-fiddle-dashboard/
  - index.html
  - main.js
  - renderer.js
  - preload.js
  - styles.css
  - db.js
  - db.config.example.json
  - Creazione_DB_EMS.sql
  - package.json
  - package-lock.json
  - README.md
- LICENSE
- .gitignore
- .gitattributes

## Prerequisiti

- Windows 10/11 (consigliato per ambiente laboratorio)
- .NET SDK (versione compatibile con il progetto C#)
- SQL Server Express oppure SQLite
- Node.js LTS
- Electron Fiddle (se si usa il flusso Fiddle) oppure Electron CLI
- Accesso di rete al PLC
- Porta seriale/convertitore per Modbus RS485 (in base al setup)

## Setup rapido

### 1) Clonazione repository

```bash
git clone https://github.com/IAL-FVG-Pordenone/EMS-IAL.git
cd EMS-IAL
```

### 2) Database

- Creare il database usando lo script:
  - electron-fiddle-dashboard/Creazione_DB_EMS.sql
- Verificare tabelle principali:
  - Laboratories
  - EnergyMeasurements
  - SystemAlarms
  - DisconnectLog
  - Users

### 3) Configurazione dashboard

- Copiare il file di esempio:
  - electron-fiddle-dashboard/db.config.example.json
- Creare un file di configurazione reale (ad esempio db.config.json) con i parametri DB del proprio ambiente.

Esempio minimo:

```json
{
  "server": "localhost",
  "database": "EMS",
  "user": "sa",
  "password": "<password>",
  "options": {
    "encrypt": false,
    "trustServerCertificate": true
  }
}
```

### 4) Avvio componente C#

```bash
cd ConsoleDbPlc
dotnet restore
dotnet run
```

### 5) Avvio dashboard

Opzione A (Electron Fiddle):
- Aprire la cartella electron-fiddle-dashboard in Electron Fiddle.
- Aggiungere la dipendenza mssql@10.0.4 (compatibilita Node di Fiddle).
- Eseguire il progetto.

Opzione B (ambiente Node/Electron classico):

```bash
cd electron-fiddle-dashboard
npm install
npm start
```

Se il progetto non espone lo script start, eseguire tramite Electron Fiddle (Opzione A).

## Sicurezza e operativita

- L'azione di distacco carichi deve essere riservata ad operatori autorizzati.
- Usare password robuste e non committare credenziali reali nel repository.
- Limitare i privilegi del DB agli utenti applicativi necessari.
- Tracciare tutte le azioni critiche con log e timestamp.

## Asset e documentazione

- Relazione tecnica completa: relazione_ecosense_lab.pdf
- Sorgente relazione LaTeX: relazione_ecosense_lab.tex
- Immagini principali:
  - images/schema a blocchi.png
  - images/dashboard.png
  - images/Jody-Miriana.jpeg

## Team e contesto

Progetto sviluppato presso IAL FVG - Pordenone, classe 4 IoT:

- Thomas Bravin
- Miriana De Renzi
- Jody Stabarin

Referente didattico:
- Prof. Mauro Bortolani

Concorso:
- AICA - Progetti Digitali IeFP

## Roadmap sintetica

- Hardening comunicazione PLC e gestione retry avanzata
- Miglioramento diagnostica allarmi
- Estensione reportistica energetica
- Possibile integrazione MQTT in evoluzioni future

## Licenza

Questo repository e distribuito con licenza MIT.
Vedi file LICENSE.

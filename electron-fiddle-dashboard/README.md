# EMS Dashboard per Electron Fiddle

## Dipendenza database consigliata in Electron Fiddle

Per compatibilita' con piu' versioni di Electron Fiddle, usa **mssql@10.0.4** invece di mssql 11.x.

Motivo pratico: `mssql` 11.x richiede Node >= 18, mentre varie versioni di Electron usate in Fiddle includono Node 16.x.

## In Electron Fiddle

1. Apri il pannello **Packages**
2. Aggiungi **mssql@10.0.4**
3. Esegui il progetto

## Se il package resta in caricamento

- verifica di aver scritto `mssql@10.0.4`
- evita `mssql` senza versione
- aspetta il completamento del download iniziale
- se usi una versione di Electron molto vecchia, passa almeno a Electron 18+

## Database

La configurazione del DB si fa dalla pagina **Impostazioni** dell'app.

# MssqlCrudConsole

Console application C# pronta per connettersi a un database MSSQL remoto e testare connessione + CRUD.

## Requisiti

- .NET SDK installato
- Accesso a SQL Server remoto (porta 1433 o quella configurata)

## Configurazione

Imposta la connection string in uno di questi modi:

1. Variabile ambiente (consigliato):

PowerShell:

```powershell
$env:MSSQL_CONNECTION_STRING = "Server=YOUR_SERVER,1433;Database=YOUR_DATABASE;User Id=YOUR_USER;Password=YOUR_PASSWORD;Encrypt=True;TrustServerCertificate=True;"
```

2. File `appsettings.json`:

```json
{
  "ConnectionStrings": {
    "SqlServer": "Server=YOUR_SERVER,1433;Database=YOUR_DATABASE;User Id=YOUR_USER;Password=YOUR_PASSWORD;Encrypt=True;TrustServerCertificate=True;"
  }
}
```

## Esecuzione

```powershell
dotnet run
```

## Cosa testa l'app

- Apertura connessione SQL
- Lettura info server e database corrente
- Creazione tabella `dbo.CopilotProducts` se non esiste
- Create: inserisce un record
- Read: legge il record appena inserito
- Update: aggiorna il record
- Read All: conta le righe correnti
- Delete: elimina il record di test
- Verifica finale della delete

## Note

- Il codice usa query parametrizzate per ridurre il rischio di SQL injection.
- La tabella di test viene mantenuta nel database; viene cancellato solo il record creato dal test corrente.

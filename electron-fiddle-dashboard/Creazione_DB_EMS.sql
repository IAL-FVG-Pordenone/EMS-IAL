-- 1. Creazione del Database
CREATE DATABASE [EMS-IAL];
GO

USE [EMS-IAL];
GO

-- 2. Creazione Tabella Users (necessaria prima di DisconnectLog per la Foreign Key)
CREATE TABLE Users (
    idUtente INT IDENTITY(1,1) PRIMARY KEY,
    nome NVARCHAR(50) NOT NULL,
    cognome NVARCHAR(50) NOT NULL,
    [user] NVARCHAR(50) NOT NULL UNIQUE,
    password NVARCHAR(100) NOT NULL,
    autorizzato CHAR(1) CHECK (autorizzato IN ('S', 'N'))
);

-- 3. Creazione Tabella Laboratories
CREATE TABLE Laboratories (
    idLaboratorio INT IDENTITY(1,1) PRIMARY KEY,
    nome NVARCHAR(100) NOT NULL,
    descrizione NVARCHAR(MAX),
    zonascolastica NVARCHAR(100),
    coordGPS NVARCHAR(50),
    attivo CHAR(1) CHECK (attivo IN ('S', 'N')) 
);

-- 4. Creazione Tabella EnergyMeasurements
CREATE TABLE EnergyMeasurements (
    idMisura INT IDENTITY(1,1) PRIMARY KEY,
    idLaboratorio INT NOT NULL,
    potenzaAssorbitakW DECIMAL(10, 3) NOT NULL,
    [timestamp] DATETIME DEFAULT GETDATE(),
    CONSTRAINT FK_Measurements_Lab FOREIGN KEY (idLaboratorio) 
        REFERENCES Laboratories(idLaboratorio)
);

-- 5. Creazione Tabella SystemAlarms
CREATE TABLE SystemAlarms (
    idAllarme INT IDENTITY(1,1) PRIMARY KEY,
    tipo NVARCHAR(50),
    idLaboratorio INT NOT NULL,
    valoremisurato DECIMAL(10, 3),
    soglia DECIMAL(10, 3),
    dataevento DATETIME DEFAULT GETDATE(),
    CONSTRAINT FK_Alarms_Lab FOREIGN KEY (idLaboratorio) 
        REFERENCES Laboratories(idLaboratorio)
);

-- 6. Creazione Tabella DisconnectLog
CREATE TABLE DisconnectLog (
    idLog INT IDENTITY(1,1) PRIMARY KEY,
    data DATETIME DEFAULT GETDATE(),
    motivo NVARCHAR(255),
    idUtente INT NOT NULL,
    CONSTRAINT FK_Log_User FOREIGN KEY (idUtente) 
        REFERENCES Users(idUtente)
);
GO

-- 7. Inserimento Utenti autorizzati
INSERT INTO Users (nome, cognome, [user], password, autorizzato)
VALUES 
('Mario', 'Bortolani', 'bortolanim', 'Pass-2026', 'S'),
('Fabio', 'Francescato', 'francescatof', 'Pass-2026', 'S'),
('Miriana', 'De Renzi', 'derenzim', 'Pass-2026', 'S'),
('Jody', 'Stabarin', 'stabarins', 'Pass-2026', 'S');
GO

-- 8. Inserimento dei Laboratori
INSERT INTO Laboratories (nome, descrizione, zonascolastica, coordGPS, attivo)
VALUES 
('Lab1', 'Elettronica', 'Viale Grigoletti', NULL, 'S'),
('Lab2', 'Robotica', 'Viale Grigoletti', NULL, 'S'),
('Lab3', 'Prototipazione', 'Polo Tecnologico', NULL, 'S'),
('Lab4', 'Informatica', 'Polo Tecnologico', NULL, 'S');
GO


-- Verifica inserimento
SELECT * FROM Users;
SELECT * FROM Laboratories;
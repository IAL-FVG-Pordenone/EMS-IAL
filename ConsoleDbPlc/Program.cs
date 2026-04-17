using S7.Net;
using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Data.SqlClient;

namespace ConsoleDbPlc
{
    internal class Program
    {
        private static Plc _plcClient;

        private const string PLCAddress = "";
        private const short Rack = 0;
        private const short Slot = 1;

        private const string ConnectionString =
            "";

        static async Task Main(string[] args)
        {
            Console.WriteLine("Avvio applicazione...");

            bool dbOk = await VerifyDatabaseConnectionAsync();
            if (!dbOk)
            {
                Console.WriteLine("Impossibile proseguire: database non raggiungibile.");
                return;
            }

            var energyData = await ReadEnergyDataAsync();

            if (energyData.Count == 0)
            {
                Console.WriteLine("Nessun dato letto dal PLC.");
                return;
            }

            foreach (var item in energyData)
            {
                Console.WriteLine($"{item.Name}: {item.PowerKW:F3} kW - {item.Timestamp:yyyy-MM-dd HH:mm:ss}");
            }

            bool saveOk = await SaveEnergyDataToDatabaseAsync(energyData);
            Console.WriteLine(saveOk
                ? "Operazione completata con successo."
                : "Operazione completata con errori durante il salvataggio.");
        }

        public static async Task<bool> VerifyDatabaseConnectionAsync()
        {
            try
            {
                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
                using var connection = new SqlConnection(ConnectionString);

                await connection.OpenAsync(cts.Token);

                const string healthQuery = "SELECT 1;";
                using var cmd = new SqlCommand(healthQuery, connection);

                object? result = await cmd.ExecuteScalarAsync(cts.Token);

                if (result != null && Convert.ToInt32(result) == 1)
                {
                    Console.WriteLine("Connessione al database verificata con successo.");
                    return true;
                }

                Console.WriteLine("Database raggiunto, ma verifica health-check fallita.");
                return false;
            }
            catch (SqlException ex)
            {
                Console.WriteLine($"Errore SQL durante la verifica del database: {ex.Message}");
                return false;
            }
            catch (OperationCanceledException)
            {
                Console.WriteLine("Timeout durante la verifica della connessione al database.");
                return false;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Errore generico durante la verifica del database: {ex.Message}");
                return false;
            }
        }

        public static async Task<List<LaboratoryEnergyPoint>> ReadEnergyDataAsync()
        {
            var result = new List<LaboratoryEnergyPoint>();

            try
            {
                _plcClient = new Plc(CpuType.S71200, PLCAddress, Rack, Slot);

                if (_plcClient.IsConnected)
                {
                    Console.WriteLine("Il PLC risulta già connesso.");
                }
                else
                {
                    Console.WriteLine($"Tentativo di connessione al PLC {PLCAddress}...");
                    await Task.Run(() => _plcClient.Open());
                }

                if (!_plcClient.IsConnected)
                {
                    Console.WriteLine("Connessione al PLC fallita: il client non risulta connesso dopo Open().");
                    return result;
                }

                Console.WriteLine("Connessione al PLC avvenuta con successo.");

                var data = new EnergyDatablock();

                try
                {
                    _plcClient.ReadClass(data, 100);
                    Console.WriteLine("Lettura dati dal PLC completata con successo.");
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Connessione PLC presente, ma lettura DB100 fallita: {ex.Message}");
                    return result;
                }

                var timestamp = DateTime.Now;

                result.Add(new LaboratoryEnergyPoint("Lab1", Convert.ToDecimal(data.Lab1PowerKW), timestamp));
                result.Add(new LaboratoryEnergyPoint("Lab2", Convert.ToDecimal(data.Lab2PowerKW), timestamp));
                result.Add(new LaboratoryEnergyPoint("Lab3", Convert.ToDecimal(data.Lab3PowerKW), timestamp));
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Errore durante la connessione al PLC: {ex.Message}");
            }
            finally
            {
                if (_plcClient != null)
                {
                    try
                    {
                        if (_plcClient.IsConnected)
                        {
                            await Task.Run(() => _plcClient.Close());
                            Console.WriteLine("Connessione al PLC chiusa.");
                        }
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"Errore durante la chiusura della connessione PLC: {ex.Message}");
                    }
                }
            }

            return result;
        }

        public static async Task<bool> SaveEnergyDataToDatabaseAsync(List<LaboratoryEnergyPoint> energyData)
        {
            try
            {
                using var connection = new SqlConnection(ConnectionString);
                await connection.OpenAsync();

                Console.WriteLine("Connessione al database aperta per il salvataggio.");

                foreach (var point in energyData)
                {
                    int? idLaboratorio = await GetLaboratoryIdByNameAsync(connection, point.Name);

                    if (!idLaboratorio.HasValue)
                    {
                        Console.WriteLine($"Laboratorio '{point.Name}' non trovato nel database. Inserimento saltato.");
                        continue;
                    }

                    const string insertQuery = @"
                        INSERT INTO EnergyMeasurements (idLaboratorio, potenzaAssorbitakW, [timestamp])
                        VALUES (@idLaboratorio, @potenza, @timestamp);";

                    using var cmd = new SqlCommand(insertQuery, connection);
                    cmd.Parameters.AddWithValue("@idLaboratorio", idLaboratorio.Value);
                    cmd.Parameters.AddWithValue("@potenza", point.PowerKW);
                    cmd.Parameters.AddWithValue("@timestamp", point.Timestamp);

                    int rows = await cmd.ExecuteNonQueryAsync();

                    if (rows == 1)
                    {
                        Console.WriteLine($"Misura salvata correttamente: {point.Name} - {point.PowerKW:F3} kW");
                    }
                    else
                    {
                        Console.WriteLine($"Salvataggio anomalo per {point.Name}: righe inserite = {rows}");
                    }
                }

                return true;
            }
            catch (SqlException ex)
            {
                Console.WriteLine($"Errore SQL durante il salvataggio: {ex.Message}");
                return false;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Errore generico durante il salvataggio: {ex.Message}");
                return false;
            }
        }

        private static async Task<int?> GetLaboratoryIdByNameAsync(SqlConnection connection, string laboratoryName)
        {
            const string query = @"
                SELECT idLaboratorio
                FROM Laboratories
                WHERE nome = @nome AND attivo = 'S';";

            using var cmd = new SqlCommand(query, connection);
            cmd.Parameters.AddWithValue("@nome", laboratoryName);

            object? result = await cmd.ExecuteScalarAsync();

            if (result == null || result == DBNull.Value)
                return null;

            return Convert.ToInt32(result);
        }
    }

    public class EnergyDatablock
    {
        public float Lab1PowerKW { get; set; }
        public float Lab2PowerKW { get; set; }
        public float Lab3PowerKW { get; set; }
    }

    public class LaboratoryEnergyPoint
    {
        public string Name { get; }
        public decimal PowerKW { get; }
        public DateTime Timestamp { get; }

        public LaboratoryEnergyPoint(string name, decimal powerKW, DateTime timestamp)
        {
            Name = name;
            PowerKW = powerKW;
            Timestamp = timestamp;
        }
    }
}
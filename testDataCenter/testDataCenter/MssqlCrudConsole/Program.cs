using System.Text.Json;
using Microsoft.Data.SqlClient;

Console.WriteLine("MSSQL Remote Connection + CRUD Test");
Console.WriteLine("---------------------------------");

try
{
	var connectionString = LoadConnectionString();
	await using var connection = new SqlConnection(connectionString);

	Console.WriteLine("Opening SQL connection...");
	await connection.OpenAsync();
	Console.WriteLine("Connection opened successfully.");

	await PrintServerInfoAsync(connection);
	await EnsureTableAsync(connection);

	var insertedId = await CreateAsync(connection, "Copilot Demo Product", 99.90m);
	var productAfterInsert = await ReadAsync(connection, insertedId);
	PrintProduct("Read after insert", productAfterInsert);

	await UpdateAsync(connection, insertedId, "Copilot Updated Product", 149.50m);
	var productAfterUpdate = await ReadAsync(connection, insertedId);
	PrintProduct("Read after update", productAfterUpdate);

	var allProducts = await ReadAllAsync(connection);
	Console.WriteLine($"Rows currently in dbo.CopilotProducts: {allProducts.Count}");

	await DeleteAsync(connection, insertedId);
	var productAfterDelete = await ReadAsync(connection, insertedId);
	Console.WriteLine(productAfterDelete is null
		? "Delete check passed: row no longer exists."
		: "Delete check failed: row still exists.");

	Console.WriteLine("CRUD test completed successfully.");
}
catch (SqlException ex)
{
	Console.ForegroundColor = ConsoleColor.Red;
	Console.WriteLine("SQL error while connecting/executing commands:");
	Console.WriteLine($"{ex.Number}: {ex.Message}");
	Console.ResetColor();
	Environment.ExitCode = 1;
}
catch (Exception ex)
{
	Console.ForegroundColor = ConsoleColor.Red;
	Console.WriteLine($"Unexpected error: {ex.Message}");
	Console.ResetColor();
	Environment.ExitCode = 1;
}

static string LoadConnectionString()
{
	var fromEnv = Environment.GetEnvironmentVariable("MSSQL_CONNECTION_STRING");
	if (!string.IsNullOrWhiteSpace(fromEnv))
	{
		return fromEnv;
	}

	const string settingsFile = "appsettings.json";
	if (!File.Exists(settingsFile))
	{
		throw new InvalidOperationException(
			"Connection string not found. Set MSSQL_CONNECTION_STRING or create appsettings.json.");
	}

	var json = File.ReadAllText(settingsFile);
	using var doc = JsonDocument.Parse(json);

	if (doc.RootElement.TryGetProperty("ConnectionStrings", out var connStrings)
		&& connStrings.TryGetProperty("SqlServer", out var sqlServer)
		&& !string.IsNullOrWhiteSpace(sqlServer.GetString()))
	{
		return sqlServer.GetString()!;
	}

	throw new InvalidOperationException(
		"Connection string missing. Configure ConnectionStrings:SqlServer in appsettings.json.");
}

static async Task PrintServerInfoAsync(SqlConnection connection)
{
	const string sql = "SELECT @@SERVERNAME AS ServerName, DB_NAME() AS DatabaseName";
	await using var command = new SqlCommand(sql, connection);
	await using var reader = await command.ExecuteReaderAsync();

	if (await reader.ReadAsync())
	{
		var server = reader.GetString(reader.GetOrdinal("ServerName"));
		var database = reader.GetString(reader.GetOrdinal("DatabaseName"));
		Console.WriteLine($"Connected to server: {server}");
		Console.WriteLine($"Current database: {database}");
	}
}

static async Task EnsureTableAsync(SqlConnection connection)
{
	const string sql = """
		IF OBJECT_ID('dbo.CopilotProducts', 'U') IS NULL
		BEGIN
			CREATE TABLE dbo.CopilotProducts
			(
				Id INT IDENTITY(1,1) PRIMARY KEY,
				Name NVARCHAR(200) NOT NULL,
				Price DECIMAL(18,2) NOT NULL,
				CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
			);
		END
		""";

	await using var command = new SqlCommand(sql, connection);
	await command.ExecuteNonQueryAsync();
	Console.WriteLine("Ensured table dbo.CopilotProducts exists.");
}

static async Task<int> CreateAsync(SqlConnection connection, string name, decimal price)
{
	const string sql = """
		INSERT INTO dbo.CopilotProducts (Name, Price)
		OUTPUT INSERTED.Id
		VALUES (@name, @price);
		""";

	await using var command = new SqlCommand(sql, connection);
	command.Parameters.AddWithValue("@name", name);
	command.Parameters.AddWithValue("@price", price);

	var scalar = await command.ExecuteScalarAsync();
	if (scalar is null || scalar == DBNull.Value)
	{
		throw new InvalidOperationException("Insert failed: no ID was returned by SQL Server.");
	}

	var id = Convert.ToInt32(scalar);
	Console.WriteLine($"Create OK - new Id: {id}");
	return id;
}

static async Task<Product?> ReadAsync(SqlConnection connection, int id)
{
	const string sql = """
		SELECT Id, Name, Price, CreatedAt
		FROM dbo.CopilotProducts
		WHERE Id = @id;
		""";

	await using var command = new SqlCommand(sql, connection);
	command.Parameters.AddWithValue("@id", id);
	await using var reader = await command.ExecuteReaderAsync();

	if (!await reader.ReadAsync())
	{
		return null;
	}

	return new Product(
		reader.GetInt32(reader.GetOrdinal("Id")),
		reader.GetString(reader.GetOrdinal("Name")),
		reader.GetDecimal(reader.GetOrdinal("Price")),
		reader.GetDateTime(reader.GetOrdinal("CreatedAt")));
}

static async Task<List<Product>> ReadAllAsync(SqlConnection connection)
{
	const string sql = """
		SELECT Id, Name, Price, CreatedAt
		FROM dbo.CopilotProducts
		ORDER BY Id;
		""";

	var rows = new List<Product>();
	await using var command = new SqlCommand(sql, connection);
	await using var reader = await command.ExecuteReaderAsync();

	while (await reader.ReadAsync())
	{
		rows.Add(new Product(
			reader.GetInt32(reader.GetOrdinal("Id")),
			reader.GetString(reader.GetOrdinal("Name")),
			reader.GetDecimal(reader.GetOrdinal("Price")),
			reader.GetDateTime(reader.GetOrdinal("CreatedAt"))));
	}

	return rows;
}

static async Task UpdateAsync(SqlConnection connection, int id, string newName, decimal newPrice)
{
	const string sql = """
		UPDATE dbo.CopilotProducts
		SET Name = @name, Price = @price
		WHERE Id = @id;
		""";

	await using var command = new SqlCommand(sql, connection);
	command.Parameters.AddWithValue("@id", id);
	command.Parameters.AddWithValue("@name", newName);
	command.Parameters.AddWithValue("@price", newPrice);

	var affected = await command.ExecuteNonQueryAsync();
	Console.WriteLine($"Update affected rows: {affected}");
}

static async Task DeleteAsync(SqlConnection connection, int id)
{
	const string sql = "DELETE FROM dbo.CopilotProducts WHERE Id = @id;";
	await using var command = new SqlCommand(sql, connection);
	command.Parameters.AddWithValue("@id", id);
	var affected = await command.ExecuteNonQueryAsync();
	Console.WriteLine($"Delete affected rows: {affected}");
}

static void PrintProduct(string label, Product? product)
{
	if (product is null)
	{
		Console.WriteLine($"{label}: not found");
		return;
	}

	Console.WriteLine(
		$"{label}: Id={product.Id}, Name={product.Name}, Price={product.Price}, CreatedAt={product.CreatedAt:O}");
}

internal sealed record Product(int Id, string Name, decimal Price, DateTime CreatedAt);

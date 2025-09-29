# .NET Migrations Always Using Development Settings

This project is configured to ensure that Entity Framework migrations always use `appsettings.Development.json` settings.

## Configuration Methods

### Method 1: Environment Variable (Recommended)
The `Program.cs` file sets the environment variable to force Development mode:
```csharp
Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", "Development");
```

### Method 2: DesignTimeDbContextFactory
The `Migrations/DesignTimeDbContextFactory.cs` file ensures that design-time operations (like creating migrations) always use Development settings.

### Method 3: Scripts
Use the provided scripts in the `scripts/` folder:

#### Linux/Mac:
```bash
# Add a new migration
./scripts/add-migration-dev.sh InitialCreate

# Apply migrations
./scripts/migrate-dev.sh
```

#### Windows:
```cmd
# Add a new migration
scripts\add-migration-dev.bat InitialCreate

# Apply migrations
scripts\migrate-dev.bat
```

## Manual Commands

If you prefer to run commands manually, always set the environment variable first:

### Linux/Mac:
```bash
export ASPNETCORE_ENVIRONMENT=Development
dotnet ef migrations add InitialCreate
dotnet ef database update
```

### Windows:
```cmd
set ASPNETCORE_ENVIRONMENT=Development
dotnet ef migrations add InitialCreate
dotnet ef database update
```

## Verification

To verify that migrations are using Development settings, check the connection string in your `appsettings.Development.json` file. The database name should reflect your Development configuration.

## Important Notes

1. **Always use Development environment for migrations** - This prevents accidentally running migrations against production databases.
2. **DesignTimeDbContextFactory is crucial** - It ensures that `dotnet ef` commands use the correct configuration.
3. **Environment variables override** - Setting `ASPNETCORE_ENVIRONMENT=Development` ensures the correct appsettings file is loaded.
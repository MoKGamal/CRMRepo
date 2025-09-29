@echo off
REM Script to add new migrations with Development environment
REM This ensures migrations always use appsettings.Development.json

if "%1"=="" (
    echo Usage: %0 ^<migration-name^>
    echo Example: %0 InitialCreate
    exit /b 1
)

echo Setting environment to Development for migration creation...
set ASPNETCORE_ENVIRONMENT=Development

echo Adding new migration: %1
dotnet ef migrations add "%1" --project ..\YourApp.csproj --startup-project ..\YourApp.csproj

echo Migration '%1' created using Development settings.
pause
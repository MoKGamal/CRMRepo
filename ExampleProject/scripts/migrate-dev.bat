@echo off
REM Script to run migrations with Development environment
REM This ensures migrations always use appsettings.Development.json

echo Setting environment to Development for migrations...
set ASPNETCORE_ENVIRONMENT=Development

echo Running Entity Framework migrations...
dotnet ef database update --project ..\YourApp.csproj --startup-project ..\YourApp.csproj

echo Migrations completed using Development settings.
pause
#!/bin/bash

# Script to add new migrations with Development environment
# This ensures migrations always use appsettings.Development.json

if [ -z "$1" ]; then
    echo "Usage: $0 <migration-name>"
    echo "Example: $0 InitialCreate"
    exit 1
fi

echo "Setting environment to Development for migration creation..."
export ASPNETCORE_ENVIRONMENT=Development

echo "Adding new migration: $1"
dotnet ef migrations add "$1" --project ../YourApp.csproj --startup-project ../YourApp.csproj

echo "Migration '$1' created using Development settings."
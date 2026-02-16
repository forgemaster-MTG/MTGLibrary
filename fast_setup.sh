#!/bin/bash

# Fast Setup Script for MTG Library on macOS

set -e # Exit on error

echo "🚀 Starting MTG Library Setup..."

# 1. Check for Homebrew
if ! command -v brew &> /dev/null; then
    echo "❌ Homebrew not found. Please install Homebrew first: https://brew.sh/"
    exit 1
else
    echo "✅ Homebrew found."
fi

# 2. Check for Node.js
if ! command -v node &> /dev/null; then
    echo "📦 Node.js not found. Installing via Homebrew..."
    brew install node
else
    echo "✅ Node.js found: $(node -v)"
fi

# 3. Check for Docker
if ! command -v docker &> /dev/null; then
    echo "🐳 Docker not found. Installing Colima (lightweight Docker alternative)..."
    brew install colima docker docker-compose
    colima start
    # Link docker socket for some tools that expect it
    sudo ln -sf $HOME/.colima/default/docker.sock /var/run/docker.sock
else
    echo "✅ Docker found."
    # Check if docker daemon is running
    if ! docker info &> /dev/null; then
        echo "⚠️ Docker daemon is not running. Attempting to start Colima..."
        if command -v colima &> /dev/null; then
            colima start
        else
            echo "❌ Docker daemon not running and Colima not found. Please start Docker Desktop."
            exit 1
        fi
    fi
fi

# 4. Install Dependencies
echo "📦 Installing npm dependencies..."
npm install

# 5. Start Database
echo "🐘 Starting Postgres via Docker..."
docker-compose up -d postgres

# Wait for Postgres to be ready
echo "⏳ Waiting for Postgres to be ready..."
until docker exec mtg-postgres-prod pg_isready -U postgres; do
  sleep 2
done

# 6. Run Migrations
echo "🔄 Running Database Migrations..."
npm run migrate:latest

echo "✅ Setup Complete!"
echo "👉 Run 'npm run dev' to start the frontend."
echo "👉 Run 'npm run start:server' to start the backend."

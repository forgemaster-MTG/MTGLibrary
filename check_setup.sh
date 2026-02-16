#!/bin/bash

echo "🔍 Starting System Check for MTG Library..."

# 1. Check OS
echo "--------------------------------"
echo "🖥️  OS Check"
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "✅ macOS detected."
else
    echo "⚠️  Warning: Non-macOS detected ($OSTYPE). This guide is optimized for macOS."
fi

# 2. Check Homebrew
echo "--------------------------------"
echo "🍺 Homebrew Check"
if command -v brew &> /dev/null; then
    echo "✅ Homebrew is installed."
else
    echo "❌ Homebrew is NOT installed."
    echo "   👉 Run: /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
fi

# 3. Check Node.js
echo "--------------------------------"
echo "📦 Node.js Check"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo "✅ Node.js is installed ($NODE_VERSION)."
else
    echo "❌ Node.js is NOT installed."
    echo "   👉 Run: brew install node"
fi

# 4. Check NAS Connectivity
echo "--------------------------------"
echo "🌐 NAS Connectivity Check (10.0.0.27:6470)"
if nc -z -G 2 10.0.0.27 6470 &> /dev/null; then
    echo "✅ Successfully connected to Postgres on NAS."
else
    echo "❌ Failed to connect to Postgres on NAS at 10.0.0.27:6470."
    echo "   👉 Check if you are on the correct network/VPN."
    echo "   👉 Check if the NAS IP is reachable (ping 10.0.0.27)."
fi

echo "--------------------------------"
echo "🏁 Check Complete."

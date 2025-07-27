#!/bin/bash
echo "🚀 Starting DocuPrompt Backend..."

# Try to install Python dependencies (but don't fail if it doesn't work)
echo "🐍 Attempting to install Python dependencies..."
pip install -r python-services/requirements.txt --break-system-packages || echo "⚠️ Python dependencies failed, continuing without AI features"

# Try to start Python service (but don't fail if it doesn't work)
echo "🐍 Attempting to start Python AI service..."
cd python-services
python pinecone_daemon.py &
cd ..

# Don't wait for Python - just start Node.js
echo "🟢 Starting Node.js server..."
node server.js
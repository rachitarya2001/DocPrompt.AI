#!/bin/bash
echo "🚀 Starting DocuPrompt Backend..."

# Install Python dependencies
echo "🐍 Installing Python dependencies..."
pip install -r python-services/requirements.txt

# Start Python daemon in background
echo "🐍 Starting Python AI service..."
cd python-services
python pinecone_daemon.py &
cd ..

# Wait for Python service to initialize
echo "⏳ Waiting for Python service to start..."
sleep 10

# Start Node.js server
echo "🟢 Starting Node.js server..."
node server.js
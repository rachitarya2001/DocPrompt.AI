require('dotenv').config();
const express = require('express');
const app = express();

app.use(express.json());
const { spawn } = require('child_process');
const path = require('path');
// Import routes
const apiRoutes = require('./src/routes/api');

// Use routes
app.use('/api', apiRoutes);

// Simple in-memory cache for AI responses
const questionCache = new Map();
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Cache helper functions
function getCacheKey(question, documentId) {
    return `${documentId || 'global'}_${question.toLowerCase().trim()}`;
}

function getCachedAnswer(question, documentId) {
    const key = getCacheKey(question, documentId);
    const cached = questionCache.get(key);

    if (cached && Date.now() - cached.timestamp < CACHE_EXPIRY) {
        console.log('📦 Cache hit for:', question);
        return cached.answer;
    }

    // Remove expired cache entry
    if (cached) {
        questionCache.delete(key);
    }

    return null;
}

function setCachedAnswer(question, documentId, answer) {
    const key = getCacheKey(question, documentId);
    questionCache.set(key, {
        answer: answer,
        timestamp: Date.now()
    });
    console.log('💾 Cached answer for:', question);
}

// Make cache functions available to routes
app.locals.getCachedAnswer = getCachedAnswer;
app.locals.setCachedAnswer = setCachedAnswer;

// Optional: Log cache stats
setInterval(() => {
    console.log(`📊 Cache stats: ${questionCache.size} entries`);
}, 5 * 60 * 1000); // Every 5 minutes
let pythonProcess = null;
let isProcessReady = false;
const pendingRequests = new Map();
let requestId = 0;

// Start persistent Python process
function startPythonProcess() {
    console.log('🚀 Starting persistent Python process...');

    const scriptPath = path.join(__dirname, 'python-services/pinecone_daemon.py');
    pythonProcess = spawn('python', [scriptPath]);

    let buffer = '';

    pythonProcess.stdout.on('data', (data) => {
        buffer += data.toString();




        // Process complete JSON lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        lines.forEach(line => {
            if (line.trim()) {
                try {
                    const response = JSON.parse(line);

                    if (response.status === 'ready') {
                        isProcessReady = true;
                        console.log('✅ Python process ready for requests');
                        return;
                    }

                    if (response.requestId) {
                        const callback = pendingRequests.get(response.requestId);
                        if (callback) {
                            callback(null, response);
                            pendingRequests.delete(response.requestId);
                        }
                    }
                } catch (error) {
                    console.error('JSON parse error:', error);
                }
            }
        });
    });

    pythonProcess.stderr.on('data', (data) => {
        console.error('Python error:', data.toString());
    });

    pythonProcess.on('close', (code) => {
        console.log(`Python process exited: ${code}`);
        isProcessReady = false;
        // Restart if crashed
        setTimeout(startPythonProcess, 2000);
    });
}

// Send request to persistent Python process
function sendToPythonProcess(command, params, callback) {
    if (!isProcessReady) {
        return callback(new Error('Python process not ready'), null);
    }

    const currentRequestId = ++requestId;
    const request = {
        requestId: currentRequestId,
        command: command,
        ...params
    };

    pendingRequests.set(currentRequestId, callback);

    pythonProcess.stdin.write(JSON.stringify(request) + '\n');

    // Timeout after 30 seconds
    setTimeout(() => {
        if (pendingRequests.has(currentRequestId)) {
            pendingRequests.delete(currentRequestId);
            callback(new Error('Request timeout'), null);
        }
    }, 30000);
}

// Start the persistent process
startPythonProcess();

// Make function available to routes
app.locals.sendToPythonProcess = sendToPythonProcess;

// Cleanup on exit
process.on('SIGINT', () => {
    console.log('Shutting down Python process...');
    if (pythonProcess) {
        pythonProcess.kill();
    }
    process.exit();
});


app.listen(process.env.PORT || 3000, () => {
    console.log(`Server running on port ${process.env.PORT || 3000}`);
});
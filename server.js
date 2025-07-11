require('dotenv').config();
const express = require('express');
const app = express();
const connectDB = require('./src/config/database');
const authRoutes = require('./src/routes/auth');

const cors = require('cors');
app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    preflightContinue: false,
    optionsSuccessStatus: 200
}));

app.use(express.json());
app.use('/auth', authRoutes);



const { spawn } = require('child_process');
const path = require('path');
// Import routes
const apiRoutes = require('./src/routes/api');

// Use routes
app.use('/api', apiRoutes);


// Simple in-memory cache for AI responses
const questionCache = new Map();
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const MAX_CACHE_SIZE = 1000;

// Cache helper functions
function getCacheKey(question, documentId) {
    return `${documentId || 'global'}_${question.toLowerCase().trim()}`;
}

function getCachedAnswer(question, documentId) {
    const key = getCacheKey(question, documentId);
    const cached = questionCache.get(key);

    if (cached && Date.now() - cached.timestamp < CACHE_EXPIRY) {
        return cached.answer;
    }

    // Remove expired cache entry
    if (cached) {
        questionCache.delete(key);
    }

    return null;
}

function setCachedAnswer(question, documentId, answer) {
    if (questionCache.size >= MAX_CACHE_SIZE) {
        const oldestKey = questionCache.keys().next().value;
        questionCache.delete(oldestKey);
        console.log('🧹 Cache size limit reached, removed oldest entry');
    }
    const key = getCacheKey(question, documentId);
    questionCache.set(key, {
        answer: answer,
        timestamp: Date.now()
    });
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
let restartCount = 0;                    // ✅ ADD THIS
const MAX_RESTARTS = 5;                  // ✅ ADD THIS  
const RESTART_WINDOW = 60000;

// Start persistent Python process
function startPythonProcess() {

    if (restartCount >= MAX_RESTARTS) {
        console.error('❌ Max restart attempts reached. Manual intervention required.');
        console.error('💡 Try restarting the server manually: npm run dev');
        return;
    }

    restartCount++;  // ✅ ADD THIS
    console.log(`🔄 Starting Python process (attempt ${restartCount})`);

    const scriptPath = path.join(__dirname, 'python-services/pinecone_daemon.py');
    pythonProcess = spawn('python', [scriptPath]);

    let buffer = '';

    pythonProcess.stdout.on('data', (data) => {
        buffer += data.toString();
        if (!isProcessReady && buffer.includes('"status": "ready"')) {
            setTimeout(() => {
                if (isProcessReady) {
                    restartCount = 0;
                    console.log('✅ Python process stable, reset restart counter');
                }
            }, RESTART_WINDOW);
        }
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
    }, 60000);
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


// Connect to database then start server
connectDB().then(() => {
    app.listen(process.env.PORT || 5000, () => {
        console.log(`🚀 DocuPrompt server running on port ${process.env.PORT || 5000}`);
    });
});
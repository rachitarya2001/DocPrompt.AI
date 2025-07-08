const { spawn } = require('child_process');
const path = require('path');
const express = require('express');
const router = express.Router();

const multer = require('multer');

// Configure multer storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        const uniqueName = Date.now() + '-' + file.originalname;
        cb(null, uniqueName);
    }
});

// Create multer upload middleware
const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// GET /api/ - Welcome message
router.get('/', (req, res) => {
    res.json({ message: 'DocuPrompt API is running!', status: 'success' });
});

// GET /api/health - Health check
router.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// POST /api/test - Test JSON handling
router.post('/test', (req, res) => {
    res.json({
        message: 'POST request received!',
        data: req.body,
        method: req.method
    });
});

// File upload route 
router.post('/upload', upload.single('document'), (req, res) => {
    // Check if file was uploaded
    if (!req.file) {
        return res.status(400).json({
            success: false,
            message: 'No file uploaded'
        });
    }

    // Return success response with file info
    res.json({
        success: true,
        message: 'File uploaded successfully!',
        file: {
            originalName: req.file.originalname,
            fileName: req.file.filename,
            size: req.file.size,
            path: req.file.path
        }
    });
});

// POST /api/extract-text - Extract text from uploaded file
router.post('/extract-text', (req, res) => {
    const { filePath } = req.body;

    // Validate input
    if (!filePath) {
        return res.status(400).json({
            success: false,
            message: 'File path is required'
        });
    }

    // Check if file exists
    const fs = require('fs');
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({
            success: false,
            message: 'File not found'
        });
    }

    // Call Python OCR script
    const pythonScript = path.join(__dirname, '../../python-services/ocr_service.py');
    const pythonProcess = spawn('python', [pythonScript, filePath]);

    let outputData = '';
    let errorData = '';

    // Collect output from Python script
    pythonProcess.stdout.on('data', (data) => {
        outputData += data.toString();
    });

    // Collect errors from Python script
    pythonProcess.stderr.on('data', (data) => {
        errorData += data.toString();
    });

    // Handle process completion
    pythonProcess.on('close', (code) => {
        if (code !== 0) {
            return res.status(500).json({
                success: false,
                message: 'OCR processing failed',
                error: errorData
            });
        }

        try {
            // Parse JSON response from Python
            const result = JSON.parse(outputData);
            res.json(result);
        } catch (parseError) {
            res.status(500).json({
                success: false,
                message: 'Failed to parse OCR result',
                error: parseError.message
            });
        }
    });
});

// POST /api/process-document - Store document in vector database
router.post('/process-document', (req, res) => {
    const { filePath, extractedText, documentId } = req.body;

    if (!filePath || !extractedText || !documentId) {
        return res.status(400).json({
            success: false,
            message: 'File path, extracted text, and document ID are required'
        });
    }

    console.log(`📝 Processing document: ${documentId}`);
    const startTime = Date.now();

    // ✅ Use persistent daemon (FAST)
    req.app.locals.sendToPythonProcess('store', {
        file_path: filePath,
        text: extractedText,
        document_id: documentId
    }, (error, result) => {
        const processingTime = Date.now() - startTime;
        console.log(`⚡ Document processed in ${processingTime}ms`);

        if (error) {
            return res.status(500).json({
                success: false,
                message: 'Failed to process document',
                error: error.message
            });
        }

        // Add timing info to response
        result.processing_time_ms = processingTime;
        res.json(result);
    });
});

// POST /api/ask-question - Ask AI questions with caching
router.post('/ask-question', (req, res) => {
    const { question, documentId } = req.body;

    if (!question) {
        return res.status(400).json({
            success: false,
            message: 'Question is required'
        });
    }

    // Check cache first (even faster!)
    const cachedAnswer = req.app.locals.getCachedAnswer(question, documentId);
    if (cachedAnswer) {
        console.log(`📦 Cache hit for: "${question}"`);
        return res.json({
            ...cachedAnswer,
            cached: true,
            response_time_ms: 1 // Cache is instant
        });
    }

    console.log(`❓ Processing question: "${question}"`);
    const startTime = Date.now();

    // ✅ Use persistent daemon (FAST)
    req.app.locals.sendToPythonProcess('query', {
        question: question,
        document_id: documentId || null
    }, (error, result) => {
        const processingTime = Date.now() - startTime;
        console.log(`⚡ Question answered in ${processingTime}ms`);

        if (error) {
            return res.status(500).json({
                success: false,
                message: 'Failed to process question',
                error: error.message
            });
        }

        // Cache successful responses
        if (result.success) {
            req.app.locals.setCachedAnswer(question, documentId, result);
        }

        // Add timing and cache info
        result.cached = false;
        result.response_time_ms = processingTime;
        result.processed_timestamp = new Date().toISOString();

        res.json(result);
    });
});



module.exports = router;
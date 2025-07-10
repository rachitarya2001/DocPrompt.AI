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
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        console.log('🔍 File filter check:', {
            name: file.originalname,
            type: file.mimetype,
            size: file.size
        });

        const allowedTypes = [
            'application/pdf',
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/bmp',
            'image/tiff'
        ];

        if (allowedTypes.includes(file.mimetype)) {
            console.log('✅ File type accepted');
            cb(null, true);
        } else {
            console.log('❌ File type rejected:', file.mimetype);
            cb(new Error(`Invalid file type: ${file.mimetype}`), false);
        }
    }
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
// Add multer error handling
router.use('/upload', (error, req, res, next) => {
    console.log('❌ Multer error:', error);
    if (error instanceof multer.MulterError) {
        return res.status(400).json({
            success: false,
            message: `File upload error: ${error.message}`
        });
    }
    next(error);
});

router.post('/upload', upload.single('document'), (req, res) => {
    console.log('📤 Upload route reached!');

    // Check if file was uploaded
    if (!req.file) {
        return res.status(400).json({
            success: false,
            message: 'No file uploaded'
        });
    }

    console.log('✅ File details:', req.file.originalname);

    // SIMPLE RESPONSE - NO EXTRA VARIABLES
    return res.status(200).json({
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
    const { question, documentId, conversationHistory } = req.body;

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
        document_id: documentId || null,
        conversation_history: conversationHistory || []
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

// POST /api/delete-document - Delete document from vector database and filesystem
router.post('/delete-document', (req, res) => {
    const { documentId, filePath } = req.body;

    if (!documentId) {
        return res.status(400).json({
            success: false,
            message: 'Document ID is required'
        });
    }

    console.log(`🗑️ Starting deletion process for: ${documentId}`);
    console.log(`📂 File path: ${filePath}`);
    const startTime = Date.now();

    // ADD DEBUG: Check if sendToPythonProcess function exists
    if (!req.app.locals.sendToPythonProcess) {
        console.error('❌ sendToPythonProcess function not available!');
        return res.status(500).json({
            success: false,
            message: 'Python process communication not available'
        });
    }

    console.log('🐍 Sending delete command to Python daemon...');

    // Step 1: Delete from Pinecone vector database
    req.app.locals.sendToPythonProcess('delete', {
        document_id: documentId
    }, (error, result) => {
        const processingTime = Date.now() - startTime;
        console.log(`⏱️ Python response received in ${processingTime}ms`);

        if (error) {
            console.error(`❌ Python daemon error:`, error);
            return res.status(500).json({
                success: false,
                message: 'Failed to delete document from vector database',
                error: error.message
            });
        }

        console.log('✅ Python daemon response:', result);

        // Step 2: Delete physical file if path provided
        if (filePath) {
            const fs = require('fs');
            try {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    console.log(`🗑️ Physical file deleted: ${filePath}`);
                } else {
                    console.log(`⚠️ File not found: ${filePath}`);
                }
            } catch (fileError) {
                console.warn(`⚠️ Could not delete file: ${filePath}`, fileError.message);
            }
        }

        console.log(`✅ Document deletion completed in ${processingTime}ms`);

        res.json({
            success: true,
            message: 'Document deleted successfully',
            document_id: documentId,
            processing_time_ms: processingTime,
            python_result: result // ADD THIS FOR DEBUG
        });
    });
});

// GET /api/clear-cache - Clear all cache (utility endpoint)
// POST /api/clear-all-documents - Clear entire Pinecone index (for testing)
router.post('/clear-all-documents', (req, res) => {
    console.log('🧹 Clearing ALL documents from Pinecone...');

    req.app.locals.sendToPythonProcess('clear_all', {}, (error, result) => {
        if (error) {
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }

        res.json({
            success: true,
            message: 'All documents cleared from Pinecone',
            result: result
        });
    });
});

// POST /api/force-clear-pinecone - Force clear using direct API
router.post('/force-clear-pinecone', async (req, res) => {
    try {
        console.log('🧹 Force clearing Pinecone index...');

        // Clear cache first
        const questionCache = req.app.locals.questionCache || new Map();
        const cacheSize = questionCache.size;
        questionCache.clear();
        console.log(`🧹 Cleared ${cacheSize} cache entries`);

        // You could also manually clear the uploads folder
        const fs = require('fs');
        const uploadsDir = 'uploads';
        let filesDeleted = 0;

        if (fs.existsSync(uploadsDir)) {
            const files = fs.readdirSync(uploadsDir);
            filesDeleted = files.length;
            files.forEach(file => {
                fs.unlinkSync(`${uploadsDir}/${file}`);
            });
            console.log(`🗑️ Deleted ${files.length} files from uploads`);
        }

        res.json({
            success: true,
            message: 'Cache and uploads cleared. Please also clear Pinecone manually.',
            cache_cleared: cacheSize,
            files_deleted: filesDeleted
        });

    } catch (error) {
        console.error('Error in force clear:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});


module.exports = router;
const User = require('../models/User');
const Document = require('../models/Document');
const Chat = require('../models/Chat');
const { spawn } = require('child_process');
const path = require('path');
const express = require('express');
const router = express.Router();
const multer = require('multer');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// imports for our functionality
const { getUserFromToken } = require('../middleware/auth');
const { canUserSendMessage, incrementUserMessageCount } = require('../utils/messageUtils');


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
//  multer error handling
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

// GET /api/my-documents - Get all documents for the logged-in user
router.get('/my-documents', getUserFromToken, async (req, res) => {
    try {
        console.log(`📄 Loading documents for user: ${req.user._id}`);

        const documents = await Document.find({ userId: req.user._id })
            .sort({ createdAt: -1 }) // Most recent first
            .lean(); // Better performance

        // Format documents for frontend
        const formattedDocuments = documents.map(doc => ({
            id: doc.documentId,
            name: doc.name,
            size: doc.size,
            extractedText: doc.extractedText,
            textLength: doc.textLength,
            chunksStored: doc.chunksStored,
            processingTime: doc.processingTime,
            uploadedAt: doc.createdAt.toISOString(),
            filePath: doc.filePath
        }));

        console.log(`✅ Found ${formattedDocuments.length} documents`);

        res.json({
            success: true,
            documents: formattedDocuments
        });

    } catch (error) {
        console.error('❌ Error loading documents:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load documents',
            error: error.message
        });
    }
});

// GET /api/chat/:documentId - Get chat history for a specific document
router.get('/chat/:documentId', getUserFromToken, async (req, res) => {
    try {
        const { documentId } = req.params;
        console.log(`💬 Loading chat for document: ${documentId}`);

        const chat = await Chat.findOne({
            userId: req.user._id,
            documentId: documentId
        });

        if (!chat) {
            return res.json({
                success: true,
                messages: [] // No chat history yet
            });
        }

        res.json({
            success: true,
            messages: chat.messages
        });

    } catch (error) {
        console.error('❌ Error loading chat:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load chat history'
        });
    }
});

// POST /api/save-message - Save a chat message to MongoDB
router.post('/save-message', getUserFromToken, async (req, res) => {
    try {
        const { documentId, message } = req.body;

        // Find existing chat or create new one
        let chat = await Chat.findOne({
            userId: req.user._id,
            documentId: documentId
        });

        if (!chat) {
            chat = new Chat({
                userId: req.user._id,
                documentId: documentId,
                messages: []
            });
        }

        // Add the new message
        chat.messages.push(message);
        await chat.save();

        res.json({
            success: true,
            message: 'Message saved successfully'
        });

    } catch (error) {
        console.error('❌ Error saving message:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to save message'
        });
    }
});

// POST /api/process-document - Store document in vector database
router.post('/process-document', getUserFromToken, (req, res) => {
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
    }, async (error, result) => {
        const processingTime = Date.now() - startTime;
        console.log(`⚡ Document processed in ${processingTime}ms`);

        if (error) {
            return res.status(500).json({
                success: false,
                message: 'Failed to process document',
                error: error.message
            });
        }
        try {
            const fs = require('fs');
            const fileStats = fs.statSync(filePath);

            const document = new Document({
                userId: req.user._id, // From auth middleware
                documentId: documentId,
                name: filePath.split('/').pop(), // Extract filename from path
                filePath: filePath,
                size: fileStats.size,
                extractedText: extractedText,
                textLength: extractedText.length,
                chunksStored: result.chunks_stored || 0,
                processingTime: processingTime
            });

            await document.save();
            console.log('✅ Document saved to MongoDB');

        } catch (dbError) {
            console.error('❌ Failed to save to MongoDB:', dbError);
            // Don't fail the request - vector DB worked
        }

        //  timing info to response
        result.processing_time_ms = processingTime;
        res.json(result);
    });
});

// POST /api/ask-question - Ask AI questions with caching
router.post('/ask-question', getUserFromToken, async (req, res) => {
    const { question, documentId, conversationHistory } = req.body;

    if (!question) {
        return res.status(400).json({
            success: false,
            message: 'Question is required'
        });
    }

    const limitCheck = canUserSendMessage(req.user);

    if (!limitCheck.allowed) {
        return res.status(403).json({
            success: false,
            message: 'Message limit reached. Please upgrade to continue.',
            messagesUsed: limitCheck.messagesUsed,
            messagesTotalLimit: limitCheck.messagesTotalLimit,
            upgradeRequired: true
        });
    }

    // Check cache first (even faster!)
    const cachedAnswer = req.app.locals.getCachedAnswer(question, documentId);
    if (cachedAnswer) {
        console.log(`📦 Cache hit for: "${question}"`);
        await incrementUserMessageCount(req.user._id);
        return res.json({
            ...cachedAnswer,
            cached: true,
            response_time_ms: 1
        });
    }

    console.log(`❓ Processing question: "${question}"`);
    const startTime = Date.now();

    // Increment message count BEFORE processing 
    await incrementUserMessageCount(req.user._id);

    req.app.locals.sendToPythonProcess('query', {
        question: question,
        document_id: documentId || null,
        conversation_history: conversationHistory || [],
        top_k: 8
    }, async (error, result) => {
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

        //  timing, cache info, and usage info
        result.cached = false;
        result.response_time_ms = processingTime;
        result.processed_timestamp = new Date().toISOString();
        result.messagesUsed = req.user.messagesUsed + 1;
        result.messagesTotalLimit = req.user.messagesTotalLimit;

        res.json(result);
    });
});

// POST /api/delete-document - Delete document from vector database and filesystem
router.post('/delete-document', getUserFromToken, (req, res) => {
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
    }, async (error, result) => {
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

        // Step 2: Delete from MongoDB
        try {
            await Document.findOneAndDelete({
                userId: req.user._id,
                documentId: documentId
            });
            console.log('✅ Document deleted from MongoDB');

            // Also delete related chat history
            await Chat.findOneAndDelete({
                userId: req.user._id,
                documentId: documentId
            });
            console.log('✅ Chat history deleted from MongoDB');

        } catch (dbError) {
            console.error('❌ Error deleting from MongoDB:', dbError);
            // Continue with file deletion even if DB delete fails
        }

        // Step 3: Delete physical file if path provided
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
            python_result: result
        });
    });
});

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


// POST /api/reset-user-usage - Reset user's message count (TESTING ONLY)
router.post('/reset-user-usage', getUserFromToken, async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.user._id, {
            messagesUsed: 0
        });

        res.json({
            success: true,
            message: 'User usage reset to 0'
        });
    } catch (error) {
        console.error('Reset error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// POST /api/create-payment-session - Create real Stripe checkout session
router.post('/create-payment-session', getUserFromToken, async (req, res) => {
    try {
        console.log('💳 Creating real Stripe checkout session for user:', req.user.email);

        // Create real Stripe checkout session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: 'DocuPrompt Pro Upgrade',
                            description: 'Unlock 10 additional AI chat messages',
                        },
                        unit_amount: 200, // $2.00 in cents
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            success_url: `http://localhost:3000/payment-success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `http://localhost:3000/payment-cancelled`,
            metadata: {
                userId: req.user._id.toString(),
                email: req.user.email
            }
        });

        res.json({
            success: true,
            sessionId: session.id,
            checkoutUrl: session.url,
            message: 'Real Stripe checkout session created'
        });

    } catch (error) {
        console.error('Stripe session creation error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// POST /api/verify-payment - Verify payment and upgrade user
router.post('/verify-payment', getUserFromToken, async (req, res) => {
    try {
        const { sessionId } = req.body;

        if (!sessionId) {
            return res.status(400).json({
                success: false,
                message: 'Session ID is required'
            });
        }

        console.log('🔍 Verifying payment session:', sessionId, 'for user:', req.user.email);

        // Retrieve the session from Stripe
        const session = await stripe.checkout.sessions.retrieve(sessionId);

        console.log('💳 Stripe session status:', session.payment_status);
        console.log('💰 Session metadata:', session.metadata);

        // Check if payment was successful
        if (session.payment_status === 'paid') {
            // Verify this session belongs to the current user
            if (session.metadata.userId !== req.user._id.toString()) {
                return res.status(403).json({
                    success: false,
                    message: 'Payment session does not belong to current user'
                });
            }

            // Check if user is already upgraded (prevent double upgrades)
            if (req.user.plan === 'pro') {
                return res.json({
                    success: true,
                    message: 'User already has pro plan',
                    alreadyUpgraded: true
                });
            }

            // Upgrade user to pro plan
            await User.findByIdAndUpdate(req.user._id, {
                plan: 'pro',
                messagesTotalLimit: 20,
                // Keep current messagesUsed - don't reset
            });

            console.log('✅ User upgraded to PRO plan with 20 message limit');

            res.json({
                success: true,
                message: 'Payment verified and account upgraded successfully!',
                plan: 'pro',
                messagesTotalLimit: 20,
                paymentAmount: session.amount_total / 100, // Convert from cents
                paymentDate: new Date().toISOString()
            });

        } else {
            res.status(400).json({
                success: false,
                message: 'Payment was not completed successfully',
                paymentStatus: session.payment_status
            });
        }

    } catch (error) {
        console.error('Payment verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Error verifying payment',
            error: error.message
        });
    }
});

// GET /api/validate-token - Validate JWT token and return fresh user data
router.get('/validate-token', getUserFromToken, async (req, res) => {
    try {
        // If getUserFromToken middleware passes, token is valid
        // Return fresh user data from database
        const freshUser = await User.findById(req.user._id).select('-password');

        if (!freshUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            user: {
                id: freshUser._id,
                username: freshUser.username,
                email: freshUser.email,
                messagesUsed: freshUser.messagesUsed,
                messagesTotalLimit: freshUser.messagesTotalLimit,
                plan: freshUser.plan
            },
            message: 'Token is valid'
        });

    } catch (error) {
        console.error('Token validation error:', error);
        res.status(500).json({
            success: false,
            message: 'Error validating token',
            error: error.message
        });
    }
});
module.exports = router;
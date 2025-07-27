// Add this import at the top
const healthController = require('../controllers/healthController');
const analyticsController = require('../controllers/analyticsController');
const questionController = require('../controllers/questionController');
const documentController = require('../controllers/documentController');
const uploadController = require('../controllers/uploadController');
const paymentController = require('../controllers/paymentController');
const chatController = require('../controllers/chatController');
const adminController = require('../controllers/adminController');
const userController = require('../controllers/userController');
const authRoutes = require('./routes/auth');


const User = require('../models/User');
const Document = require('../models/Document');
const Chat = require('../models/Chat');
const { spawn } = require('child_process');
const path = require('path');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const express = require('express');
const router = express.Router();
const multer = require('multer');

// imports for our functionality
const { getUserFromToken } = require('../middleware/auth');


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
        console.log('File filter check:', {
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
            console.log('File type accepted');
            cb(null, true);
        } else {
            console.log('File type rejected:', file.mimetype);
            cb(new Error(`Invalid file type: ${file.mimetype}`), false);
        }
    }
});

// auth routes 
router.use('/auth', authRoutes);

// GET /api/ - Welcome message
router.get('/', healthController.getWelcome);

// GET /api/health - Health check
router.get('/health', healthController.getHealth);

// POST /api/test - Test JSON handling
router.post('/test', healthController.postTest);

// POST /api/ask-question - Ask AI questions with caching
router.post('/ask-question', getUserFromToken, questionController.askQuestion);

// GET /api/my-documents - Get all documents for the logged-in user
router.get('/my-documents', getUserFromToken, documentController.getMyDocuments);

// Replace the upload route:
router.post('/upload', upload.single('document'), uploadController.uploadFile);

// GET /api/analytics - Get user analytics data
router.get('/analytics', getUserFromToken, analyticsController.getAnalytics);

// POST /api/create-payment-session - Create real Stripe checkout session
router.post('/create-payment-session', getUserFromToken, paymentController.createPaymentSession);

// POST /api/verify-payment - Verify payment and upgrade user
router.post('/verify-payment', getUserFromToken, paymentController.verifyPayment);

// GET /api/chat/:documentId - Get chat history for a specific document
router.get('/chat/:documentId', getUserFromToken, chatController.getChatHistory);

// POST /api/save-message - Save a chat message to MongoDB
router.post('/save-message', getUserFromToken, chatController.saveMessage);

// POST /api/delete-document - Delete document from vector database and filesystem
router.post('/delete-document', getUserFromToken, adminController.deleteDocument);

// POST /api/reset-user-usage - Reset user's message count (TESTING ONLY)
router.post('/reset-user-usage', getUserFromToken, adminController.resetUserUsage);

// POST /api/clear-all-documents - Clear entire Pinecone index (for testing)
router.post('/clear-all-documents', adminController.clearAllDocuments);

// POST /api/process-document - Store document in vector database
router.post('/process-document', getUserFromToken, documentController.processDocument);

// POST /api/extract-text - Extract text from uploaded file
router.post('/extract-text', documentController.extractText);

// POST /api/force-clear-pinecone - Force clear using direct API
router.post('/force-clear-pinecone', adminController.forceClearPinecone);

// GET /api/validate-token - Validate JWT token and return fresh user data
router.get('/validate-token', getUserFromToken, userController.validateToken);

// PUT /api/user/profile - Update user profile
router.put('/user/profile', getUserFromToken, userController.updateProfile);

// POST /api/user/change-password - Change user password
router.post('/user/change-password', getUserFromToken, userController.changePassword);

// PUT /api/user/preferences - Update user preferences
router.put('/user/preferences', getUserFromToken, userController.updatePreferences);

// GET /api/user/preferences - Get user preferences
router.get('/user/preferences', getUserFromToken, userController.getPreferences);

module.exports = router;
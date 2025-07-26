// controllers/adminController.js
const User = require('../models/User');
const Document = require('../models/Document');
const Chat = require('../models/Chat');
const vectorService = require('../services/vectorService');

exports.deleteDocument = async (req, res) => {
    try {
        const { documentId, filePath } = req.body;

        if (!documentId) {
            return res.status(400).json({
                success: false,
                message: 'Document ID is required'
            });
        }

        const startTime = Date.now();

        // Step 1: Delete from Vector Database
        try {
            await vectorService.deleteFromVectorDB(documentId, req.app.locals.sendToPythonProcess);
        } catch (vectorError) {
            console.error('Vector DB deletion failed:', vectorError.message);
            // Continue with other deletions even if vector DB fails
        }

        // Step 2: Delete from MongoDB
        try {
            await Document.findOneAndDelete({
                userId: req.user._id,
                documentId: documentId
            });
            console.log(' ocument deleted from MongoDB');

            // Also delete related chat history
            await Chat.findOneAndDelete({
                userId: req.user._id,
                documentId: documentId
            });
        } catch (dbError) {
            console.error('Database deletion failed:', dbError);
            throw new Error('Database deletion failed: ' + dbError.message);
        }

        // Step 3: Delete physical file
        if (filePath) {
            const fs = require('fs');
            try {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                } else {
                    console.log(`File not found: ${filePath}`);
                }
            } catch (fileError) {
                console.warn(`Could not delete file: ${filePath}`, fileError.message);
            }
        }

        const processingTime = Date.now() - startTime;

        res.json({
            success: true,
            message: 'Document deleted successfully',
            document_id: documentId,
            processing_time_ms: processingTime
        });

    } catch (error) {
        console.error('Delete document error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete document',
            error: error.message
        });
    }
};

exports.resetUserUsage = async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.user._id, {
            messagesUsed: 0
        });
        res.json({
            success: true,
            message: 'User usage reset to 0'
        });

    } catch (error) {
        console.error('Reset usage error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reset usage',
            error: error.message
        });
    }
};

exports.clearAllDocuments = async (req, res) => {
    try {

        if (!req.app.locals.sendToPythonProcess) {
            throw new Error('Python process not available');
        }

        req.app.locals.sendToPythonProcess('clear_all', {}, (error, result) => {
            if (error) {
                return res.status(500).json({
                    success: false,
                    message: 'Failed to clear documents',
                    error: error.message
                });
            }

            res.json({
                success: true,
                message: 'All documents cleared from Pinecone',
                result: result
            });
        });

    } catch (error) {
        console.error('Clear all error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to clear all documents',
            error: error.message
        });
    }
};

exports.forceClearPinecone = async (req, res) => {
    try {
        console.log('Force clearing Pinecone index...');

        // Clear cache first
        const questionCache = req.app.locals.questionCache || new Map();
        const cacheSize = questionCache.size;
        questionCache.clear();
        console.log(`Cleared ${cacheSize} cache entries`);

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
            console.log(`Deleted ${files.length} files from uploads`);
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
            message: 'Failed to force clear',
            error: error.message
        });
    }
};
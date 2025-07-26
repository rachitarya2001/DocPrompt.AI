// controllers/uploadController.js
const documentService = require('../services/documentService');

exports.uploadFile = async (req, res) => {
    try {

        // Validate request
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        console.log('File details:', {
            name: req.file.originalname,
            size: req.file.size,
            type: req.file.mimetype,
            path: req.file.path
        });

        // Step 1: Just validate file (using service)
        documentService.validateFile(req.file);

        // Step 2: Generate document ID (using service)
        const documentId = documentService.generateDocumentId(req.file.originalname);
        console.log(`Generated document ID: ${documentId}`);

        // Step 3: Return success response (NO database operations)
        console.log(`File upload completed successfully`);

        res.json({
            success: true,
            message: 'File uploaded successfully!',
            file: {
                originalName: req.file.originalname,
                fileName: req.file.filename,
                size: req.file.size,
                path: req.file.path,
                documentId: documentId  // Include generated ID for next steps
            }
        });

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to upload file',
            error: error.message
        });
    }
};

// Keep the old uploadDocument function for reference (we'll use it in processing)
exports.uploadDocument = async (req, res) => {
    // This is the old full-processing version - we'll move this logic to processing controller
    try {
        // ... keep existing code for now
    } catch (error) {
        // ... existing error handling
    }
};
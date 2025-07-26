// controllers/documentController.js
const Document = require('../models/Document');

exports.getMyDocuments = async (req, res) => {
    try {
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


        res.json({
            success: true,
            documents: formattedDocuments
        });

    } catch (error) {
        console.error('Error loading documents:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load documents',
            error: error.message
        });
    }
};

exports.processDocument = async (req, res) => {
    try {
        const { filePath, extractedText, documentId } = req.body;

        if (!filePath || !extractedText || !documentId) {
            return res.status(400).json({
                success: false,
                message: 'File path, extracted text, and document ID are required'
            });
        }

        const startTime = Date.now();

        // ✅ ENABLE VECTOR DB STORAGE
        let chunksStored = 0;

        // Check if Python process is available
        if (!req.app.locals.sendToPythonProcess) {
            console.log('Python process not available, storing in MongoDB only');
        } else {
            // Store in Vector Database
            try {
                console.log('Storing document in vector database...');

                await new Promise((resolve, reject) => {
                    req.app.locals.sendToPythonProcess('store', {
                        file_path: filePath,
                        document_id: documentId,
                        text: extractedText,
                        metadata: {
                            document_id: documentId,
                            file_name: filePath.split(/[\\\/]/).pop()
                        }
                    }, (error, result) => {
                        if (error) {
                            console.error('Vector storage failed:', error.message);
                            reject(error);
                        } else {
                            console.log('Vector storage successful:', result);
                            chunksStored = result.chunks_stored || 0;
                            resolve(result);
                        }
                    });
                });
            } catch (vectorError) {
                console.error('Vector storage error:', vectorError.message);
            }
        }

        // Save to MongoDB
        try {
            const fs = require('fs');
            const fileStats = fs.statSync(filePath);

            const document = new Document({
                userId: req.user._id,
                documentId: documentId,
                name: filePath.split(/[\\\/]/).pop(),
                filePath: filePath,
                size: fileStats.size,
                extractedText: extractedText,
                textLength: extractedText.length,
                chunksStored: chunksStored,
                processingTime: Date.now() - startTime
            });

            await document.save();

            // Return success response
            const totalProcessingTime = Date.now() - startTime;

            res.json({
                success: true,
                message: 'Document processed successfully',
                document: {
                    id: documentId,
                    name: document.name,
                    size: document.size,
                    textLength: extractedText.length,
                    chunksStored: chunksStored,
                    processingTime: totalProcessingTime
                }
            });

        } catch (dbError) {
            console.error('Failed to save to MongoDB:', dbError);
            throw new Error('Database save failed: ' + dbError.message);
        }

    } catch (error) {
        console.error('Processing error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process document',
            error: error.message
        });
    }
};

exports.extractText = async (req, res) => {
    try {
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

        console.log(`Starting OCR for: ${filePath}`);

        // Use document service for OCR (we already have this!)
        const documentService = require('../services/documentService');
        const extractedText = await documentService.extractTextFromFile(filePath);

        if (!extractedText || extractedText.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No text could be extracted from the document'
            });
        }

        res.json({
            success: true,
            text: extractedText,
            text_length: extractedText.length,
            file_path: filePath
        });

    } catch (error) {
        console.error('OCR extraction error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to extract text',
            error: error.message
        });
    }
};
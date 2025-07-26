// controllers/questionController.js
const { canUserSendMessage, incrementUserMessageCount } = require('../utils/messageUtils');

exports.askQuestion = async (req, res) => {
    try {
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

        // Check cache first
        const cachedAnswer = req.app.locals.getCachedAnswer(question, documentId);
        if (cachedAnswer) {
            await incrementUserMessageCount(req.user._id);
            return res.json({
                ...cachedAnswer,
                cached: true,
                response_time_ms: 1
            });
        }

        const startTime = Date.now();

        // Increment message count BEFORE processing
        await incrementUserMessageCount(req.user._id);

        // Send to Python AI process
        req.app.locals.sendToPythonProcess('query', {
            question: question,
            document_id: documentId || null,
            conversation_history: conversationHistory || [],
            top_k: 8
        }, async (error, result) => {
            const processingTime = Date.now() - startTime;

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

            // Add timing, cache info, and usage info
            result.cached = false;
            result.response_time_ms = processingTime;
            result.processed_timestamp = new Date().toISOString();
            result.messagesUsed = req.user.messagesUsed + 1;
            result.messagesTotalLimit = req.user.messagesTotalLimit;

            res.json(result);
        });

    } catch (error) {
        console.error('Error processing question:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process question',
            error: error.message
        });
    }
};
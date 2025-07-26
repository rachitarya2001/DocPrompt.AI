// controllers/chatController.js
const Chat = require('../models/Chat');

exports.getChatHistory = async (req, res) => {
    try {
        const { documentId } = req.params;

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
        console.error('Error loading chat:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load chat history',
            error: error.message
        });
    }
};

exports.saveMessage = async (req, res) => {
    try {
        const { documentId, message } = req.body;

        if (!documentId || !message) {
            return res.status(400).json({
                success: false,
                message: 'Document ID and message are required'
            });
        }

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
        console.error('Error saving message:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to save message',
            error: error.message
        });
    }
};
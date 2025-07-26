const User = require('../models/User');
const Document = require('../models/Document');
const Chat = require('../models/Chat');

exports.getAnalytics = async (req, res) => {
    try {

        // Get user's documents
        const documents = await Document.find({ userId: req.user._id }).sort({ createdAt: -1 });

        // Get user's chats
        const chats = await Chat.find({ userId: req.user._id });

        // Calculate total messages across all chats
        let totalMessages = 0;
        let documentsWithChats = 0;
        let documentMessageCounts = {};

        chats.forEach(chat => {
            if (chat.messages && chat.messages.length > 0) {
                const userMessages = chat.messages.filter(msg => msg.type === 'user').length;
                totalMessages += userMessages;
                documentsWithChats++;
                documentMessageCounts[chat.documentId] = userMessages;
            }
        });

        // ✅ ADD DETAILED ANALYTICS:

        // Last uploaded document
        const lastDocument = documents.length > 0 ? documents[0] : null;

        // Largest document by size
        const largestDocument = documents.length > 0
            ? documents.reduce((largest, current) =>
                current.size > largest.size ? current : largest
            )
            : null;

        // Most accessed document (most messages)
        let mostAccessedDocument = null;
        if (Object.keys(documentMessageCounts).length > 0) {
            const mostAccessedId = Object.keys(documentMessageCounts).reduce((a, b) =>
                documentMessageCounts[a] > documentMessageCounts[b] ? a : b
            );
            const mostAccessedDoc = documents.find(doc => doc.documentId === mostAccessedId);
            if (mostAccessedDoc) {
                mostAccessedDocument = {
                    name: mostAccessedDoc.name,
                    messageCount: documentMessageCounts[mostAccessedId],
                    documentId: mostAccessedId
                };
            }
        }

        // Document messages data for chart
        const documentMessagesData = documents.map(doc => ({
            name: doc.name,
            messages: documentMessageCounts[doc.documentId] || 0,
            documentId: doc.documentId
        }));

        // Average messages per document
        const averageMessagesPerDocument = documents.length > 0
            ? totalMessages / documents.length
            : 0;

        // ✅ COMPLETE ANALYTICS DATA:
        const analyticsData = {
            totalDocuments: documents.length,
            totalMessages: totalMessages,
            totalChats: chats.length,
            documentsWithChats: documentsWithChats,
            messagesUsed: req.user.messagesUsed,
            messagesTotalLimit: req.user.messagesTotalLimit,
            plan: req.user.plan,

            // ✅ NEW DETAILED DATA:
            lastDocumentUploaded: lastDocument ? lastDocument.name : null,
            lastUploadDate: lastDocument ? lastDocument.createdAt.toISOString() : null,
            largestDocument: largestDocument ? {
                name: largestDocument.name,
                size: largestDocument.size
            } : null,
            mostAccessedDocument: mostAccessedDocument,
            documentMessagesData: documentMessagesData,
            averageMessagesPerDocument: averageMessagesPerDocument
        };



        console.log(` Analytics calculated:`, analyticsData);
        res.json(analyticsData);

    } catch (error) {
        console.error('Error loading analytics:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load analytics',
            error: error.message
        });
    }
};
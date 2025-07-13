const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['user', 'assistant'],
        required: true
    },
    content: {
        type: String,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    sources: [{
        type: String
    }],
    cached: {
        type: Boolean,
        default: false
    },
    responseTime: {
        type: Number
    }
});

const chatSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    documentId: {
        type: String,
        default: null // null means general chat, not document-specific
    },
    messages: [messageSchema]
}, {
    timestamps: true
});

module.exports = mongoose.model('Chat', chatSchema);
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        minlength: 3,
        maxlength: 20
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    messagesUsed: {
        type: Number,
        default: 0
    },
    messagesTotalLimit: {
        type: Number,
        default: 10
    },
    plan: {
        type: String,
        enum: ['free', 'pro'],
        default: 'free'
    },
    stripeCustomerId: {
        type: String,
        default: null
    },
    preferences: {
        darkMode: { type: Boolean, default: true },
        autoSave: { type: Boolean, default: true },
        notifications: { type: Boolean, default: false }
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('User', userSchema);
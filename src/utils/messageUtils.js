const User = require('../models/User');

// Helper function to check if user can send more messages
function canUserSendMessage(user) {
    // Developer exemption - unlimited messages
    if (user.email === process.env.DEVELOPER_EMAIL) {
        return { allowed: true, reason: 'developer' };
    }

    // Check if user has messages remaining
    if (user.messagesUsed >= user.messagesTotalLimit) {
        return {
            allowed: false,
            reason: 'limit_reached',
            messagesUsed: user.messagesUsed,
            messagesTotalLimit: user.messagesTotalLimit
        };
    }

    return { allowed: true, reason: 'within_limit' };
}

// Helper function to increment user's message count
async function incrementUserMessageCount(userId) {
    await User.findByIdAndUpdate(userId, {
        $inc: { messagesUsed: 1 }
    });
}

module.exports = {
    canUserSendMessage,
    incrementUserMessageCount
};
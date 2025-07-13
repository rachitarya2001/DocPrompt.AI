const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware to get user from JWT token
async function getUserFromToken(req, res, next) {
    try {
        console.log('🔍 AUTH MIDDLEWARE: Starting...');
        console.log('🔍 AUTH MIDDLEWARE: Headers:', req.headers);
        const token = req.headers.authorization?.replace('Bearer ', '');
        console.log('🔍 AUTH MIDDLEWARE: Extracted token:', token);

        if (!token) {
            console.log('❌ AUTH MIDDLEWARE: No token provided');
            return res.status(401).json({
                success: false,
                message: 'No token provided'
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('🔍 AUTH MIDDLEWARE: Decoded token:', decoded);
        const user = await User.findById(decoded.userId);
        console.log('🔍 AUTH MIDDLEWARE: Found user:', user);

        if (!user) {
            console.log('❌ AUTH MIDDLEWARE: User not found');
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }

        req.user = user;
        console.log('✅ AUTH MIDDLEWARE: User attached to req');
        next();
    } catch (error) {
        console.log('❌ AUTH MIDDLEWARE: Error:', error);
        return res.status(401).json({
            success: false,
            message: 'Invalid token'
        });
    }
}

module.exports = { getUserFromToken };
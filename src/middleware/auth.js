const jwt = require('jsonwebtoken');
const User = require('../models/User');

async function getUserFromToken(req, res, next) {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'No token provided'
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);

        if (!user) {
            console.log('AUTH MIDDLEWARE: User not found');
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }

        req.user = user;
        next();
    } catch (error) {
        console.log('AUTH MIDDLEWARE: Error:', error);
        return res.status(401).json({
            success: false,
            message: 'Invalid token'
        });
    }
}

module.exports = { getUserFromToken };
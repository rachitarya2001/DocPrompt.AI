// controllers/userController.js
const User = require('../models/User');
const bcrypt = require('bcryptjs');

exports.validateToken = async (req, res) => {
    try {
        // If getUserFromToken middleware passes, token is valid
        // Return fresh user data from database
        const freshUser = await User.findById(req.user._id).select('-password');

        if (!freshUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            user: {
                id: freshUser._id,
                username: freshUser.username,
                email: freshUser.email,
                messagesUsed: freshUser.messagesUsed,
                messagesTotalLimit: freshUser.messagesTotalLimit,
                plan: freshUser.plan
            },
            message: 'Token is valid'
        });

    } catch (error) {
        console.error('Token validation error:', error);
        res.status(500).json({
            success: false,
            message: 'Error validating token',
            error: error.message
        });
    }
};

exports.updateProfile = async (req, res) => {
    try {
        const { username, email } = req.body;

        // Validation
        if (!username || username.trim().length < 2) {
            return res.status(400).json({
                success: false,
                message: 'Username must be at least 2 characters long'
            });
        }

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a valid email address'
            });
        }

        // Check if email is already taken by another user
        const existingUser = await User.findOne({
            email: email.toLowerCase(),
            _id: { $ne: req.user._id }
        });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Email is already taken by another user'
            });
        }

        // Update user
        const updatedUser = await User.findByIdAndUpdate(
            req.user._id,
            {
                username: username.trim(),
                email: email.toLowerCase().trim()
            },
            { new: true, runValidators: true }
        ).select('-password');

        res.json({
            success: true,
            message: 'Profile updated successfully',
            user: updatedUser
        });

    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update profile',
            error: error.message
        });
    }
};

exports.changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        // Validation
        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Current password and new password are required'
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'New password must be at least 6 characters long'
            });
        }

        // Get user with password field
        const user = await User.findById(req.user._id).select('+password');
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Verify current password
        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);

        if (!isCurrentPasswordValid) {
            return res.status(400).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        // Check if new password is different from current
        const isSamePassword = await bcrypt.compare(newPassword, user.password);
        if (isSamePassword) {
            return res.status(400).json({
                success: false,
                message: 'New password must be different from current password'
            });
        }

        // Hash new password
        const saltRounds = 10;
        const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

        // Update password in database
        await User.findByIdAndUpdate(req.user._id, {
            password: hashedNewPassword
        });

        res.json({
            success: true,
            message: 'Password changed successfully'
        });

    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to change password',
            error: error.message
        });
    }
};

exports.updatePreferences = async (req, res) => {
    try {
        const allowedPreferences = ['darkMode', 'autoSave', 'notifications'];
        const updates = {};

        // Validate and filter incoming preferences
        for (const [key, value] of Object.entries(req.body)) {
            if (allowedPreferences.includes(key) && typeof value === 'boolean') {
                updates[`preferences.${key}`] = value;
            }
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No valid preferences provided'
            });
        }

        // Update user preferences
        const updatedUser = await User.findByIdAndUpdate(
            req.user._id,
            { $set: updates },
            { new: true, runValidators: true }
        ).select('-password');

        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        res.json({
            success: true,
            message: 'Preferences updated successfully',
            preferences: updatedUser.preferences
        });

    } catch (error) {
        console.error('Error updating preferences:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update preferences',
            error: error.message
        });
    }
};

exports.getPreferences = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('preferences');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Default preferences if none exist
        const defaultPreferences = {
            darkMode: true,
            autoSave: true,
            notifications: false
        };

        const userPreferences = {
            ...defaultPreferences,
            ...user.preferences
        };

        res.json({
            success: true,
            preferences: userPreferences
        });

    } catch (error) {
        console.error(' Error fetching preferences:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch preferences',
            error: error.message
        });
    }
};
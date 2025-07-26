// controllers/healthController.js
exports.getHealth = (req, res) => {
    try {
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime()
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
};

exports.getWelcome = (req, res) => {
    try {
        res.json({
            message: 'DocuPrompt API is running!',
            status: 'success'
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
};

exports.postTest = (req, res) => {
    try {
        res.json({
            message: 'POST request received!',
            data: req.body,
            method: req.method
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
};
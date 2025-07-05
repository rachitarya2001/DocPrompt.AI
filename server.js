require('dotenv').config();
const express = require('express');
const app = express();

app.use(express.json());

// Import routes
const apiRoutes = require('./src/routes/api');

// Use routes
app.use('/api', apiRoutes);

app.listen(process.env.PORT || 3000, () => {
    console.log(`Server running on port ${process.env.PORT || 3000}`);
});
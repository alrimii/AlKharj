const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for all origins
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'WSE Proxy Server is running' });
});

// Proxy for contracts API
app.get('/api/contracts', async (req, res) => {
    try {
        console.log('Fetching contracts...');
        
        const response = await axios.get(
            'https://contractapi.wallstreetenglish.com/contracts',
            {
                params: req.query,
                headers: {
                    'Authorization': req.headers.authorization,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            }
        );
        
        res.json(response.data);
    } catch (error) {
        console.error('Error fetching contracts:', error.message);
        res.status(error.response?.status || 500).json({
            error: error.message,
            details: error.response?.data
        });
    }
});

// Proxy for student contract details
app.get('/api/students/:studentId/contracts', async (req, res) => {
    try {
        console.log(`Fetching contract details for student: ${req.params.studentId}`);
        
        const response = await axios.get(
            `https://contractapi.wallstreetenglish.com/students/${req.params.studentId}/contracts`,
            {
                params: req.query,
                headers: {
                    'Authorization': req.headers.authorization,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            }
        );
        
        res.json(response.data);
    } catch (error) {
        console.error('Error fetching student contracts:', error.message);
        res.status(error.response?.status || 500).json({
            error: error.message,
            details: error.response?.data
        });
    }
});

app.listen(PORT, () => {
    console.log(`✅ WSE Proxy Server is running on http://localhost:${PORT}`);
    console.log(`📡 Health check: http://localhost:${PORT}/health`);
});
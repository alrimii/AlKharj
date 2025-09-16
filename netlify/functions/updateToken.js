// netlify/functions/updateToken.js
const admin = require('firebase-admin');

exports.handler = async (event, context) => {
    // Security check
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const expectedToken = process.env.UPDATE_TOKEN_SECRET;
    
    if (authHeader !== `Bearer ${expectedToken}`) {
        return {
            statusCode: 401,
            body: JSON.stringify({ error: 'Unauthorized' })
        };
    }

    try {
        // Decode Firebase private key from Base64
        const privateKeyBase64 = process.env.FIREBASE_PRIVATE_KEY_BASE64;
        const privateKey = Buffer.from(privateKeyBase64, 'base64').toString('utf-8');

        // Initialize Firebase Admin
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: privateKey
                })
            });
        }

        const db = admin.firestore();
        
        // For now, save a test token - you'll add actual extraction later
        const testToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test";
        
        await db.collection('config').doc('wseToken').set({
            token: testToken,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            source: 'manual-test'
        });

        return {
            statusCode: 200,
            body: JSON.stringify({ 
                success: true, 
                message: 'Token placeholder saved - add extraction logic later'
            })
        };

    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                success: false, 
                error: error.message 
            })
        };
    }
};
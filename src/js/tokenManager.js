// src/js/tokenManager.js
import { CONFIG } from '../config/config.js';

export class TokenManager {
    constructor() {
        this.token = null;
        this.tokenExpiry = null;
        this.db = null;
    }

    async initialize() {
        if (!firebase.apps.length) {
            firebase.initializeApp(CONFIG.FIREBASE_CONFIG);
        }
        this.db = firebase.firestore();
    }

    async getToken() {
        // Check cached token
        if (this.token && this.tokenExpiry && new Date() < this.tokenExpiry) {
            return this.token;
        }

        try {
            // Get token from Firebase
            const doc = await this.db.collection('config').doc('wseToken').get();
            
            if (doc.exists) {
                const data = doc.data();
                this.token = data.token;
                this.tokenExpiry = data.expiresAt?.toDate() || new Date(Date.now() + 23 * 60 * 60 * 1000);
                
                // Check if token is still valid
                const tokenAge = Date.now() - data.updatedAt?.toDate()?.getTime();
                if (tokenAge > 24 * 60 * 60 * 1000) {
                    console.warn('Token is older than 24 hours');
                    // Trigger manual update if needed
                    this.requestTokenUpdate();
                }
                
                return this.token;
            } else {
                throw new Error('No token found in Firebase');
            }
        } catch (error) {
            console.error('Error getting token:', error);
            
            // Fallback to localStorage if exists
            const localToken = localStorage.getItem('wse_auth_token');
            if (localToken) {
                return localToken;
            }
            
            throw error;
        }
    }

    async requestTokenUpdate() {
        // Manual token update trigger
        try {
            const response = await fetch('/.netlify/functions/updateToken', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${CONFIG.UPDATE_TOKEN_SECRET}`,
                    'Content-Type': 'application/json'
                }
            });
            
            const result = await response.json();
            if (result.success) {
                // Wait and get new token
                await new Promise(resolve => setTimeout(resolve, 2000));
                return await this.getToken();
            }
        } catch (error) {
            console.error('Failed to trigger token update:', error);
        }
    }

    subscribeToTokenUpdates(callback) {
        // Real-time token updates
        return this.db.collection('config').doc('wseToken')
            .onSnapshot((doc) => {
                if (doc.exists) {
                    const data = doc.data();
                    this.token = data.token;
                    this.tokenExpiry = data.expiresAt?.toDate();
                    callback(this.token);
                }
            });
    }
}
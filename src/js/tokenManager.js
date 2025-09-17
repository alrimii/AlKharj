// tokenManager.js - إدارة التوكن من Firebase
// Path: /src/js/tokenManager.js

import { CONFIG } from '../config/config.js';

export class TokenManager {
    constructor() {
        this.token = null;
        this.tokenExpiry = null;
        this.db = null;
        this.unsubscribe = null;
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;
        
        try {
            // Initialize Firebase if not already done
            if (!firebase.apps.length) {
                firebase.initializeApp(CONFIG.FIREBASE_CONFIG);
            }
            
            this.db = firebase.firestore();
            this.initialized = true;
            console.log('TokenManager initialized successfully');
        } catch (error) {
            console.error('Failed to initialize TokenManager:', error);
            this.initialized = false;
            throw error;
        }
    }

    async getToken() {
        // Check cached token first
        if (this.token && this.tokenExpiry && new Date() < this.tokenExpiry) {
            return this.token;
        }

        try {
            // Ensure initialized
            if (!this.initialized) {
                await this.initialize();
            }

            // Get token from Firebase
            const doc = await this.db.collection('config').doc('wseToken').get();
            
            if (doc.exists) {
                const data = doc.data();
                
                // Validate token exists
                if (!data.token) {
                    console.warn('Token document exists but token is empty');
                    return this.getFallbackToken();
                }
                
                this.token = data.token;
                
                // Set expiry from Firebase or default to 23 hours
                if (data.expiresAt) {
                    this.tokenExpiry = data.expiresAt.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);
                } else {
                    // Default to 23 hours from last update
                    const updatedAt = data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date();
                    this.tokenExpiry = new Date(updatedAt.getTime() + 23 * 60 * 60 * 1000);
                }
                
                // Check if token is still valid
                const tokenAge = Date.now() - (data.updatedAt?.toDate ? data.updatedAt.toDate().getTime() : 0);
                if (tokenAge > 24 * 60 * 60 * 1000) {
                    console.warn('Token is older than 24 hours, may need refresh');
                    // Don't block, but trigger update in background
                    this.requestTokenUpdate().catch(console.error);
                }
                
                console.log('Token loaded from Firebase successfully');
                return this.token;
                
            } else {
                console.warn('No token document found in Firebase');
                return this.getFallbackToken();
            }
        } catch (error) {
            console.error('Error getting token from Firebase:', error);
            return this.getFallbackToken();
        }
    }

    getFallbackToken() {
        // Try localStorage as fallback
        const localToken = localStorage.getItem('wse_auth_token');
        if (localToken) {
            console.log('Using token from localStorage as fallback');
            this.token = localToken;
            // Set short expiry for fallback token
            this.tokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
            return localToken;
        }
        return null;
    }

    async requestTokenUpdate() {
        console.log('Requesting token update...');
        
        // Check if we're on Netlify (not localhost)
        const isNetlify = window.location.hostname.includes('netlify') || 
                         window.location.hostname.includes('.app');
        
        if (!isNetlify && window.location.hostname !== 'localhost') {
            console.warn('Token update only works on Netlify deployment');
            return false;
        }

        try {
            const response = await fetch('/.netlify/functions/updateToken', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${CONFIG.UPDATE_TOKEN_SECRET || 'wse-secret-key-2024'}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    trigger: 'manual',
                    timestamp: new Date().toISOString()
                })
            });

            if (response.ok) {
                const result = await response.json();
                console.log('Token update response:', result);
                
                // Wait a bit for Firebase to update
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // Reload token from Firebase
                this.token = null; // Clear cache
                this.tokenExpiry = null;
                await this.getToken();
                
                return true;
            } else {
                const error = await response.text();
                console.error('Token update failed:', response.status, error);
                return false;
            }
        } catch (error) {
            console.error('Failed to request token update:', error);
            return false;
        }
    }

    subscribeToTokenUpdates(callback) {
        if (!this.db) {
            console.warn('Database not initialized for token subscription');
            return () => {};
        }

        // Unsubscribe from previous listener if exists
        if (this.unsubscribe) {
            this.unsubscribe();
        }

        // Subscribe to real-time updates
        this.unsubscribe = this.db.collection('config').doc('wseToken')
            .onSnapshot(
                (doc) => {
                    if (doc.exists) {
                        const data = doc.data();
                        
                        // Update cached token
                        this.token = data.token;
                        
                        if (data.expiresAt) {
                            this.tokenExpiry = data.expiresAt.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);
                        }
                        
                        console.log('Token updated via real-time listener');
                        
                        // Call the callback with new token
                        if (callback && typeof callback === 'function') {
                            callback(this.token);
                        }
                    }
                },
                (error) => {
                    console.error('Error in token subscription:', error);
                }
            );

        // Return unsubscribe function
        return this.unsubscribe;
    }

    async checkTokenValidity() {
        try {
            if (!this.initialized) {
                await this.initialize();
            }

            const doc = await this.db.collection('config').doc('wseToken').get();
            
            if (doc.exists) {
                const data = doc.data();
                const now = new Date();
                
                // Get last update time
                const lastUpdate = data.updatedAt?.toDate ? data.updatedAt.toDate() : null;
                
                // Calculate age
                const ageInHours = lastUpdate ? 
                    Math.floor((now - lastUpdate) / (1000 * 60 * 60)) : 
                    999;
                
                // Check expiry
                const expiresAt = data.expiresAt?.toDate ? data.expiresAt.toDate() : null;
                const isExpired = expiresAt ? now > expiresAt : ageInHours > 24;
                
                return {
                    valid: !isExpired && data.token,
                    expired: isExpired,
                    lastUpdate: lastUpdate,
                    ageInHours: Math.round(ageInHours),
                    expiresAt: expiresAt,
                    needsRefresh: ageInHours > 20 // Suggest refresh if older than 20 hours
                };
            }
            
            return {
                valid: false,
                expired: true,
                lastUpdate: null,
                ageInHours: null,
                needsRefresh: true
            };
            
        } catch (error) {
            console.error('Error checking token validity:', error);
            return {
                valid: false,
                expired: true,
                error: error.message
            };
        }
    }

    canSaveToken() {
        // Only allow saving if user is admin (you can implement your own logic)
        // For security, we generally don't want to allow saving tokens from the frontend
        return false;
    }

    async saveManualToken(token) {
        // Save to localStorage only (not to Firebase for security)
        if (!token || !token.startsWith('eyJ')) {
            console.error('Invalid token format');
            return false;
        }

        try {
            localStorage.setItem('wse_auth_token', token);
            localStorage.setItem('wse_token_saved_at', new Date().toISOString());
            
            // Update cache
            this.token = token;
            this.tokenExpiry = new Date(Date.now() + 23 * 60 * 60 * 1000);
            
            console.log('Manual token saved to localStorage');
            return true;
        } catch (error) {
            console.error('Failed to save manual token:', error);
            return false;
        }
    }

    clearToken() {
        // Clear all token data
        this.token = null;
        this.tokenExpiry = null;
        localStorage.removeItem('wse_auth_token');
        localStorage.removeItem('wse_token_saved_at');
        
        // Unsubscribe from updates
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
        
        console.log('Token cleared');
    }

    async getTokenInfo() {
        // Get detailed token information for debugging
        const validity = await this.checkTokenValidity();
        const localToken = localStorage.getItem('wse_auth_token');
        const localSavedAt = localStorage.getItem('wse_token_saved_at');
        
        return {
            hasFirebaseToken: !!this.token,
            hasLocalToken: !!localToken,
            localTokenAge: localSavedAt ? 
                Math.round((Date.now() - new Date(localSavedAt)) / (1000 * 60 * 60)) + ' hours' : 
                'N/A',
            firebaseValidity: validity,
            currentToken: this.token ? this.token.substring(0, 20) + '...' : null,
            tokenExpiry: this.tokenExpiry,
            initialized: this.initialized
        };
    }
}
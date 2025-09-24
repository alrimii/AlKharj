// api.js - Updated with TokenManager integration
// Path: /src/js/api.js

import { CONFIG } from '../config/config.js';
import { TokenManager } from './tokenManager.js';

export class API {
    constructor(authToken = null) {
        this.authToken = authToken;
        this.tokenManager = null;
        this.cache = new Map();
        this.cacheTimeout = CONFIG.CACHE_TIMEOUT;
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;
        
        // If no token provided, try to get from TokenManager
        if (!this.authToken) {
            this.tokenManager = new TokenManager();
            await this.tokenManager.initialize();
            this.authToken = await this.tokenManager.getToken();
        }
        
        this.initialized = true;
    }

    async getValidToken() {
        // If we have TokenManager, always get fresh token
        if (this.tokenManager) {
            const token = await this.tokenManager.getToken();
            if (token) {
                this.authToken = token;
            }
        }
        
        if (!this.authToken) {
            throw new Error('No authentication token available');
        }
        
        return this.authToken;
    }

    async testConnection() {
        await this.initialize();
        const token = await this.getValidToken();
        
        const url = `${CONFIG.API_BASE_URL}/centers/${CONFIG.CENTER_ID}`;
        const response = await this.makeRequest(url);
        
        if (!response) {
            throw new Error('Connection test failed');
        }
        
        return response;
    }

    async makeRequest(url, params = null, maxRetries = CONFIG.MAX_RETRIES) {
        await this.initialize();
        const token = await this.getValidToken();
        
        const cacheKey = `${url}_${JSON.stringify(params)}`;
        const cached = this.cache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data;
        }

        let lastError = null;
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                const fullUrl = params ? 
                    `${url}?${new URLSearchParams(params).toString()}` : url;
                
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT);
                
                const response = await fetch(fullUrl, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    // If 401, token might be expired
                    if (response.status === 401 && this.tokenManager) {
                        console.log('Token might be expired, requesting update...');
                        await this.tokenManager.requestTokenUpdate();
                    }
                    
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                
                this.cache.set(cacheKey, {
                    data: data,
                    timestamp: Date.now()
                });
                
                return data;
                
            } catch (error) {
                lastError = error;
                
                if (attempt < maxRetries - 1) {
                    await this.sleep(CONFIG.RETRY_DELAY * (attempt + 1));
                }
            }
        }
        
        throw lastError;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async fetchSchedule(startDate) {
        const url = `${CONFIG.API_BASE_URL}/centers/${CONFIG.CENTER_ID}/schedule`;
        const params = { startDate: startDate };
        
        const data = await this.makeRequest(url, params);
        return data || [];
    }

    async fetchClassDetails(classId) {
        if (!classId) return null;
        
        const url = `${CONFIG.API_BASE_URL}/classes/${classId}/details`;
        return await this.makeRequest(url);
    }

    async fetchLevelSummaries(userId) {
        if (!userId) return null;
        
        const url = `${CONFIG.API_BASE_URL}/students/${userId}/levelSummaries`;
        const params = { count: 4, offset: 0 };
        
        return await this.makeRequest(url, params);
    }

    async fetchLessonSummaries(userId, unitId) {
        if (!userId || !unitId) return [];
        
        const url = `${CONFIG.API_BASE_URL}/students/${userId}/units/${unitId}/lessonssummaries`;
        const data = await this.makeRequest(url);
        
        return data?.lessonsSummaries || [];
    }

    clearCache() {
        this.cache.clear();
        console.log('API cache cleared');
    }
    
    // Update token if using TokenManager
    updateToken(newToken) {
        if (newToken) {
            this.authToken = newToken;
            console.log('API token updated');
        }
    }
}

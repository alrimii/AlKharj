// api.js - Updated with correct contract API URL
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

    // Contract API methods - FIXED URL
    async fetchContracts() {
        try {
            console.log('Fetching contracts from API...');
            
            // Using the CORRECT API URL
            const url = `${CONFIG.NEW_CONTRACT_API_URL}/contracts`;
            const allContracts = [];
            let offset = 0;
            const count = 50;
            
            // First request to get total count
            const params = {
                contractTypes: ["Private", "B2B"],
                contractStatuses: ["Valid", "Invalid", "Future"],
                ContractValidationStates: ["Pending", "Cancelled", "Declined", "Validated", "LinkExpired"],
                centerId: CONFIG.CENTER_ID,
                count: count,
                offset: offset
            };
            
            // Build URL with query parameters
            const queryString = this.buildContractQueryString(params);
            const initialUrl = `${url}?${queryString}`;
            
            const initialData = await this.makeContractRequest(initialUrl);
            const totalCount = initialData.totalItemCount || 0;
            allContracts.push(...(initialData.elements || []));
            
            console.log(`Total contracts available: ${totalCount}`);
            
            // Fetch remaining batches if needed
            offset = allContracts.length;
            
            while (offset < totalCount) {
                params.offset = offset;
                const queryString = this.buildContractQueryString(params);
                const batchUrl = `${url}?${queryString}`;
                
                const data = await this.makeContractRequest(batchUrl);
                if (data.elements) {
                    allContracts.push(...data.elements);
                    offset += data.elements.length;
                    
                    // Progress logging
                    if (offset % 100 === 0 || offset >= totalCount) {
                        console.log(`Fetched ${offset}/${totalCount} contracts`);
                    }
                } else {
                    console.warn('Unexpected response format - no elements array');
                    break;
                }
            }
            
            console.log(`Successfully fetched ${allContracts.length} contracts`);
            return allContracts;
            
        } catch (error) {
            console.error('Error fetching contracts:', error);
            throw error;
        }
    }

    buildContractQueryString(params) {
        const parts = [];
        
        // Handle arrays
        if (params.contractTypes) {
            params.contractTypes.forEach(type => {
                parts.push(`contractTypes=${encodeURIComponent(type)}`);
            });
        }
        
        if (params.contractStatuses) {
            params.contractStatuses.forEach(status => {
                parts.push(`contractStatuses=${encodeURIComponent(status)}`);
            });
        }
        
        if (params.ContractValidationStates) {
            params.ContractValidationStates.forEach(state => {
                parts.push(`ContractValidationStates=${encodeURIComponent(state)}`);
            });
        }
        
        // Handle single values
        if (params.centerId) {
            parts.push(`centerId=${encodeURIComponent(params.centerId)}`);
        }
        
        if (params.count !== undefined) {
            parts.push(`count=${params.count}`);
        }
        
        if (params.offset !== undefined) {
            parts.push(`offset=${params.offset}`);
        }
        
        return parts.join('&');
    }

    async makeContractRequest(url, maxRetries = 3) {
        await this.initialize();
        const token = await this.getValidToken();
        
        let lastError = null;
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 30000);
                
                const response = await fetch(url, {
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
                        console.log('Token expired in contract request, updating...');
                        await this.tokenManager.requestTokenUpdate();
                        // Get new token for retry
                        this.authToken = await this.tokenManager.getToken();
                    }
                    
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                return data;
                
            } catch (error) {
                lastError = error;
                console.warn(`Contract API attempt ${attempt + 1} failed:`, error.message);
                
                if (attempt < maxRetries - 1) {
                    // Exponential backoff
                    const backoffTime = 2000 * Math.pow(2, attempt);
                    console.log(`Retrying in ${backoffTime}ms...`);
                    await this.sleep(backoffTime);
                }
            }
        }
        
        throw lastError;
    }

    async fetchStudentContractDetails(studentId) {
        if (!studentId) return null;
        
        try {
            // Using the CORRECT API URL
            const url = `${CONFIG.NEW_CONTRACT_API_URL}/students/${studentId}/contracts`;
            const fullUrl = `${url}?centerId=${CONFIG.CENTER_ID}`;
            
            const data = await this.makeContractRequest(fullUrl);
            return data;
            
        } catch (error) {
            console.error(`Error fetching contract details for ${studentId}:`, error);
            return null;
        }
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
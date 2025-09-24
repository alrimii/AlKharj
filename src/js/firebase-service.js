// firebase-service.js - Enhanced Firebase service with complete data storage
// Path: /src/js/firebase-service.js

import { CONFIG } from '../config/config.js';

export class FirebaseService {
    constructor() {
        this.db = null;
        this.initialized = false;
        this.cacheExpiry = CONFIG.CACHE_TIMEOUT;
    }

    async initialize() {
        if (this.initialized) return;
        
        try {
            // Initialize Firebase
            if (!firebase.apps.length) {
                firebase.initializeApp(CONFIG.FIREBASE_CONFIG);
            }
            
            this.db = firebase.firestore();
            this.initialized = true;
            
            console.log('Firebase initialized successfully');
            
            // The daily data cleaning was causing slow first loads.
            // It's better to rely on manual refresh and cache expiration.
            // await this.cleanOldDataIfNeeded(); 
        } catch (error) {
            console.error('Failed to initialize Firebase:', error);
            this.initialized = false;
        }
    }

    // Check and clean old data if it's a new day
    async cleanOldDataIfNeeded() {
        if (!this.db) return;
        
        try {
            const lastCleanDoc = await this.db.collection('metadata').doc('lastClean').get();
            const lastCleanData = lastCleanDoc.data();
            const today = new Date().toDateString();
            
            if (!lastCleanData || lastCleanData.date !== today) {
                console.log('New day detected, cleaning old Firebase data...');
                await this.clearAllCache();
                
                // Update last clean date
                await this.db.collection('metadata').doc('lastClean').set({
                    date: today,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
        } catch (error) {
            console.error('Error checking/cleaning old data:', error);
        }
    }

    // Save complete schedule data with all lesson summaries
    async saveScheduleData(date, mode, data) {
        if (!this.initialized) await this.initialize();
        if (!this.db) return false;
        
        try {
            // Prepare data with all nested information
            const dataToSave = JSON.parse(JSON.stringify(data)); // Deep clone
            
            const docRef = this.db.collection('schedules').doc(`${mode}_${date}`);
            
            await docRef.set({
                mode: mode,
                date: date,
                data: JSON.stringify(dataToSave), // Save complete data including lesson summaries
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                expiresAt: new Date(Date.now() + this.cacheExpiry),
                centerId: CONFIG.CENTER_ID,
                dataVersion: 2 // Version 2 includes lesson summaries
            });
            
            console.log(`Saved ${mode} data for ${date} to Firebase (with lesson summaries)`);
            return true;
        } catch (error) {
            console.error('Error saving to Firebase:', error);
            return false;
        }
    }

    // Get complete schedule data with all lesson summaries
    async getScheduleData(date, mode) {
        if (!this.initialized) await this.initialize();
        if (!this.db) return null;
        
        try {
            const docRef = this.db.collection('schedules').doc(`${mode}_${date}`);
            const doc = await docRef.get();
            
            if (!doc.exists) {
                console.log(`No cached data for ${mode}_${date}`);
                return null;
            }
            
            const data = doc.data();
            const expiresAt = data.expiresAt?.toDate();
            
            // Check if data expired
            if (expiresAt && new Date() > expiresAt) {
                console.log(`Cached data expired for ${mode}_${date}`);
                await docRef.delete(); // Clean expired data
                return null;
            }
            
            console.log(`Retrieved cached data for ${mode}_${date} (version ${data.dataVersion || 1})`);
            const parsedData = JSON.parse(data.data);
            
            // Check if this is old version data without lesson summaries
            if (data.dataVersion !== 2) {
                console.log('Old cache version detected, will need to fetch lesson summaries');
                return parsedData; // Return data but it won't have lesson summaries
            }
            
            return parsedData;
        } catch (error) {
            console.error('Error getting from Firebase:', error);
            return null;
        }
    }

    // Save all schedules at once
    async saveAllSchedules(encounterData, ccData) {
        if (!this.initialized) await this.initialize();
        if (!this.db) return false;
        
        try {
            const batch = this.db.batch();
            
            // Save encounter data
            for (const [date, data] of Object.entries(encounterData)) {
                const docRef = this.db.collection('schedules').doc(`encounter_${date}`);
                batch.set(docRef, {
                    mode: 'encounter',
                    date: date,
                    data: JSON.stringify(data),
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    expiresAt: new Date(Date.now() + this.cacheExpiry),
                    centerId: CONFIG.CENTER_ID,
                    dataVersion: 2
                });
            }
            
            // Save CC data
            for (const [date, data] of Object.entries(ccData)) {
                const docRef = this.db.collection('schedules').doc(`cc_${date}`);
                batch.set(docRef, {
                    mode: 'cc',
                    date: date,
                    data: JSON.stringify(data),
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    expiresAt: new Date(Date.now() + this.cacheExpiry),
                    centerId: CONFIG.CENTER_ID,
                    dataVersion: 2
                });
            }
            
            await batch.commit();
            console.log('Saved all schedules to Firebase');
            return true;
        } catch (error) {
            console.error('Error saving schedules:', error);
            return false;
        }
    }

    // Get all cached schedules
    async getAllSchedules() {
        if (!this.initialized) await this.initialize();
        if (!this.db) return { encounter: {}, cc: {} };
        
        try {
            const snapshot = await this.db.collection('schedules')
                .where('centerId', '==', CONFIG.CENTER_ID)
                .get();
            
            const encounter = {};
            const cc = {};
            
            snapshot.forEach(doc => {
                const data = doc.data();
                const expiresAt = data.expiresAt?.toDate();
                
                if (!expiresAt || new Date() <= expiresAt) {
                    const parsedData = JSON.parse(data.data);
                    if (data.mode === 'encounter') {
                        encounter[data.date] = parsedData;
                    } else if (data.mode === 'cc') {
                        cc[data.date] = parsedData;
                    }
                }
            });
            
            console.log(`Retrieved ${Object.keys(encounter).length} encounter dates and ${Object.keys(cc).length} CC dates from cache`);
            return { encounter, cc };
        } catch (error) {
            console.error('Error getting all schedules:', error);
            return { encounter: {}, cc: {} };
        }
    }

    // Save level summaries
    async saveLevelSummaries(levelData) {
        if (!this.initialized) await this.initialize();
        if (!this.db) return false;
        
        try {
            const batch = this.db.batch();
            const chunkSize = 100; // Firestore batch limit is 500, we use 100 to be safe
            const entries = Object.entries(levelData);
            
            for (let i = 0; i < entries.length; i += chunkSize) {
                const chunk = entries.slice(i, i + chunkSize);
                const chunkBatch = this.db.batch();
                
                for (const [userId, data] of chunk) {
                    const docRef = this.db.collection('levelSummaries').doc(userId);
                    chunkBatch.set(docRef, {
                        userId: userId,
                        data: JSON.stringify(data),
                        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                        expiresAt: new Date(Date.now() + this.cacheExpiry)
                    });
                }
                
                await chunkBatch.commit();
            }
            
            console.log(`Saved level summaries for ${Object.keys(levelData).length} students`);
            return true;
        } catch (error) {
            console.error('Error saving level summaries:', error);
            return false;
        }
    }

    // Get level summaries
    async getLevelSummaries(userIds) {
        if (!this.initialized) await this.initialize();
        if (!this.db) return {};
        
        try {
            const levels = {};
            
            // Firestore 'in' query limit is 10
            const chunks = [];
            for (let i = 0; i < userIds.length; i += 10) {
                chunks.push(userIds.slice(i, i + 10));
            }
            
            for (const chunk of chunks) {
                if (chunk.length === 0) continue;
                
                const snapshot = await this.db.collection('levelSummaries')
                    .where('userId', 'in', chunk)
                    .get();
                
                snapshot.forEach(doc => {
                    const data = doc.data();
                    const expiresAt = data.expiresAt?.toDate();
                    
                    if (!expiresAt || new Date() <= expiresAt) {
                        levels[data.userId] = JSON.parse(data.data);
                    }
                });
            }
            
            console.log(`Retrieved ${Object.keys(levels).length} level summaries from cache`);
            return levels;
        } catch (error) {
            console.error('Error getting level summaries:', error);
            return {};
        }
    }

    // Clear all cache
    async clearAllCache() {
        if (!this.initialized) await this.initialize();
        if (!this.db) return;
        
        try {
            console.log('Clearing all Firebase cache...');
            
            // Delete schedules
            const schedulesSnapshot = await this.db.collection('schedules').get();
            const batch1 = this.db.batch();
            let count = 0;
            schedulesSnapshot.forEach(doc => {
                batch1.delete(doc.ref);
                count++;
                if (count >= 400) { // Firestore batch limit
                    batch1.commit();
                    count = 0;
                }
            });
            if (count > 0) await batch1.commit();
            
            // Delete level summaries
            const levelsSnapshot = await this.db.collection('levelSummaries').get();
            const batch2 = this.db.batch();
            count = 0;
            levelsSnapshot.forEach(doc => {
                batch2.delete(doc.ref);
                count++;
                if (count >= 400) {
                    batch2.commit();
                    count = 0;
                }
            });
            if (count > 0) await batch2.commit();
            
            console.log('Cleared all cache data from Firebase');
        } catch (error) {
            console.error('Error clearing cache:', error);
        }
    }

    // Clean up expired data
    async cleanupExpiredData() {
        if (!this.initialized) await this.initialize();
        if (!this.db) return;
        
        try {
            const now = new Date();
            
            // Delete expired schedules
            const schedulesSnapshot = await this.db.collection('schedules')
                .where('expiresAt', '<', now)
                .get();
            
            const batch = this.db.batch();
            schedulesSnapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
            
            // Delete expired level summaries
            const levelsSnapshot = await this.db.collection('levelSummaries')
                .where('expiresAt', '<', now)
                .get();
            
            levelsSnapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
            
            await batch.commit();
            console.log('Cleaned up expired cache data');
        } catch (error) {
            console.error('Error cleaning up cache:', error);
        }
    }
}


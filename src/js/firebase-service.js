// firebase-service.js - Enhanced error handling
// Path: /src/js/firebase-service.js

import { CONFIG } from '../config/config.js';

export class FirebaseService {
    constructor() {
        this.db = null;
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
            console.log('Firebase initialized successfully');

            // Clean old data periodically - with better error handling
            this.cleanOldDataIfNeeded().catch(error => {
                console.warn('Cache cleanup skipped:', error.message);
                // Don't throw - this is not critical
            });

        } catch (error) {
            console.error('Firebase initialization failed:', error);
            throw error;
        }
    }

    async cleanOldDataIfNeeded() {
        try {
            const lastCleanup = localStorage.getItem('lastFirebaseCleanup');
            const now = Date.now();
            const ONE_DAY = 24 * 60 * 60 * 1000;

            if (!lastCleanup || (now - parseInt(lastCleanup)) > ONE_DAY) {
                console.log('Attempting to clean old cache data...');
                
                // Try to delete documents older than 7 days
                const cutoffTime = new Date(now - 7 * ONE_DAY);
                const oldDocsQuery = this.db.collection('cache')
                    .where('timestamp', '<', cutoffTime)
                    .limit(10);

                const snapshot = await oldDocsQuery.get();
                
                if (!snapshot.empty) {
                    const batch = this.db.batch();
                    snapshot.forEach(doc => {
                        batch.delete(doc.ref);
                    });
                    
                    await batch.commit();
                    console.log(`Cleaned ${snapshot.size} old cache documents`);
                }

                localStorage.setItem('lastFirebaseCleanup', now.toString());
            }
        } catch (error) {
            // Silently fail - cleanup is not critical
            console.warn('Cache cleanup failed, continuing normally:', error.message);
        }
    }

    async saveAllSchedules(encounterData, ccData) {
        if (!this.initialized) {
            console.warn('Firebase not initialized, skipping save');
            return;
        }

        try {
            const batch = this.db.batch();
            
            // Save encounter data
            for (const [date, classes] of Object.entries(encounterData)) {
                const docRef = this.db.collection('cache').doc(`encounter_${date}`);
                batch.set(docRef, {
                    type: 'encounter',
                    date: date,
                    classes: classes,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            }

            // Save CC data
            for (const [date, classes] of Object.entries(ccData)) {
                const docRef = this.db.collection('cache').doc(`cc_${date}`);
                batch.set(docRef, {
                    type: 'cc',
                    date: date,
                    classes: classes,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            }

            await batch.commit();
            console.log('Schedules saved to Firebase successfully');

        } catch (error) {
            console.error('Error saving schedules:', error);
            // Store locally as fallback
            this.saveToLocalStorage('encounterData', encounterData);
            this.saveToLocalStorage('ccData', ccData);
            console.log('Data saved to localStorage as fallback');
        }
    }

    async getAllSchedules() {
        if (!this.initialized) {
            return this.getFromLocalStorage();
        }

        try {
            const encounterData = {};
            const ccData = {};

            // Get encounter data
            const encounterSnapshot = await this.db.collection('cache')
                .where('type', '==', 'encounter')
                .get();

            encounterSnapshot.forEach(doc => {
                const data = doc.data();
                if (data.date && data.classes) {
                    encounterData[data.date] = data.classes;
                }
            });

            // Get CC data
            const ccSnapshot = await this.db.collection('cache')
                .where('type', '==', 'cc')
                .get();

            ccSnapshot.forEach(doc => {
                const data = doc.data();
                if (data.date && data.classes) {
                    ccData[data.date] = data.classes;
                }
            });

            const encounterDates = Object.keys(encounterData).length;
            const ccDates = Object.keys(ccData).length;
            
            console.log(`Retrieved ${encounterDates} encounter dates and ${ccDates} CC dates from cache`);

            // Also save to localStorage for backup
            this.saveToLocalStorage('encounterData', encounterData);
            this.saveToLocalStorage('ccData', ccData);

            return { encounter: encounterData, cc: ccData };

        } catch (error) {
            console.error('Error loading from Firebase, using localStorage:', error);
            return this.getFromLocalStorage();
        }
    }

    async saveLevelSummaries(levelSummaries) {
        if (!this.initialized) {
            console.warn('Firebase not initialized, using localStorage');
            this.saveToLocalStorage('levelSummaries', levelSummaries);
            return;
        }

        try {
            const batch = this.db.batch();
            
            for (const [userId, data] of Object.entries(levelSummaries)) {
                const docRef = this.db.collection('cache').doc(`levels_${userId}`);
                batch.set(docRef, {
                    type: 'levels',
                    userId: userId,
                    data: data,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            }

            await batch.commit();
            console.log(`Level summaries saved for ${Object.keys(levelSummaries).length} users`);

            // Backup to localStorage
            this.saveToLocalStorage('levelSummaries', levelSummaries);

        } catch (error) {
            console.error('Error saving level summaries:', error);
            this.saveToLocalStorage('levelSummaries', levelSummaries);
        }
    }

    async getLevelSummaries(userIds) {
        if (!this.initialized) {
            return this.getFromLocalStorage('levelSummaries') || {};
        }

        try {
            const levelSummaries = {};

            // Batch get level summaries
            const batchSize = 10;
            for (let i = 0; i < userIds.length; i += batchSize) {
                const batch = userIds.slice(i, i + batchSize);
                const docIds = batch.map(id => `levels_${id}`);
                
                const promises = docIds.map(docId => 
                    this.db.collection('cache').doc(docId).get()
                );
                
                const docs = await Promise.all(promises);
                
                docs.forEach(doc => {
                    if (doc.exists) {
                        const data = doc.data();
                        if (data.userId && data.data) {
                            levelSummaries[data.userId] = data.data;
                        }
                    }
                });
            }

            // Backup to localStorage
            this.saveToLocalStorage('levelSummaries', levelSummaries);

            return levelSummaries;

        } catch (error) {
            console.error('Error loading level summaries from Firebase:', error);
            return this.getFromLocalStorage('levelSummaries') || {};
        }
    }

    async saveSelfBookingData(data) {
        if (!this.initialized) {
            this.saveToLocalStorage('selfBookingData', data);
            return;
        }

        try {
            const docRef = this.db.collection('cache').doc('selfBooking');
            await docRef.set({
                type: 'selfBooking',
                data: data,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });

            console.log(`Self-booking data saved for ${data.length} students`);
            this.saveToLocalStorage('selfBookingData', data);

        } catch (error) {
            console.error('Error saving self-booking data:', error);
            this.saveToLocalStorage('selfBookingData', data);
        }
    }

    async getSelfBookingData() {
        if (!this.initialized) {
            return this.getFromLocalStorage('selfBookingData') || [];
        }

        try {
            const doc = await this.db.collection('cache').doc('selfBooking').get();
            
            if (doc.exists) {
                const data = doc.data();
                this.saveToLocalStorage('selfBookingData', data.data);
                return data.data || [];
            }

            return this.getFromLocalStorage('selfBookingData') || [];

        } catch (error) {
            console.error('Error loading self-booking data:', error);
            return this.getFromLocalStorage('selfBookingData') || [];
        }
    }

    async clearAllCache() {
        if (!this.initialized) {
            // Clear localStorage
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith('wse_') || key.includes('Data')) {
                    localStorage.removeItem(key);
                }
            });
            return;
        }

        try {
            console.log('Clearing Firebase cache...');
            
            const snapshot = await this.db.collection('cache').get();
            const batch = this.db.batch();
            
            snapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
            
            await batch.commit();
            console.log('Firebase cache cleared');
            
            // Also clear localStorage
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith('wse_') || key.includes('Data')) {
                    localStorage.removeItem(key);
                }
            });

        } catch (error) {
            console.error('Error clearing cache:', error);
        }
    }

    // Helper methods for localStorage fallback
    saveToLocalStorage(key, data) {
        try {
            const prefixedKey = `wse_${key}`;
            localStorage.setItem(prefixedKey, JSON.stringify({
                data: data,
                timestamp: Date.now()
            }));
        } catch (error) {
            console.warn('localStorage save failed:', error);
        }
    }

    getFromLocalStorage(key = null) {
        if (key) {
            try {
                const prefixedKey = `wse_${key}`;
                const item = localStorage.getItem(prefixedKey);
                if (item) {
                    const parsed = JSON.parse(item);
                    // Check if data is less than 1 day old
                    const ageHours = (Date.now() - parsed.timestamp) / (1000 * 60 * 60);
                    if (ageHours < 24) {
                        return parsed.data;
                    }
                }
            } catch (error) {
                console.warn('localStorage read failed:', error);
            }
            return null;
        }

        // Return all data for getAllSchedules
        const encounterData = this.getFromLocalStorage('encounterData') || {};
        const ccData = this.getFromLocalStorage('ccData') || {};
        
        return { encounter: encounterData, cc: ccData };
    }
}
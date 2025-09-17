// syncManager.js - Central sync coordination
// Path: /src/js/syncManager.js

import { CONFIG } from '../config/config.js';

export class SyncManager {
    constructor(firebase) {
        this.firebase = firebase;
        this.db = null;
        this.userId = null;
        this.isLeader = false;
        this.lastSyncTime = null;
        this.syncInterval = null;
        this.leaderCheckInterval = null;
        this.listeners = [];
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;
        
        try {
            // Initialize Firebase Auth for anonymous login
            if (!firebase.auth().currentUser) {
                await firebase.auth().signInAnonymously();
            }
            
            this.userId = firebase.auth().currentUser.uid;
            this.db = firebase.firestore();
            
            console.log('SyncManager initialized with user:', this.userId.substring(0, 8));
            
            // Start leadership election
            await this.electLeader();
            
            // Setup periodic leadership check
            this.setupLeadershipCheck();
            
            this.initialized = true;
        } catch (error) {
            console.error('Failed to initialize SyncManager:', error);
            throw error;
        }
    }

    async electLeader() {
        const syncDoc = this.db.collection('sync').doc('refreshSchedule');
        
        try {
            await this.db.runTransaction(async (transaction) => {
                const doc = await transaction.get(syncDoc);
                const now = Date.now();
                
                if (!doc.exists) {
                    // No leader exists, become leader
                    transaction.set(syncDoc, {
                        leaderId: this.userId,
                        lastHeartbeat: now,
                        nextRefreshTime: now + (5 * 60 * 1000), // 5 minutes
                        refreshInProgress: false
                    });
                    this.isLeader = true;
                    console.log('🏆 Became sync leader');
                } else {
                    const data = doc.data();
                    const timeSinceHeartbeat = now - data.lastHeartbeat;
                    
                    if (timeSinceHeartbeat > 30000 || data.leaderId === this.userId) {
                        // Previous leader is dead or we're already leader
                        transaction.update(syncDoc, {
                            leaderId: this.userId,
                            lastHeartbeat: now,
                            nextRefreshTime: data.nextRefreshTime || now + (5 * 60 * 1000)
                        });
                        this.isLeader = true;
                        console.log('🏆 Took over as sync leader');
                    } else {
                        this.isLeader = false;
                        console.log('📡 Following sync leader:', data.leaderId.substring(0, 8));
                    }
                }
            });
        } catch (error) {
            console.error('Leader election failed:', error);
            this.isLeader = false;
        }
    }

    setupLeadershipCheck() {
        // Check leadership every 10 seconds
        this.leaderCheckInterval = setInterval(async () => {
            if (this.isLeader) {
                await this.sendHeartbeat();
            } else {
                await this.checkForLeadershipOpportunity();
            }
        }, 10000);
    }

    async sendHeartbeat() {
        try {
            const syncDoc = this.db.collection('sync').doc('refreshSchedule');
            await syncDoc.update({
                leaderId: this.userId,
                lastHeartbeat: Date.now()
            });
        } catch (error) {
            console.error('Heartbeat failed:', error);
            // Try to re-elect
            await this.electLeader();
        }
    }

    async checkForLeadershipOpportunity() {
        try {
            const syncDoc = this.db.collection('sync').doc('refreshSchedule');
            const doc = await syncDoc.get();
            
            if (doc.exists) {
                const data = doc.data();
                const timeSinceHeartbeat = Date.now() - data.lastHeartbeat;
                
                if (timeSinceHeartbeat > 30000) {
                    // Leader is dead, try to take over
                    await this.electLeader();
                }
            }
        } catch (error) {
            console.error('Leadership check failed:', error);
        }
    }

    async shouldRefresh() {
        if (!this.isLeader) {
            return false; // Only leader can initiate refresh
        }
        
        try {
            const syncDoc = this.db.collection('sync').doc('refreshSchedule');
            const doc = await syncDoc.get();
            
            if (doc.exists) {
                const data = doc.data();
                const now = Date.now();
                
                // Check if it's time to refresh and not already in progress
                if (now >= data.nextRefreshTime && !data.refreshInProgress) {
                    // Mark refresh as in progress
                    await syncDoc.update({
                        refreshInProgress: true,
                        refreshStartedAt: now,
                        refreshStartedBy: this.userId
                    });
                    
                    return true;
                }
            }
            
            return false;
        } catch (error) {
            console.error('shouldRefresh check failed:', error);
            return false;
        }
    }

    async markRefreshComplete() {
        if (!this.isLeader) return;
        
        try {
            const syncDoc = this.db.collection('sync').doc('refreshSchedule');
            const now = Date.now();
            
            await syncDoc.update({
                refreshInProgress: false,
                lastRefreshTime: now,
                nextRefreshTime: now + (5 * 60 * 1000), // Next refresh in 5 minutes
                refreshCompletedBy: this.userId
            });
            
            console.log('✅ Refresh cycle completed');
        } catch (error) {
            console.error('markRefreshComplete failed:', error);
        }
    }

    async markRefreshFailed() {
        if (!this.isLeader) return;
        
        try {
            const syncDoc = this.db.collection('sync').doc('refreshSchedule');
            const now = Date.now();
            
            await syncDoc.update({
                refreshInProgress: false,
                lastRefreshError: now,
                nextRefreshTime: now + (2 * 60 * 1000), // Retry in 2 minutes
                refreshFailedBy: this.userId
            });
            
            console.log('❌ Refresh cycle failed, will retry in 2 minutes');
        } catch (error) {
            console.error('markRefreshFailed failed:', error);
        }
    }

    listenToRefreshEvents(callback) {
        const syncDoc = this.db.collection('sync').doc('refreshSchedule');
        
        const unsubscribe = syncDoc.onSnapshot((doc) => {
            if (doc.exists) {
                const data = doc.data();
                
                // Notify all clients about refresh state
                if (data.refreshInProgress && data.refreshStartedBy !== this.userId) {
                    callback('refresh_started', data);
                } else if (data.lastRefreshTime && !data.refreshInProgress) {
                    callback('refresh_completed', data);
                }
            }
        });
        
        this.listeners.push(unsubscribe);
        return unsubscribe;
    }

    getNextRefreshTime() {
        return this.db.collection('sync').doc('refreshSchedule').get()
            .then(doc => {
                if (doc.exists) {
                    const data = doc.data();
                    return data.nextRefreshTime;
                }
                return null;
            })
            .catch(() => null);
    }

    cleanup() {
        if (this.leaderCheckInterval) {
            clearInterval(this.leaderCheckInterval);
        }
        
        // Remove all listeners
        this.listeners.forEach(unsubscribe => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        });
        
        this.listeners = [];
        this.initialized = false;
        
        console.log('SyncManager cleaned up');
    }
}
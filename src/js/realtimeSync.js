// realtimeSync.js - نظام المزامنة الفورية المبسط
// Path: /src/js/realtimeSync.js

import { CONFIG } from '../config/config.js';

export class RealtimeSync {
    constructor(firebase) {
        this.firebase = firebase;
        this.db = null;
        this.listeners = new Map();
        this.callbacks = new Map();
        this.initialized = false;
        this.lastUpdateTime = null;
        this.deviceId = this.generateDeviceId();
    }

    generateDeviceId() {
        // توليد معرف فريد للجهاز
        const stored = localStorage.getItem('wse_device_id');
        if (stored) return stored;
        
        const id = 'device_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('wse_device_id', id);
        return id;
    }

    async initialize() {
        if (this.initialized) return;
        
        try {
            // لا حاجة لـ authentication - نستخدم Firestore مباشرة
            this.db = firebase.firestore();
            
            // تسجيل الجهاز
            await this.registerDevice();
            
            // بدء الاستماع للتحديثات
            this.startListening();
            
            this.initialized = true;
            console.log('✅ RealtimeSync initialized successfully');
        } catch (error) {
            console.error('Failed to initialize RealtimeSync:', error);
            throw error;
        }
    }

    async registerDevice() {
        try {
            await this.db.collection('activeDevices').doc(this.deviceId).set({
                deviceId: this.deviceId,
                lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
                userAgent: navigator.userAgent,
                online: true
            });
            
            // تحديث حالة الجهاز كل دقيقة
            setInterval(() => {
                this.updateDeviceStatus();
            }, 60000);
            
            // تنظيف عند إغلاق الصفحة
            window.addEventListener('beforeunload', () => {
                this.db.collection('activeDevices').doc(this.deviceId).update({
                    online: false,
                    lastSeen: firebase.firestore.FieldValue.serverTimestamp()
                });
            });
            
        } catch (error) {
            console.error('Error registering device:', error);
        }
    }

    async updateDeviceStatus() {
        if (!this.db) return;
        
        try {
            await this.db.collection('activeDevices').doc(this.deviceId).update({
                lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
                online: true
            });
        } catch (error) {
            console.error('Error updating device status:', error);
        }
    }

    startListening() {
        // الاستماع لحالة التحديث العامة
        this.listenToRefreshStatus();
        
        // الاستماع لتحديثات البيانات
        this.listenToDataUpdates();
        
        // الاستماع للأجهزة النشطة
        this.listenToActiveDevices();
    }

    listenToRefreshStatus() {
        const unsubscribe = this.db.collection('sync').doc('status')
            .onSnapshot((doc) => {
                if (doc.exists) {
                    const data = doc.data();
                    
                    // إشعار بالتحديث الجديد
                    if (data.lastUpdateTime && this.lastUpdateTime) {
                        const lastUpdate = data.lastUpdateTime.toDate ? 
                            data.lastUpdateTime.toDate() : new Date(data.lastUpdateTime);
                        
                        if (lastUpdate > this.lastUpdateTime) {
                            console.log('🔄 New data available from server');
                            this.notifyCallbacks('data_updated', data);
                        }
                    }
                    
                    this.lastUpdateTime = data.lastUpdateTime?.toDate ? 
                        data.lastUpdateTime.toDate() : new Date();
                    
                    // إشعار بحالة التحديث
                    if (data.isUpdating) {
                        this.notifyCallbacks('update_started', data);
                    } else {
                        this.notifyCallbacks('update_completed', data);
                    }
                }
            }, (error) => {
                console.error('Error listening to refresh status:', error);
            });
        
        this.listeners.set('refreshStatus', unsubscribe);
    }

    listenToDataUpdates() {
        // الاستماع لتحديثات الجداول
        const schedulesUnsubscribe = this.db.collection('schedules')
            .where('centerId', '==', CONFIG.CENTER_ID)
            .onSnapshot((snapshot) => {
                const changes = [];
                
                snapshot.docChanges().forEach((change) => {
                    if (change.type === 'modified' || change.type === 'added') {
                        const data = change.doc.data();
                        changes.push({
                            type: change.type,
                            mode: data.mode,
                            date: data.date,
                            doc: change.doc
                        });
                    }
                });
                
                if (changes.length > 0) {
                    console.log(`📊 ${changes.length} schedule updates received`);
                    this.notifyCallbacks('schedules_updated', changes);
                }
            }, (error) => {
                console.error('Error listening to schedules:', error);
            });
        
        this.listeners.set('schedules', schedulesUnsubscribe);
    }

    listenToActiveDevices() {
        const unsubscribe = this.db.collection('activeDevices')
            .where('online', '==', true)
            .onSnapshot((snapshot) => {
                const devices = [];
                snapshot.forEach((doc) => {
                    const data = doc.data();
                    if (data.deviceId !== this.deviceId) {
                        devices.push(data);
                    }
                });
                
                console.log(`👥 ${devices.length} other devices connected`);
                this.notifyCallbacks('devices_updated', devices);
            }, (error) => {
                console.error('Error listening to devices:', error);
            });
        
        this.listeners.set('devices', unsubscribe);
    }

    // تسجيل callback للأحداث
    on(event, callback) {
        if (!this.callbacks.has(event)) {
            this.callbacks.set(event, []);
        }
        this.callbacks.get(event).push(callback);
        
        // إرجاع دالة لإلغاء التسجيل
        return () => {
            const callbacks = this.callbacks.get(event);
            if (callbacks) {
                const index = callbacks.indexOf(callback);
                if (index > -1) {
                    callbacks.splice(index, 1);
                }
            }
        };
    }

    // إلغاء تسجيل callback
    off(event, callback) {
        const callbacks = this.callbacks.get(event);
        if (callbacks) {
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    // إشعار الـ callbacks
    notifyCallbacks(event, data) {
        const callbacks = this.callbacks.get(event);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in callback for ${event}:`, error);
                }
            });
        }
    }

    // تحديث حالة المزامنة
    async updateSyncStatus(status) {
        if (!this.db) return;
        
        try {
            await this.db.collection('sync').doc('status').set({
                lastUpdateTime: firebase.firestore.FieldValue.serverTimestamp(),
                isUpdating: status.isUpdating || false,
                updatedBy: status.updatedBy || this.deviceId,
                message: status.message || '',
                nextScheduledUpdate: status.nextScheduledUpdate || null
            }, { merge: true });
        } catch (error) {
            console.error('Error updating sync status:', error);
        }
    }

    // الحصول على حالة المزامنة الحالية
    async getSyncStatus() {
        if (!this.db) return null;
        
        try {
            const doc = await this.db.collection('sync').doc('status').get();
            if (doc.exists) {
                return doc.data();
            }
            return null;
        } catch (error) {
            console.error('Error getting sync status:', error);
            return null;
        }
    }

    // فحص إذا كانت البيانات بحاجة للتحديث
    async needsUpdate() {
        const status = await this.getSyncStatus();
        if (!status || !status.lastUpdateTime) return true;
        
        const lastUpdate = status.lastUpdateTime.toDate ? 
            status.lastUpdateTime.toDate() : new Date(status.lastUpdateTime);
        
        const now = new Date();
        const hoursSinceUpdate = (now - lastUpdate) / (1000 * 60 * 60);
        
        // تحديث كل 5 دقائق في ساعات العمل، كل 30 دقيقة خارجها
        const currentHour = now.getHours();
        const isWorkHours = currentHour >= 8 && currentHour <= 22;
        const updateInterval = isWorkHours ? 5/60 : 0.5; // بالساعات
        
        return hoursSinceUpdate >= updateInterval;
    }

    // طلب تحديث من الخادم (للتحديث اليدوي فقط)
    async requestManualUpdate() {
        try {
            // وضع علامة أن التحديث قيد التنفيذ
            await this.updateSyncStatus({
                isUpdating: true,
                updatedBy: this.deviceId,
                message: 'Manual update requested'
            });
            
            return true;
        } catch (error) {
            console.error('Error requesting update:', error);
            return false;
        }
    }

    // تنظيف الموارد
    cleanup() {
        // إلغاء كل المستمعين
        this.listeners.forEach((unsubscribe, key) => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        });
        
        // تحديث حالة الجهاز لـ offline
        if (this.db && this.deviceId) {
            this.db.collection('activeDevices').doc(this.deviceId).update({
                online: false,
                lastSeen: firebase.firestore.FieldValue.serverTimestamp()
            }).catch(console.error);
        }
        
        this.listeners.clear();
        this.callbacks.clear();
        this.initialized = false;
        
        console.log('RealtimeSync cleaned up');
    }

    // الحصول على عدد الأجهزة النشطة
    async getActiveDevicesCount() {
        if (!this.db) return 0;
        
        try {
            const snapshot = await this.db.collection('activeDevices')
                .where('online', '==', true)
                .get();
            
            return snapshot.size;
        } catch (error) {
            console.error('Error getting active devices:', error);
            return 0;
        }
    }
}
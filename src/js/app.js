// app.js - Simplified version without auto-refresh
// Path: /src/js/app.js

import { API } from './api.js';
import { DataProcessor } from './data.js';
import { UI } from './ui.js';
import { FirebaseService } from './firebase-service.js';
import { TokenManager } from './tokenManager.js';
import { CONFIG } from '../config/config.js';

export class App {
    constructor() {
        this.api = null;
        this.dataProcessor = new DataProcessor();
        this.ui = new UI();
        this.firebase = new FirebaseService();
        this.tokenManager = new TokenManager();
        
        this.state = {
            authToken: null,
            centerName: '',
            currentMode: 'encounter',
            currentDate: null,
            data: {
                encounter: {},
                cc: {},
                self: []
            },
            studentDetails: {},
            levelSummaries: {},
            isLoading: false,
            lastUpdate: null,
            isFirstLoad: true,
            loadingProgress: 0,
            isManualRefresh: false,
            tokenStatus: 'checking'
        };

        this.tokenCheckInterval = null;
        this.unsubscribeSchedules = null;
        this.unsubscribeSync = null;
        this.init();
    }

    async init() {
        console.log('Initializing WSE Tracker...');
        
        // Initialize services
        await this.firebase.initialize();
        await this.tokenManager.initialize();
        
        this.setupEventListeners();
        
        // Check for token availability
        await this.checkAndInitializeToken();
    }

    async checkAndInitializeToken() {
        this.ui.showLoading('Checking authentication...');
        
        try {
            // Try to get token from Firebase
            const token = await this.tokenManager.getToken();
            
            if (token) {
                this.state.authToken = token;
                this.state.tokenStatus = 'valid';
                
                // Get center name from localStorage or use default
                this.state.centerName = localStorage.getItem('wse_center_name') || 'WSE Center';
                
                // Initialize API with token
                this.api = new API(token);
                
                // Start the app
                await this.startApp();
                
                // Setup token monitoring
                this.setupTokenMonitoring();
            } else {
                // No token found - show manual login
                this.state.tokenStatus = 'missing';
                this.showManualTokenEntry();
            }
        } catch (error) {
            console.error('Failed to get token:', error);
            this.state.tokenStatus = 'error';
            this.showManualTokenEntry();
        }
    }

    showManualTokenEntry() {
        // Show enhanced login screen with token status
        const loginScreen = document.getElementById('loginScreen');
        const tokenField = document.getElementById('authToken');
        
        // Remove any existing status message
        const existingStatus = document.querySelector('.token-status-message');
        if (existingStatus) {
            existingStatus.remove();
        }
        
        // Add status message
        const statusDiv = document.createElement('div');
        statusDiv.className = 'token-status-message';
        statusDiv.innerHTML = `
            <div class="alert alert-warning">
                <i class="fas fa-exclamation-triangle"></i>
                <span>Automatic token unavailable. Please enter manually or wait for next update.</span>
            </div>
            <button id="requestTokenUpdate" class="btn-secondary">
                <i class="fas fa-sync"></i> Request Token Update
            </button>
        `;
        
        // Insert before form
        const form = document.getElementById('loginForm');
        form.parentNode.insertBefore(statusDiv, form);
        
        // Add event listener for update button
        document.getElementById('requestTokenUpdate')?.addEventListener('click', async () => {
            await this.requestTokenUpdate();
        });
        
        this.ui.showLoginScreen();
    }

    async requestTokenUpdate() {
        this.ui.showLoading('Requesting token update...');
        
        try {
            const updated = await this.tokenManager.requestTokenUpdate();
            
            if (updated) {
                this.ui.showToast('Token update triggered successfully', 'success');
                // Wait and retry
                setTimeout(() => {
                    this.checkAndInitializeToken();
                }, 3000);
            } else {
                this.ui.showToast('Manual update not available. Use GitHub Actions.', 'error');
                this.ui.showLoginScreen();
            }
        } catch (error) {
            console.error('Token update request failed:', error);
            this.ui.showToast('Update request failed', 'error');
            this.ui.showLoginScreen();
        }
    }

    setupTokenMonitoring() {
        // Subscribe to real-time token updates
        this.tokenManager.subscribeToTokenUpdates((newToken) => {
            if (newToken && newToken !== this.state.authToken) {
                console.log('Token updated via Firebase');
                this.state.authToken = newToken;
                
                // Reinitialize API with new token
                this.api = new API(newToken);
                
                // Refresh data
                this.performRefresh(true);
                
                this.ui.showToast('Authentication token updated', 'info');
            }
        });
        
        // Check token validity every 30 minutes
        this.tokenCheckInterval = setInterval(async () => {
            try {
                const tokenStatus = await this.tokenManager.checkTokenValidity();
                
                if (tokenStatus.expired && tokenStatus.ageInHours > 10) {
                    console.warn('Token expired, may need manual update');
                }
                
                // Update UI with token status
                this.updateTokenStatusDisplay(tokenStatus);
                
            } catch (error) {
                console.error('Token check failed:', error);
            }
        }, 30 * 60 * 1000); // Every 30 minutes
        
        // Initial status update
        this.tokenManager.checkTokenValidity().then(status => {
            this.updateTokenStatusDisplay(status);
        });
    }

    updateTokenStatusDisplay(status) {
        const statusElement = document.getElementById('tokenStatus');
        if (!statusElement) return;
        
        const now = new Date();
        const lastUpdate = status.lastUpdate ? new Date(status.lastUpdate) : null;
        const hoursAgo = lastUpdate ? Math.floor((now - lastUpdate) / (1000 * 60 * 60)) : null;
        
        let statusHTML = '';
        if (status.valid) {
            statusHTML = `<span class="status-valid"><i class="fas fa-check-circle"></i> Token Valid</span>`;
        } else if (status.expired) {
            statusHTML = `<span class="status-expired"><i class="fas fa-exclamation-circle"></i> Token Expired</span>`;
        }
        
        if (hoursAgo !== null) {
            statusHTML += ` <small>(Updated ${hoursAgo}h ago)</small>`;
        }
        
        statusElement.innerHTML = statusHTML;
    }

    setupEventListeners() {
        // Handle manual login form submission
        const loginForm = document.getElementById('loginForm');
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleManualLogin();
        });

        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.logout();
        });

        // Enhanced refresh button handler
        document.getElementById('refreshBtn')?.addEventListener('click', async () => {
            if (this.state.isLoading) {
                console.log('Refresh already in progress, ignoring click');
                return;
            }

            console.log('Manual refresh triggered');
            await this.performRefresh(true);
        });

        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.switchMode(btn.dataset.mode);
            });
        });
    }

    async performRefresh(isManual = false) {
        if (this.state.isLoading) {
            console.log('Refresh already in progress');
            return;
        }

        const refreshBtn = document.getElementById('refreshBtn');
        
        try {
            this.state.isLoading = true;
            this.state.isManualRefresh = isManual;

            // Update UI
            if (refreshBtn) {
                refreshBtn.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i>';
                refreshBtn.disabled = true;
                refreshBtn.classList.add('refreshing');
            }

            if (isManual) {
                this.ui.showToast('Refreshing data...', 'info');
            }

            // Update sync status in Firebase
            const db = firebase.firestore();
            await db.collection('sync').doc('status').set({
                isUpdating: true,
                updatedBy: this.getDeviceId(),
                updateStartedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            // Clear API cache
            if (this.api) {
                this.api.clearCache();
            }

            // Load fresh data
            await this.loadAllData(true);

            // Update sync status with completion
            await db.collection('sync').doc('status').set({
                isUpdating: false,
                lastUpdateTime: firebase.firestore.FieldValue.serverTimestamp(),
                updatedBy: this.getDeviceId(),
                message: 'Update completed successfully'
            }, { merge: true });

            if (isManual) {
                this.ui.showToast('✅ Data refreshed successfully', 'success');
            }

        } catch (error) {
            console.error('Refresh failed:', error);
            
            if (isManual) {
                this.ui.showToast('Failed to refresh: ' + error.message, 'error');
            }
        } finally {
            this.state.isLoading = false;
            this.state.isManualRefresh = false;

            if (refreshBtn) {
                refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
                refreshBtn.disabled = false;
                refreshBtn.classList.remove('refreshing');
            }
        }
    }

    getDeviceId() {
        let deviceId = localStorage.getItem('wse_device_id');
        if (!deviceId) {
            deviceId = 'device_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('wse_device_id', deviceId);
        }
        return deviceId;
    }

    async handleManualLogin() {
        const token = document.getElementById('authToken').value.trim();
        const centerName = document.getElementById('centerName').value.trim() || 'WSE Center';
        
        if (!token) {
            this.ui.showToast('Please enter a valid authentication token', 'error');
            return;
        }

        this.ui.showLoading('Validating token...');
        
        try {
            this.api = new API(token);
            await this.api.testConnection();
            
            this.state.authToken = token;
            this.state.centerName = centerName;
            
            // Save to localStorage as backup
            localStorage.setItem('wse_auth_token', token);
            localStorage.setItem('wse_center_name', centerName);
            
            await this.startApp();
        } catch (error) {
            console.error('Login failed:', error);
            this.ui.showToast('Invalid token. Please check and try again.', 'error');
            this.ui.showLoginScreen();
        }
    }

    async startApp() {
        console.log('Starting application...');
        
        if (!this.api) {
            this.api = new API(this.state.authToken);
        }
        
        this.ui.showMainApp(this.state.centerName);
        
        // Add status indicators
        this.addTokenStatusIndicator();
        this.updateSyncIndicator('connecting');
        
        // Load from cache ONLY - NO automatic refresh
        const cachedLoaded = await this.loadFromFirebase();
        
        if (cachedLoaded) {
            console.log('Displaying cached data');
            this.ui.generateDateTabs(this.state.currentMode, this.state.data);
            this.selectInitialDate();
            this.displayContent();
            this.updateLastUpdateTime();
            this.updateSyncIndicator('connected');
            
            // Check data age for notification only
            const dataAge = await this.checkDataAge();
            if (dataAge.ageInMinutes > 30) {
                this.ui.showToast(`Data is ${dataAge.ageInMinutes} minutes old. Consider refreshing.`, 'info');
            }
        } else {
            // No cache - must load everything
            console.log('No cache found - loading fresh data');
            this.updateSyncIndicator('syncing');
            await this.loadAllData(false);
            this.updateSyncIndicator('connected');
        }
        
        // Setup Firebase listeners for real-time updates
        this.setupFirebaseListeners();
    }

    async checkDataAge() {
        try {
            const db = firebase.firestore();
            const syncDoc = await db.collection('sync').doc('status').get();
            
            if (syncDoc.exists) {
                const data = syncDoc.data();
                const lastUpdate = data.lastUpdateTime?.toDate ? 
                    data.lastUpdateTime.toDate() : null;
                
                if (lastUpdate) {
                    const now = new Date();
                    const ageInMinutes = Math.floor((now - lastUpdate) / (1000 * 60));
                    
                    return {
                        lastUpdate: lastUpdate,
                        ageInMinutes: ageInMinutes,
                        needsUpdate: ageInMinutes > 10
                    };
                }
            }
            
            return {
                lastUpdate: null,
                ageInMinutes: 999,
                needsUpdate: true
            };
        } catch (error) {
            console.error('Error checking data age:', error);
            return {
                lastUpdate: null,
                ageInMinutes: 999,
                needsUpdate: false
            };
        }
    }

    setupFirebaseListeners() {
        if (!firebase.firestore) return;
        
        const db = firebase.firestore();
        
        // Listen to schedule updates
        this.unsubscribeSchedules = db.collection('schedules')
            .where('centerId', '==', CONFIG.CENTER_ID)
            .onSnapshot((snapshot) => {
                let hasChanges = false;
                
                snapshot.docChanges().forEach((change) => {
                    if (change.type === 'modified' || change.type === 'added') {
                        hasChanges = true;
                        const data = change.doc.data();
                        const parsedData = JSON.parse(data.data);
                        
                        // Update local data directly
                        if (data.mode === 'encounter') {
                            this.state.data.encounter[data.date] = parsedData;
                        } else if (data.mode === 'cc') {
                            this.state.data.cc[data.date] = parsedData;
                        }
                    }
                });
                
                if (hasChanges && !this.state.isFirstLoad) {
                    console.log('📊 Real-time data update received');
                    this.ui.updateDateTabs(this.state.data);
                    this.displayContent();
                    this.updateLastUpdateTime();
                    this.ui.showToast('Data updated', 'info');
                }
            }, (error) => {
                console.error('Error in Firebase listener:', error);
            });
        
        // Listen to sync status
        this.unsubscribeSync = db.collection('sync').doc('status')
            .onSnapshot((doc) => {
                if (doc.exists && !this.state.isFirstLoad) {
                    const data = doc.data();
                    if (data.isUpdating) {
                        this.updateSyncIndicator('syncing');
                    } else {
                        this.updateSyncIndicator('connected');
                    }
                }
            });
    }

    updateSyncIndicator(status) {
        const headerRight = document.querySelector('.header-right');
        if (!headerRight) return;
        
        let syncIndicator = document.getElementById('syncIndicator');
        if (!syncIndicator) {
            syncIndicator = document.createElement('div');
            syncIndicator.id = 'syncIndicator';
            syncIndicator.className = 'sync-status';
            
            const refreshBtn = document.getElementById('refreshBtn');
            headerRight.insertBefore(syncIndicator, refreshBtn);
        }
        
        syncIndicator.className = `sync-status ${status}`;
        
        let icon, text;
        switch(status) {
            case 'connected':
                icon = '🟢';
                text = 'Synced';
                break;
            case 'syncing':
                icon = '🔄';
                text = 'Syncing...';
                break;
            case 'connecting':
                icon = '🟡';
                text = 'Connecting...';
                break;
            default:
                icon = '⚪';
                text = 'Unknown';
        }
        
        syncIndicator.innerHTML = `${icon} <span>${text}</span>`;
    }

    addTokenStatusIndicator() {
        const headerRight = document.querySelector('.header-right');
        if (!headerRight) return;
        
        if (document.getElementById('tokenStatus')) return;
        
        const statusDiv = document.createElement('div');
        statusDiv.id = 'tokenStatus';
        statusDiv.className = 'token-status';
        
        const refreshBtn = document.getElementById('refreshBtn');
        headerRight.insertBefore(statusDiv, refreshBtn);
    }

    async loadFromFirebase() {
        try {
            console.log('Loading from Firebase cache...');
            
            const { encounter, cc } = await this.firebase.getAllSchedules();
            
            if (Object.keys(encounter).length > 0 || Object.keys(cc).length > 0) {
                this.state.data.encounter = encounter;
                this.state.data.cc = cc;
                
                // Load level summaries
                const uniqueStudents = this.extractUniqueStudents();
                const userIds = uniqueStudents.map(s => s.userId);
                
                if (userIds.length > 0) {
                    const cachedLevels = await this.firebase.getLevelSummaries(userIds);
                    this.state.levelSummaries = cachedLevels;
                }
                
                // Load self-booking
                const selfData = await this.firebase.getSelfBookingData();
                if (selfData) {
                    this.state.data.self = selfData;
                }
                
                console.log('Cache loaded successfully');
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Error loading cache:', error);
            return false;
        }
    }

    async loadAllData(forceRefresh = false) {
        const isBackground = !this.state.isFirstLoad && !forceRefresh && !this.state.isManualRefresh;
        
        // Only show loading screen for first load
        if (this.state.isFirstLoad) {
            this.ui.showLoading('Loading data for the first time...');
        }
        
        // Set loading flag to prevent concurrent refreshes
        this.state.isLoading = true;
        
        try {
            // Keep existing data and merge with new data
            const existingEncounterData = { ...this.state.data.encounter };
            const existingCCData = { ...this.state.data.cc };
            const existingLevelSummaries = { ...this.state.levelSummaries };
            
            // Only clear if manual refresh with force
            if (forceRefresh && this.state.isManualRefresh) {
                console.log('Manual force refresh - clearing cache...');
                await this.firebase.clearAllCache();
            }
            
            // Step 1: Fetch schedule
            console.log('Step 1: Fetching schedule...');
            const scheduleData = await this.fetchSchedule();
            
            // Step 2: Fetch class details and MERGE with existing
            console.log('Step 2: Fetching and merging class details...');
            await this.fetchClassDetailsWithLessons(scheduleData, existingEncounterData, existingCCData);
            
            // Step 3: Extract students and fetch level summaries
            console.log('Step 3: Processing students...');
            const uniqueStudents = this.extractUniqueStudents();
            await this.fetchAllLevelSummaries(uniqueStudents, existingLevelSummaries);
            
            // Step 4: Process lesson summaries for all students
            console.log('Step 4: Updating lesson progress...');
            await this.processAllLessonSummaries();
            
            // Step 5: Save everything to Firebase
            console.log('Step 5: Saving to Firebase...');
            await this.saveCompleteDataToFirebase();
            
            // Update UI
            this.updateLastUpdateTime();
            
            // Update tabs without losing current selection
            const currentDate = this.state.currentDate;
            this.ui.generateDateTabs(this.state.currentMode, this.state.data);
            
            // Restore date selection
            if (currentDate && Object.keys(this.state.data[this.state.currentMode] || {}).includes(currentDate)) {
                this.state.currentDate = currentDate;
                this.ui.setActiveDate(currentDate);
            } else if (!this.state.currentDate) {
                this.selectInitialDate();
            }
            
            // Always refresh display
            this.displayContent();
            
            console.log('✅ Data refresh completed');
            
            this.state.isFirstLoad = false;
            
        } catch (error) {
            console.error('Error loading data:', error);
            
            // Only show error toast for manual refresh
            if (this.state.isManualRefresh) {
                this.ui.showToast('Failed to refresh data: ' + error.message, 'error');
            }
            
            // For first load, show error screen
            if (this.state.isFirstLoad) {
                this.ui.showError('Failed to load data. Please refresh the page.');
            }
        } finally {
            this.state.isLoading = false;
        }
    }

    async fetchSchedule() {
        const today = new Date();
        const startDate = new Date(today);
        startDate.setDate(today.getDate() - CONFIG.DAYS_TO_FETCH_BEHIND);
        
        const scheduleData = await this.api.fetchSchedule(
            startDate.toISOString().split('T')[0]
        );
        
        const endDate = new Date(today);
        endDate.setDate(today.getDate() + CONFIG.DAYS_TO_FETCH_AHEAD);
        
        const filteredClasses = this.dataProcessor.filterClasses(
            scheduleData,
            startDate,
            endDate
        );
        
        console.log(`Found ${filteredClasses.length} classes`);
        return filteredClasses;
    }

    async fetchClassDetailsWithLessons(classes, existingEncounter = {}, existingCC = {}) {
        const classesByDate = {};
        classes.forEach(cls => {
            const date = cls.startDate.split('T')[0];
            if (!classesByDate[date]) {
                classesByDate[date] = [];
            }
            classesByDate[date].push(cls);
        });
        
        const dates = Object.keys(classesByDate).sort();
        
        for (const date of dates) {
            const dayClasses = classesByDate[date];
            
            // Start with existing data for this date or empty array
            this.state.data.encounter[date] = existingEncounter[date] || [];
            this.state.data.cc[date] = existingCC[date] || [];
            
            // Create maps of existing classes by ID for quick lookup
            const existingEncounterMap = new Map();
            const existingCCMap = new Map();
            
            if (existingEncounter[date]) {
                existingEncounter[date].forEach(cls => {
                    if (cls.classId) {
                        existingEncounterMap.set(cls.classId, cls);
                    }
                });
            }
            
            if (existingCC[date]) {
                existingCC[date].forEach(cls => {
                    if (cls.classId) {
                        existingCCMap.set(cls.classId, cls);
                    }
                });
            }
            
            // Clear arrays to rebuild with merged data
            this.state.data.encounter[date] = [];
            this.state.data.cc[date] = [];
            
            // Fetch in batches
            const batchSize = 8;
            for (let i = 0; i < dayClasses.length; i += batchSize) {
                const batch = dayClasses.slice(i, i + batchSize);
                
                await Promise.all(
                    batch.map(async (cls) => {
                        try {
                            const isCC = this.dataProcessor.isComplementaryClass(cls.categoriesAbbreviations);
                            const existingMap = isCC ? existingCCMap : existingEncounterMap;
                            
                            // Check if we have existing data with lesson progress
                            const existingClass = existingMap.get(cls.classId);
                            
                            const details = await this.api.fetchClassDetails(cls.classId);
                            if (!details) return;
                            
                            details.originalStartDate = cls.startDate;
                            details.categoriesAbbreviations = cls.categoriesAbbreviations;
                            
                            // Merge existing lesson summaries if available
                            if (existingClass && existingClass.bookedStudents) {
                                // Create a map of existing students with their lesson data
                                const existingStudentMap = new Map();
                                [...(existingClass.bookedStudents || []), ...(existingClass.standbyStudents || [])]
                                    .forEach(wrapper => {
                                        if (wrapper.student?.userId && wrapper.student.lessonSummaries) {
                                            existingStudentMap.set(wrapper.student.userId, wrapper.student.lessonSummaries);
                                        }
                                    });
                                
                                // Apply existing lesson summaries to new data
                                [...(details.bookedStudents || []), ...(details.standbyStudents || [])]
                                    .forEach(wrapper => {
                                        if (wrapper.student?.userId) {
                                            const existingLessonData = existingStudentMap.get(wrapper.student.userId);
                                            if (existingLessonData) {
                                                wrapper.student.lessonSummaries = existingLessonData;
                                            }
                                        }
                                    });
                            }
                            
                            if (isCC) {
                                this.state.data.cc[date].push(details);
                            } else {
                                this.state.data.encounter[date].push(details);
                            }
                        } catch (error) {
                            console.error(`Failed to fetch class ${cls.classId}:`, error);
                        }
                    })
                );
            }
        }
        
        console.log('Class details loaded and merged');
    }

    async fetchAllLevelSummaries(students, existingLevels = {}) {
        const batchSize = 10;
        let fetched = 0;
        
        // Start with existing level summaries
        this.state.levelSummaries = { ...existingLevels };
        
        for (let i = 0; i < students.length; i += batchSize) {
            const batch = students.slice(i, i + batchSize);
            
            await Promise.all(
                batch.map(async (student) => {
                    if (!student?.userId) return;
                    
                    try {
                        const levelData = await this.api.fetchLevelSummaries(student.userId);
                        this.state.levelSummaries[student.userId] = levelData;
                        fetched++;
                    } catch (error) {
                        console.error(`Failed to fetch levels for ${student.userId}:`, error);
                        // Keep existing data if fetch fails
                        if (!this.state.levelSummaries[student.userId] && existingLevels[student.userId]) {
                            this.state.levelSummaries[student.userId] = existingLevels[student.userId];
                        }
                    }
                })
            );
        }
        
        console.log(`Fetched ${fetched} level summaries`);
    }

    async processAllLessonSummaries() {
        let processed = 0;
        
        for (const [date, classes] of Object.entries(this.state.data.encounter)) {
            for (const cls of classes) {
                const unitNumber = cls.categories?.[0]?.attributes?.number;
                if (!unitNumber) continue;
                
                const allStudents = [...(cls.bookedStudents || []), ...(cls.standbyStudents || [])];
                
                for (const studentWrapper of allStudents) {
                    const student = studentWrapper.student;
                    if (!student?.userId) continue;
                    
                    student.isStandby = cls.standbyStudents?.includes(studentWrapper);
                    
                    const unitId = this.findUnitIdForStudent(student.userId, unitNumber);
                    if (!unitId) continue;
                    
                    try {
                        const lessonData = await this.api.fetchLessonSummaries(student.userId, unitId);
                        
                        if (!student.lessonSummaries) {
                            student.lessonSummaries = {};
                        }
                        student.lessonSummaries[unitNumber] = lessonData;
                        processed++;
                    } catch (error) {
                        console.error(`Failed to fetch lessons:`, error);
                        // Keep existing lesson data if fetch fails
                    }
                }
            }
        }
        
        console.log(`Processed ${processed} lesson summaries`);
    }

    async saveCompleteDataToFirebase() {
        try {
            // Save all schedules with embedded lesson data
            await this.firebase.saveAllSchedules(
                this.state.data.encounter,
                this.state.data.cc
            );
            
            // Save level summaries
            if (Object.keys(this.state.levelSummaries).length > 0) {
                await this.firebase.saveLevelSummaries(this.state.levelSummaries);
            }
            
            // Save self-booking if exists
            if (this.state.data.self.length > 0) {
                await this.firebase.saveSelfBookingData(this.state.data.self);
            }
            
            console.log('✅ All data saved to Firebase');
        } catch (error) {
            console.error('Failed to save to Firebase:', error);
        }
    }

    extractUniqueStudents() {
        const studentMap = new Map();
        
        [...Object.values(this.state.data.encounter), ...Object.values(this.state.data.cc)].forEach(classes => {
            classes.forEach(cls => {
                [...(cls.bookedStudents || []), ...(cls.standbyStudents || [])].forEach(s => {
                    if (s.student?.userId) {
                        studentMap.set(s.student.userId, s.student);
                    }
                });
            });
        });
        
        const uniqueStudents = Array.from(studentMap.values());
        this.state.studentDetails = Object.fromEntries(studentMap);
        
        return uniqueStudents;
    }

    findUnitIdForStudent(userId, unitNumber) {
        const levelData = this.state.levelSummaries[userId];
        if (!levelData?.elements) return null;
        
        for (const level of levelData.elements) {
            for (const unit of (level.units || [])) {
                if (String(unit.unitNumber) === String(unitNumber)) {
                    return unit.unitId;
                }
            }
        }
        
        return null;
    }

    selectInitialDate() {
        const dates = Object.keys(this.state.data[this.state.currentMode] || {}).sort();
        const today = this.dataProcessor.getTodayString();
        this.state.currentDate = dates.includes(today) ? today : dates[0];
    }

    async switchMode(mode) {
        console.log(`Switching to ${mode} mode`);
        
        this.state.currentMode = mode;
        this.ui.setActiveMode(mode);
        
        if (mode === 'self' && this.state.data.self.length === 0) {
            this.ui.showLoading('Loading self-booking data...');
            await this.loadSelfBookingData();
        }
        
        this.ui.generateDateTabs(mode, this.state.data);
        this.selectInitialDate();
        this.displayContent();
    }

    async loadSelfBookingData() {
        try {
            // Try cache first
            const cachedData = await this.firebase.getSelfBookingData();
            if (cachedData && !this.state.isManualRefresh) {
                this.state.data.self = cachedData;
                this.displayContent();
                return;
            }
            
            // Fetch fresh
            const contracts = await this.api.fetchContracts();
            const processedStudents = [];
            
            for (const contract of contracts) {
                if (!contract.studentId) continue;
                
                const contractDetails = await this.api.fetchStudentContractDetails(contract.studentId);
                const processed = this.dataProcessor.processSelfBookingStudent(
                    contract,
                    contractDetails,
                    CONFIG.RED_FLAG_PROFILES
                );
                
                if (processed && processed.hasSelfBooking) {
                    processedStudents.push(processed);
                }
            }
            
            this.state.data.self = processedStudents.sort((a, b) => {
                if (a.isHighlighted !== b.isHighlighted) {
                    return a.isHighlighted ? 1 : -1;
                }
                return a.name.localeCompare(b.name);
            });
            
            await this.firebase.saveSelfBookingData(this.state.data.self);
            
        } catch (error) {
            console.error('Error loading self-booking:', error);
            this.state.data.self = [];
        } finally {
            this.displayContent();
        }
    }

    selectDate(date) {
        this.state.currentDate = date;
        this.displayContent();
    }

    displayContent() {
        const processedData = this.dataProcessor.processDataForDisplay(
            this.state.currentMode,
            this.state.currentDate,
            this.state.data,
            this.state.levelSummaries
        );
        
        this.ui.displayContent(this.state.currentMode, processedData);
    }

    updateLastUpdateTime() {
        this.state.lastUpdate = new Date();
        const timeElement = document.getElementById('updateTime');
        if (timeElement) {
            timeElement.textContent = this.state.lastUpdate.toLocaleTimeString();
        }
    }

    logout() {
        // Cleanup listeners
        if (this.unsubscribeSchedules) {
            this.unsubscribeSchedules();
        }
        if (this.unsubscribeSync) {
            this.unsubscribeSync();
        }
        
        // Clear intervals
        if (this.tokenCheckInterval) {
            clearInterval(this.tokenCheckInterval);
            this.tokenCheckInterval = null;
        }
        
        // Unsubscribe from token updates
        if (this.tokenManager && this.tokenManager.unsubscribe) {
            this.tokenManager.unsubscribe();
        }
        
        // Clear state
        this.state.authToken = null;
        this.state.tokenStatus = 'checking';
        this.state.isFirstLoad = true;
        this.api = null;
        
        // Clear local storage
        localStorage.removeItem('wse_auth_token');
        localStorage.removeItem('wse_center_name');
        
        // Hide main app and show login
        document.getElementById('appContainer').style.display = 'none';
        document.getElementById('loginScreen').style.display = 'flex';
        
        // Clear token field
        const tokenField = document.getElementById('authToken');
        if (tokenField) {
            tokenField.value = '';
            tokenField.placeholder = 'Enter token manually or wait for automatic update...';
        }
        
        // Remove any existing status messages
        const statusMsg = document.querySelector('.token-status-message');
        if (statusMsg) {
            statusMsg.remove();
        }
        
        console.log('Logged out successfully');
    }
}

// Global function
window.selectDate = (date) => {
    if (window.wseApp) {
        window.wseApp.selectDate(date);
    }
};
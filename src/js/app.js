// app.js - Enhanced with complete Firebase sync and proper cache management
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
                cc: {}
            },
            studentDetails: {},
            levelSummaries: {},
            isLoading: false,
            lastUpdate: null,
            isFirstLoad: true,
            loadingProgress: 0,
            isManualRefresh: false,
            tokenStatus: 'checking',
            searchTerm: '',
            isAdminMode: false,
            hasValidCache: false,
            appStartTime: Date.now() // Track when app started
        };

        this.tokenCheckInterval = null;
        this.unsubscribeSchedules = null;
        this.unsubscribeSync = null;
        this.unsubscribeSettings = null;
        this.init();
    }

    async init() {
        console.log('Initializing WSE Tracker...');
        
        // Check if admin mode
        this.checkAdminMode();
        
        // Check if we have valid cached data FIRST
        await this.checkCacheStatus();
        
        // Initialize services
        await this.firebase.initialize();
        await this.tokenManager.initialize();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Setup Firebase listeners for settings
        this.setupSettingsListener();
        
        // Check for token availability
        await this.checkAndInitializeToken();
    }

    async checkCacheStatus() {
        try {
            // Check if this is a new session
            const sessionChecked = sessionStorage.getItem('wse_session_checked');
            const lastUpdateTime = localStorage.getItem('wse_last_update_time');
            const currentTime = Date.now();
            
            if (!sessionChecked) {
                // This is a new session/tab
                sessionStorage.setItem('wse_session_checked', 'true');
                
                if (lastUpdateTime) {
                    const updateAge = currentTime - parseInt(lastUpdateTime);
                    const updateAgeHours = updateAge / (1000 * 60 * 60);
                    
                    console.log(`First visit in this session. Last data update was ${Math.round(updateAgeHours * 60)} minutes ago`);
                    
                    // If data is less than 3 hours old, we have valid cache
                    if (updateAgeHours < 3) {
                        this.state.hasValidCache = true;
                        this.state.isFirstLoad = false;
                        console.log('Valid cache found, will use cached data without refresh');
                    } else {
                        // Data is old, need refresh on first load
                        this.state.hasValidCache = false;
                        this.state.isFirstLoad = true;
                        console.log('Cache is old (> 3 hours), will refresh data');
                    }
                } else {
                    // No cache exists at all
                    this.state.hasValidCache = false;
                    this.state.isFirstLoad = true;
                    console.log('No cache found, first time user');
                }
            } else {
                // Not first visit in this session - always use cache
                this.state.hasValidCache = true;
                this.state.isFirstLoad = false;
                
                if (lastUpdateTime) {
                    const updateAge = currentTime - parseInt(lastUpdateTime);
                    const updateAgeMinutes = Math.round(updateAge / (1000 * 60));
                    console.log(`Page refresh detected. Using existing data (${updateAgeMinutes} minutes old)`);
                }
            }
            
        } catch (error) {
            console.error('Error checking cache status:', error);
            this.state.hasValidCache = false;
            this.state.isFirstLoad = true;
        }
    }

    checkAdminMode() {
        // Check URL for admin mode - works with hash (#admin) or query param (?admin)
        const urlParams = new URLSearchParams(window.location.search);
        const hashAdmin = window.location.hash === '#admin';
        const paramAdmin = urlParams.get('admin') === 'true' || urlParams.has('admin');
        
        this.state.isAdminMode = hashAdmin || paramAdmin;
        
        if (this.state.isAdminMode) {
            console.log('🔧 Admin mode activated');
            document.body.classList.add('admin-mode');
            // Show admin settings panel
            const adminPanel = document.getElementById('adminSettingsPanel');
            if (adminPanel) {
                adminPanel.classList.remove('hidden');
            }
            // Show edit button in main app
            const editBtn = document.getElementById('editCenterBtn');
            if (editBtn) {
                editBtn.classList.remove('hidden');
            }
        }
    }

    async setupSettingsListener() {
        if (!firebase.firestore) return;
        
        const db = firebase.firestore();
        
        // Listen to settings changes
        this.unsubscribeSettings = db.collection('config').doc('settings')
            .onSnapshot((doc) => {
                if (doc.exists) {
                    const data = doc.data();
                    if (data.centerName && data.centerName !== this.state.centerName) {
                        console.log('Center name updated from Firebase:', data.centerName);
                        this.state.centerName = data.centerName;
                        
                        // Update display in all places
                        const centerDisplay = document.getElementById('centerDisplay');
                        if (centerDisplay) {
                            centerDisplay.textContent = data.centerName;
                        }
                        
                        const centerNameInput = document.getElementById('centerName');
                        if (centerNameInput) {
                            centerNameInput.value = data.centerName;
                        }
                        
                        const adminCenterNameInput = document.getElementById('adminCenterName');
                        if (adminCenterNameInput) {
                            adminCenterNameInput.value = data.centerName;
                        }
                        
                        const modalCenterNameInput = document.getElementById('modalCenterName');
                        if (modalCenterNameInput) {
                            modalCenterNameInput.value = data.centerName;
                        }
                        
                        // Save to localStorage
                        localStorage.setItem('wse_center_name', data.centerName);
                    }
                }
            }, (error) => {
                console.error('Error listening to settings:', error);
            });
    }

    async saveCenterNameToFirebase(centerName) {
        if (!firebase.firestore) return false;
        
        try {
            const db = firebase.firestore();
            await db.collection('config').doc('settings').set({
                centerName: centerName,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedBy: this.getDeviceId()
            }, { merge: true });
            
            console.log('Center name saved to Firebase:', centerName);
            return true;
        } catch (error) {
            console.error('Error saving center name to Firebase:', error);
            return false;
        }
    }

    async saveTokenToFirebase(token) {
        if (!this.state.isAdminMode) {
            console.warn('Token can only be saved in admin mode');
            return false;
        }
        
        if (!firebase.firestore || !token) return false;
        
        try {
            const db = firebase.firestore();
            
            // Calculate expiry (10 hours from now)
            const expiryTime = new Date(Date.now() + 10 * 60 * 60 * 1000);
            
            await db.collection('config').doc('wseToken').set({
                token: token,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                expiresAt: expiryTime,
                source: 'admin-manual',
                updatedBy: this.getDeviceId()
            });
            
            console.log('Token saved to Firebase successfully');
            this.ui.showToast('Token saved to Firebase', 'success');
            return true;
        } catch (error) {
            console.error('Error saving token to Firebase:', error);
            this.ui.showToast('Failed to save token to Firebase', 'error');
            return false;
        }
    }

    async loadCenterNameFromFirebase() {
        if (!firebase.firestore) return null;
        
        try {
            const db = firebase.firestore();
            const doc = await db.collection('config').doc('settings').get();
            
            if (doc.exists) {
                const data = doc.data();
                return data.centerName || null;
            }
            
            return null;
        } catch (error) {
            console.error('Error loading center name from Firebase:', error);
            return null;
        }
    }

    async checkAndInitializeToken() {
        this.ui.showLoading('Checking authentication...');
        
        try {
            // Load center name from Firebase first
            const firebaseCenterName = await this.loadCenterNameFromFirebase();
            if (firebaseCenterName) {
                this.state.centerName = firebaseCenterName;
                localStorage.setItem('wse_center_name', firebaseCenterName);
                
                // Update input fields
                const centerNameInput = document.getElementById('centerName');
                if (centerNameInput) {
                    centerNameInput.value = firebaseCenterName;
                }
                
                const adminCenterNameInput = document.getElementById('adminCenterName');
                if (adminCenterNameInput) {
                    adminCenterNameInput.value = firebaseCenterName;
                }
            } else {
                // Fallback to localStorage
                this.state.centerName = localStorage.getItem('wse_center_name') || 'WSE Center';
            }
            
            // Try localStorage FIRST (fastest) - only in non-admin mode
            const localToken = localStorage.getItem('wse_auth_token');
            
            if (localToken && !this.state.isAdminMode) {
                // For normal users, use localStorage token immediately
                console.log('Using cached token (normal mode)');
                this.state.authToken = localToken;
                this.state.tokenStatus = 'valid';
                this.api = new API(localToken);
                
                // Start app without setting up token monitoring yet
                await this.startApp();
                
                // Now setup token monitoring AFTER app has started
                // This prevents the Firebase listener from triggering a refresh
                setTimeout(() => {
                    this.setupTokenMonitoring();
                }, 2000);
                
                return;
            }
            
            // For admin mode OR no local token, try Firebase
            const token = await this.tokenManager.getToken();
            
            if (token) {
                this.state.authToken = token;
                this.state.tokenStatus = 'valid';
                this.api = new API(token);
                
                // Save to localStorage for faster next load
                localStorage.setItem('wse_auth_token', token);
                
                // Display token in admin panel
                if (this.state.isAdminMode) {
                    const tokenField = document.getElementById('authToken');
                    if (tokenField) {
                        tokenField.value = token;
                    }
                    
                    // Show token status
                    const validity = await this.tokenManager.checkTokenValidity();
                    this.updateAdminTokenStatus(validity);
                }
                
                await this.startApp();
                this.setupTokenMonitoring();
            } else {
                // No token found anywhere
                this.state.tokenStatus = 'missing';
                
                if (this.state.isAdminMode) {
                    // Admin mode: show login screen
                    this.showManualTokenEntry();
                } else {
                    // Normal mode: try localStorage one more time
                    if (localToken) {
                        console.log('Using cached token as fallback');
                        this.state.authToken = localToken;
                        this.api = new API(localToken);
                        await this.startApp();
                        this.setupTokenMonitoring();
                    } else {
                        this.ui.showError('No authentication token available. Please contact admin or add ?admin to URL');
                    }
                }
            }
        } catch (error) {
            console.error('Failed to get token:', error);
            this.state.tokenStatus = 'error';
            
            // Try localStorage as final fallback
            const localToken = localStorage.getItem('wse_auth_token');
            
            if (localToken && !this.state.isAdminMode) {
                console.log('Using cached token after error');
                this.state.authToken = localToken;
                this.api = new API(localToken);
                await this.startApp();
                this.setupTokenMonitoring();
            } else if (this.state.isAdminMode) {
                this.showManualTokenEntry();
            } else {
                this.ui.showError('Authentication failed. Add ?admin to URL to set token.');
            }
        }
    }

    updateAdminTokenStatus(validity) {
        const statusEl = document.getElementById('adminTokenStatus');
        if (!statusEl) return;
        
        if (validity.valid) {
            statusEl.innerHTML = `<i class="fas fa-check-circle text-green-600"></i> Token valid (${validity.ageInHours}h old)`;
            statusEl.className = 'text-xs text-green-600 mt-2';
        } else if (validity.expired) {
            statusEl.innerHTML = `<i class="fas fa-exclamation-circle text-red-600"></i> Token expired (${validity.ageInHours}h old)`;
            statusEl.className = 'text-xs text-red-600 mt-2';
        } else if (validity.needsRefresh) {
            statusEl.innerHTML = `<i class="fas fa-exclamation-triangle text-yellow-600"></i> Token needs refresh (${validity.ageInHours}h old)`;
            statusEl.className = 'text-xs text-yellow-600 mt-2';
        }
    }

    showManualTokenEntry() {
        if (!this.state.isAdminMode) {
            console.warn('Manual token entry only available in admin mode');
            return;
        }
        
        this.ui.showLoginScreen();
    }

    async requestTokenUpdate() {
        this.ui.showLoading('Requesting token update...');
        
        try {
            const updated = await this.tokenManager.requestTokenUpdate();
            
            if (updated) {
                this.ui.showToast('Token update triggered successfully', 'success');
                setTimeout(() => this.checkAndInitializeToken(), 3000);
            } else {
                this.ui.showToast('Manual update not available. Use GitHub Actions.', 'error');
                if (this.state.isAdminMode) this.ui.showLoginScreen();
            }
        } catch (error) {
            console.error('Token update request failed:', error);
            this.ui.showToast('Update request failed', 'error');
            if (this.state.isAdminMode) this.ui.showLoginScreen();
        }
    }

    setupTokenMonitoring() {
        this.tokenManager.subscribeToTokenUpdates((newToken) => {
            if (newToken && newToken !== this.state.authToken) {
                // Check how long app has been running
                const timeSinceStart = Date.now() - this.state.appStartTime;
                const minutesSinceStart = timeSinceStart / (1000 * 60);
                
                console.log(`Token update received ${Math.round(minutesSinceStart)} minutes after app start`);
                
                // Ignore token updates in the first 10 seconds after app start
                // These are usually just Firebase syncing the existing token
                if (timeSinceStart < 10000) {
                    console.log('Ignoring token update during initial app startup');
                    this.state.authToken = newToken;
                    this.api = new API(newToken);
                    
                    // Update token field in admin mode
                    if (this.state.isAdminMode) {
                        const tokenField = document.getElementById('authToken');
                        if (tokenField) {
                            tokenField.value = newToken;
                        }
                    }
                    return;
                }
                
                console.log('Token updated via Firebase');
                const oldToken = this.state.authToken;
                this.state.authToken = newToken;
                this.api = new API(newToken);
                
                // Update token field in admin mode
                if (this.state.isAdminMode) {
                    const tokenField = document.getElementById('authToken');
                    if (tokenField) {
                        tokenField.value = newToken;
                    }
                }
                
                // Only refresh data if token was actually invalid or expired
                if (oldToken && oldToken.substring(0, 20) !== newToken.substring(0, 20)) {
                    console.log('Token significantly changed - refreshing data');
                    this.performRefresh(true);
                    this.ui.showToast('Authentication token updated', 'info');
                } else {
                    console.log('Token refreshed but essentially the same - no data refresh needed');
                }
            }
        });
        
        this.tokenCheckInterval = setInterval(async () => {
            try {
                const tokenStatus = await this.tokenManager.checkTokenValidity();
                if (tokenStatus.expired && tokenStatus.ageInHours > 10) {
                    console.warn('Token expired, may need manual update');
                }
                this.updateTokenStatusDisplay(tokenStatus);
                
                // Update admin panel status
                if (this.state.isAdminMode) {
                    this.updateAdminTokenStatus(tokenStatus);
                }
            } catch (error) {
                console.error('Token check failed:', error);
            }
        }, 30 * 60 * 1000);
        
        this.tokenManager.checkTokenValidity().then(status => {
            this.updateTokenStatusDisplay(status);
            if (this.state.isAdminMode) {
                this.updateAdminTokenStatus(status);
            }
        });
    }

    updateTokenStatusDisplay(status) {
        if (!this.state.isAdminMode) return;
        
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
        const loginForm = document.getElementById('loginForm');
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleManualLogin();
        });

        // Save center name button in admin panel
        const saveCenterNameBtn = document.getElementById('saveCenterNameBtn');
        if (saveCenterNameBtn) {
            saveCenterNameBtn.addEventListener('click', async () => {
                const input = document.getElementById('adminCenterName');
                if (input && input.value.trim()) {
                    const newName = input.value.trim();
                    this.state.centerName = newName;
                    localStorage.setItem('wse_center_name', newName);
                    
                    // Save to Firebase
                    const saved = await this.saveCenterNameToFirebase(newName);
                    
                    if (saved) {
                        this.ui.showToast('Center name updated and synced', 'success');
                        
                        // Update display
                        const centerDisplay = document.getElementById('centerDisplay');
                        if (centerDisplay) {
                            centerDisplay.textContent = newName;
                        }
                        
                        // Update other inputs
                        const centerNameInput = document.getElementById('centerName');
                        if (centerNameInput) {
                            centerNameInput.value = newName;
                        }
                        
                        const modalCenterNameInput = document.getElementById('modalCenterName');
                        if (modalCenterNameInput) {
                            modalCenterNameInput.value = newName;
                        }
                    } else {
                        this.ui.showToast('Failed to sync center name', 'error');
                    }
                } else {
                    this.ui.showToast('Please enter a valid center name', 'warning');
                }
            });
        }

        // Edit center button in header
        const editCenterBtn = document.getElementById('editCenterBtn');
        if (editCenterBtn) {
            editCenterBtn.addEventListener('click', () => {
                const modal = document.getElementById('editCenterModal');
                const input = document.getElementById('modalCenterName');
                if (modal && input) {
                    input.value = this.state.centerName;
                    modal.classList.remove('hidden');
                }
            });
        }

        // Modal save button
        const saveEditBtn = document.getElementById('saveEditBtn');
        if (saveEditBtn) {
            saveEditBtn.addEventListener('click', async () => {
                const input = document.getElementById('modalCenterName');
                const modal = document.getElementById('editCenterModal');
                
                if (input && input.value.trim()) {
                    const newName = input.value.trim();
                    this.state.centerName = newName;
                    localStorage.setItem('wse_center_name', newName);
                    
                    // Save to Firebase
                    const saved = await this.saveCenterNameToFirebase(newName);
                    
                    if (saved) {
                        this.ui.showToast('Center name updated and synced', 'success');
                        
                        // Update display
                        const centerDisplay = document.getElementById('centerDisplay');
                        if (centerDisplay) {
                            centerDisplay.textContent = newName;
                        }
                        
                        // Close modal
                        if (modal) {
                            modal.classList.add('hidden');
                        }
                    } else {
                        this.ui.showToast('Failed to sync center name', 'error');
                    }
                } else {
                    this.ui.showToast('Please enter a valid center name', 'warning');
                }
            });
        }

        // Modal cancel button
        const cancelEditBtn = document.getElementById('cancelEditBtn');
        if (cancelEditBtn) {
            cancelEditBtn.addEventListener('click', () => {
                const modal = document.getElementById('editCenterModal');
                if (modal) {
                    modal.classList.add('hidden');
                }
            });
        }

        document.getElementById('logoutBtn').addEventListener('click', () => {
            if (this.state.isAdminMode) {
                this.logout();
            }
        });

        document.getElementById('refreshBtn')?.addEventListener('click', async () => {
            if (this.state.isLoading) {
                console.log('Refresh already in progress');
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
        
        const searchInput = document.getElementById('searchInput');
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.state.searchTerm = e.target.value;
                this.displayContent();
            }, 300);
        });
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
            
            // Save to localStorage
            localStorage.setItem('wse_auth_token', token);
            localStorage.setItem('wse_center_name', centerName);
            
            // Save to Firebase if admin mode
            if (this.state.isAdminMode) {
                await this.saveTokenToFirebase(token);
                await this.saveCenterNameToFirebase(centerName);
            }
            
            await this.startApp();
        } catch (error) {
            console.error('Login failed:', error);
            this.ui.showToast('Invalid token. Please check and try again.', 'error');
            this.ui.showLoginScreen();
        }
    }

    async performRefresh(isManual = false) {
        if (this.state.isLoading) {
            console.log('Refresh already in progress');
            return;
        }

        const refreshBtn = document.getElementById('refreshBtn');
        const db = firebase.firestore();
        
        try {
            const syncDoc = await db.collection('sync').doc('status').get();
            if (syncDoc.exists) {
                const data = syncDoc.data();
                
                if (data.isUpdating) {
                    const updateStartedAt = data.updateStartedAt?.toDate ? 
                        data.updateStartedAt.toDate() : null;
                    
                    if (updateStartedAt) {
                        const timeSinceStart = Date.now() - updateStartedAt.getTime();
                        
                        if (timeSinceStart > 20000) {
                            console.log('Clearing old lock (>20s)');
                            await db.collection('sync').doc('status').delete();
                        } else if (data.updatedBy !== this.getDeviceId()) {
                            this.ui.showToast('Another device is updating. Please wait...', 'warning');
                            setTimeout(() => {
                                if (refreshBtn) {
                                    refreshBtn.disabled = false;
                                    refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
                                }
                            }, 3000);
                            return;
                        }
                    } else {
                        await db.collection('sync').doc('status').delete();
                    }
                }
            }
            
            this.state.isLoading = true;
            this.state.isManualRefresh = isManual;

            if (refreshBtn) {
                refreshBtn.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i>';
                refreshBtn.disabled = true;
                refreshBtn.classList.add('refreshing');
            }

            if (isManual) {
                this.ui.showToast('Refreshing data...', 'info');
            }

            // Lock with current device ID and timestamp
            await db.collection('sync').doc('status').set({
                isUpdating: true,
                updatedBy: this.getDeviceId(),
                updateStartedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            if (this.api) {
                this.api.clearCache();
            }

            // Load fresh data (OPTIMIZED)
            await this.loadAllDataOptimized(true);

            // Update last sync time in Firebase
            await db.collection('sync').doc('status').set({
                isUpdating: false,
                lastUpdateTime: firebase.firestore.FieldValue.serverTimestamp(),
                updatedBy: this.getDeviceId()
            }, { merge: true });

            // Save last update time to localStorage
            localStorage.setItem('wse_last_update_time', Date.now().toString());

            // Immediately update UI from Firebase time
            await this.updateLastUpdateTime();

            if (isManual) {
                this.ui.showToast('✅ Data refreshed successfully', 'success');
            }

        } catch (error) {
            console.error('Refresh failed:', error);
            
            try {
                await db.collection('sync').doc('status').delete();
            } catch (e) {
                console.error('Failed to clear lock:', e);
            }
            
            if (isManual) {
                this.ui.showToast('Failed to refresh: ' + error.message, 'error');
            }
        } finally {
            this.state.isLoading = false;
            this.state.isManualRefresh = false;

            if (refreshBtn) {
                refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
                refreshBtn.disabled = false;
                refreshBtn.classList.remove('refreshing', 'waiting');
                refreshBtn.title = 'Refresh data from server';
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

    async startApp() {
        console.log('Starting application...');
        
        if (!this.api) {
            this.api = new API(this.state.authToken);
        }
        
        this.ui.showMainApp(this.state.centerName);
        
        // Show/hide logout button based on admin mode
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            if (this.state.isAdminMode) {
                logoutBtn.style.display = 'flex';
                console.log('Logout button visible (admin mode)');
            } else {
                logoutBtn.style.display = 'none';
                console.log('Logout button hidden (normal mode)');
            }
        }
        
        // Show edit button if admin mode
        if (this.state.isAdminMode) {
            const editBtn = document.getElementById('editCenterBtn');
            if (editBtn) {
                editBtn.classList.remove('hidden');
            }
            this.addTokenStatusIndicator();
        }
        
        this.updateSyncIndicator('connecting');
        
        // Load from cache FIRST - ALWAYS try cache first
        const cachedLoaded = await this.loadFromFirebase();
        
        if (cachedLoaded) {
            console.log('Displaying cached data');
            this.ui.generateDateTabs(this.state.currentMode, this.state.data);
            this.selectInitialDate();
            this.displayContent();
            
            // Update time from Firebase
            await this.updateLastUpdateTime();
            
            this.updateSyncIndicator('connected');
            
            // Check if this is TRULY a first load (new session)
            const sessionChecked = sessionStorage.getItem('wse_data_loaded_in_session');
            
            if (!sessionChecked) {
                // First load in this session - check data age
                sessionStorage.setItem('wse_data_loaded_in_session', 'true');
                
                const dataAge = await this.checkDataAge();
                
                if (dataAge.ageInMinutes > 180) {
                    console.log(`First session load with old data (${Math.round(dataAge.ageInMinutes / 60)} hours), refreshing...`);
                    this.ui.showToast(`Data is ${Math.floor(dataAge.ageInMinutes / 60)} hours old. Loading fresh data...`, 'info');
                    this.updateSyncIndicator('syncing');
                    await this.loadAllDataOptimized(false);
                    this.updateSyncIndicator('connected');
                    
                    // Update cache time
                    localStorage.setItem('wse_last_update_time', Date.now().toString());
                } else {
                    console.log(`First session load with fresh data (${Math.round(dataAge.ageInMinutes)} minutes old)`);
                }
            } else {
                // Not first load in session - just use cache
                console.log('Page refresh within session - using cached data without refresh');
                
                // Still check age for info only
                const dataAge = await this.checkDataAge();
                if (dataAge.ageInMinutes > 180) {
                    this.ui.showToast(`Data is ${Math.floor(dataAge.ageInMinutes / 60)} hours old. Click refresh to update.`, 'info');
                }
            }
        } else {
            // No cache available - must load fresh data
            console.log('No cache available - loading fresh data');
            sessionStorage.setItem('wse_data_loaded_in_session', 'true');
            this.updateSyncIndicator('syncing');
            await this.loadAllDataOptimized(false);
            this.updateSyncIndicator('connected');
            
            // Save update time
            localStorage.setItem('wse_last_update_time', Date.now().toString());
        }
        
        // Setup Firebase listeners
        this.setupFirebaseListeners();
        
        // Mark as no longer first load for future operations
        this.state.isFirstLoad = false;
    }

    async checkDataAge() {
        try {
            // First check Firebase for actual last update time
            const db = firebase.firestore();
            const syncDoc = await db.collection('sync').doc('status').get();
            
            if (syncDoc.exists) {
                const data = syncDoc.data();
                const lastUpdate = data.lastUpdateTime?.toDate ? 
                    data.lastUpdateTime.toDate() : null;
                
                if (lastUpdate) {
                    const now = new Date();
                    const ageInMinutes = Math.floor((now - lastUpdate) / (1000 * 60));
                    
                    console.log(`Firebase reports last update: ${lastUpdate.toLocaleTimeString()} (${ageInMinutes} minutes ago)`);
                    
                    return {
                        lastUpdate: lastUpdate,
                        ageInMinutes: ageInMinutes,
                        needsUpdate: ageInMinutes > 180 // 3 hours
                    };
                }
            }
            
            // Fallback to localStorage
            const localUpdateTime = localStorage.getItem('wse_last_update_time');
            if (localUpdateTime) {
                const lastUpdate = new Date(parseInt(localUpdateTime));
                const now = new Date();
                const ageInMinutes = Math.floor((now - lastUpdate) / (1000 * 60));
                
                console.log(`Local storage reports last update: ${lastUpdate.toLocaleTimeString()} (${ageInMinutes} minutes ago)`);
                
                return {
                    lastUpdate: lastUpdate,
                    ageInMinutes: ageInMinutes,
                    needsUpdate: ageInMinutes > 180
                };
            }
            
            // No data age information available
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
                needsUpdate: false // Don't force update on error
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
                        // Check if this is actually new data or just initial load
                        const data = change.doc.data();
                        const existingData = data.mode === 'encounter' ? 
                            this.state.data.encounter[data.date] : 
                            this.state.data.cc[data.date];
                        
                        // Only consider it a change if data is different
                        if (!existingData || JSON.stringify(existingData) !== data.data) {
                            hasChanges = true;
                            const parsedData = JSON.parse(data.data);
                            
                            if (data.mode === 'encounter') {
                                this.state.data.encounter[data.date] = parsedData;
                            } else if (data.mode === 'cc') {
                                this.state.data.cc[data.date] = parsedData;
                            }
                        }
                    }
                });
                
                // Only update UI if there are real changes and not during initial load
                const sessionDataLoaded = sessionStorage.getItem('wse_data_loaded_in_session');
                if (hasChanges && sessionDataLoaded && !this.state.isLoading) {
                    console.log('📊 Real-time data update received');
                    this.ui.updateDateTabs(this.state.data);
                    this.displayContent();
                    
                    // Update time from Firebase
                    this.updateLastUpdateTime();
                    
                    this.ui.showToast('Data updated', 'info');
                }
            }, (error) => {
                console.error('Error in Firebase listener:', error);
            });
        
        // Listen to sync status for time updates
        this.unsubscribeSync = db.collection('sync').doc('status')
            .onSnapshot((doc) => {
                if (doc.exists) {
                    const data = doc.data();
                    const refreshBtn = document.getElementById('refreshBtn');
                    
                    // Update time whenever it changes in Firebase
                    if (data.lastUpdateTime && !this.state.isFirstLoad) {
                        const newTime = data.lastUpdateTime.toDate();
                        const currentTime = this.state.lastUpdate;
                        
                        // Only update if time is different
                        if (!currentTime || newTime.getTime() !== currentTime.getTime()) {
                            console.log('⏰ Update time synced from Firebase');
                            this.state.lastUpdate = newTime;
                            const timeElement = document.getElementById('updateTime');
                            if (timeElement) {
                                timeElement.textContent = newTime.toLocaleTimeString();
                            }
                            // Update localStorage with new time
                            localStorage.setItem('wse_last_update_time', newTime.getTime().toString());
                        }
                    }
                    
                    if (data.isUpdating && data.updatedBy !== this.getDeviceId()) {
                        this.updateSyncIndicator('syncing');
                        
                        if (refreshBtn && !this.state.isLoading) {
                            refreshBtn.disabled = true;
                            refreshBtn.title = 'Another device is updating...';
                            refreshBtn.innerHTML = '<i class="fas fa-hourglass-half"></i>';
                            refreshBtn.classList.add('waiting');
                        }
                    } else if (data.isUpdating && data.updatedBy === this.getDeviceId()) {
                        this.updateSyncIndicator('syncing');
                    } else {
                        this.updateSyncIndicator('connected');
                        
                        if (refreshBtn && !this.state.isLoading) {
                            refreshBtn.disabled = false;
                            refreshBtn.title = 'Refresh data from server';
                            refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
                            refreshBtn.classList.remove('waiting');
                        }
                    }
                }
            });
    }

    async updateLastUpdateTime() {
        try {
            const db = firebase.firestore();
            const syncDoc = await db.collection('sync').doc('status').get();
            
            if (syncDoc.exists) {
                const data = syncDoc.data();
                const lastUpdate = data.lastUpdateTime?.toDate ? 
                    data.lastUpdateTime.toDate() : null;
                
                if (lastUpdate) {
                    this.state.lastUpdate = lastUpdate;
                    const timeElement = document.getElementById('updateTime');
                    if (timeElement) {
                        timeElement.textContent = lastUpdate.toLocaleTimeString();
                    }
                    console.log('✅ Time updated from Firebase:', lastUpdate.toLocaleTimeString());
                    return;
                }
            }
        } catch (error) {
            console.error('Error getting sync time:', error);
        }
        
        // Fallback to local time
        this.state.lastUpdate = new Date();
        const timeElement = document.getElementById('updateTime');
        if (timeElement) {
            timeElement.textContent = this.state.lastUpdate.toLocaleTimeString();
        }
    }

    updateSyncIndicator(status) {
        if (!this.state.isAdminMode) return;
        
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
        if (!this.state.isAdminMode) return;
        
        const headerRight = document.querySelector('.header-right');
        if (!headerRight || document.getElementById('tokenStatus')) return;
        
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
                
                const uniqueStudents = this.extractUniqueStudents();
                const userIds = uniqueStudents.map(s => s.userId);
                
                if (userIds.length > 0) {
                    const cachedLevels = await this.firebase.getLevelSummaries(userIds);
                    this.state.levelSummaries = cachedLevels;
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

    // ========== OPTIMIZED LOADING FUNCTIONS ==========
    
    async loadAllDataOptimized(forceRefresh = false) {
        const isBackground = !this.state.isFirstLoad && !forceRefresh && !this.state.isManualRefresh;
        
        // Show appropriate loading message
        if (this.state.isFirstLoad && !this.state.hasValidCache) {
            this.ui.showLoading('Loading data for the first time...');
        } else if (forceRefresh && this.state.isManualRefresh) {
            // Don't show loading overlay for manual refresh - toast is enough
        } else if (!isBackground) {
            this.ui.showLoading('Loading data...');
        }
        
        this.state.isLoading = true;
        
        try {
            const existingEncounterData = { ...this.state.data.encounter };
            const existingCCData = { ...this.state.data.cc };
            const existingLevelSummaries = { ...this.state.levelSummaries };
            
            if (forceRefresh && this.state.isManualRefresh) {
                console.log('Manual force refresh - clearing cache...');
                await this.firebase.clearAllCache();
            }
            
            console.log('Step 1: Fetching schedule...');
            const scheduleData = await this.fetchSchedule();
            
            console.log('Step 2: Fetching class details (optimized)...');
            await this.fetchClassDetailsOptimized(scheduleData, existingEncounterData, existingCCData);
            
            console.log('Step 3: Processing students (optimized)...');
            const uniqueStudents = this.extractUniqueStudents();
            await this.fetchAllLevelSummariesOptimized(uniqueStudents, existingLevelSummaries);
            
            console.log('Step 4: Updating lesson progress (optimized)...');
            await this.processAllLessonSummariesOptimized();
            
            console.log('Step 5: Saving to Firebase...');
            await this.saveCompleteDataToFirebase();
            
            await this.updateLastUpdateTime();
            
            // Save last update time to localStorage
            localStorage.setItem('wse_last_update_time', Date.now().toString());
            
            const currentDate = this.state.currentDate;
            this.ui.generateDateTabs(this.state.currentMode, this.state.data);
            
            if (currentDate && Object.keys(this.state.data[this.state.currentMode] || {}).includes(currentDate)) {
                this.state.currentDate = currentDate;
                this.ui.setActiveDate(currentDate);
            } else if (!this.state.currentDate) {
                this.selectInitialDate();
            }
            
            this.displayContent();
            
            console.log('✅ Data refresh completed (optimized)');
            
            // Mark as no longer first load
            this.state.isFirstLoad = false;
            this.state.hasValidCache = true;
            
        } catch (error) {
            console.error('Error loading data:', error);
            
            if (this.state.isManualRefresh) {
                this.ui.showToast('Failed to refresh data: ' + error.message, 'error');
            }
            
            if (this.state.isFirstLoad && !this.state.hasValidCache) {
                this.ui.showError('Failed to load data. Please refresh the page.');
            }
        } finally {
            this.state.isLoading = false;
        }
    }

    async fetchClassDetailsOptimized(classes, existingEncounter = {}, existingCC = {}) {
        console.log(`Fetching details for ${classes.length} classes (parallel)...`);
        
        const fetchPromises = classes.map(async (cls) => {
            try {
                const details = await this.api.fetchClassDetails(cls.classId);
                if (!details) return null;
                
                details.originalStartDate = cls.startDate;
                details.categoriesAbbreviations = cls.categoriesAbbreviations;
                details.numberOfSeats = cls.numberOfSeats; // Add numberOfSeats for Social Club detection
                
                const date = cls.startDate.split('T')[0];
                const isCC = this.dataProcessor.isComplementaryClass(cls.categoriesAbbreviations);
                
                return { date, isCC, details };
            } catch (error) {
                console.error(`Failed to fetch class ${cls.classId}:`, error);
                return null;
            }
        });
        
        // Execute ALL fetches in parallel with limit
        const results = await this.limitConcurrency(fetchPromises, CONFIG.MAX_PARALLEL_REQUESTS || 20);
        
        Object.keys(this.state.data.encounter).forEach(date => {
            this.state.data.encounter[date] = [];
        });
        Object.keys(this.state.data.cc).forEach(date => {
            this.state.data.cc[date] = [];
        });
        
        results.forEach(result => {
            if (result && result.details) {
                const { date, isCC, details } = result;
                
                if (!this.state.data.encounter[date]) this.state.data.encounter[date] = [];
                if (!this.state.data.cc[date]) this.state.data.cc[date] = [];
                
                if (isCC) {
                    this.state.data.cc[date].push(details);
                } else {
                    this.state.data.encounter[date].push(details);
                }
            }
        });
        
        console.log('Class details loaded (optimized)');
    }

    async fetchAllLevelSummariesOptimized(students, existingLevels = {}) {
        let fetched = 0;
        
        this.state.levelSummaries = { ...existingLevels };
        
        const fetchPromises = students.map(async (student) => {
            if (!student?.userId) return null;
            
            try {
                const levelData = await this.api.fetchLevelSummaries(student.userId);
                return { userId: student.userId, levelData };
            } catch (error) {
                console.error(`Failed to fetch levels for ${student.userId}:`, error);
                return null;
            }
        });
        
        const results = await this.limitConcurrency(fetchPromises, CONFIG.MAX_PARALLEL_REQUESTS || 20);
        
        results.forEach(result => {
            if (result && result.levelData) {
                this.state.levelSummaries[result.userId] = result.levelData;
                fetched++;
            }
        });
        
        console.log(`Fetched ${fetched} level summaries (optimized)`);
    }

    async processAllLessonSummariesOptimized() {
        const allPromises = [];
        
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
                    
                    allPromises.push(
                        this.api.fetchLessonSummaries(student.userId, unitId)
                            .then(lessonData => {
                                if (!student.lessonSummaries) {
                                    student.lessonSummaries = {};
                                }
                                student.lessonSummaries[unitNumber] = lessonData;
                                return true;
                            })
                            .catch(error => {
                                console.error(`Failed to fetch lessons:`, error);
                                return false;
                            })
                    );
                }
            }
        }
        
        const results = await this.limitConcurrency(allPromises, CONFIG.MAX_PARALLEL_REQUESTS || 20);
        const processed = results.filter(r => r === true).length;
        
        console.log(`Processed ${processed} lesson summaries (optimized)`);
    }

    async limitConcurrency(promises, limit) {
        const results = [];
        const executing = [];
        
        for (const promise of promises) {
            const p = Promise.resolve().then(() => promise);
            results.push(p);
            
            if (promises.length >= limit) {
                executing.push(p);
                
                if (executing.length >= limit) {
                    await Promise.race(executing);
                    executing.splice(executing.findIndex(ep => ep === p), 1);
                }
            }
        }
        
        return Promise.all(results);
    }

    async loadAllData(forceRefresh = false) {
        return this.loadAllDataOptimized(forceRefresh);
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

    async saveCompleteDataToFirebase() {
        try {
            await this.firebase.saveAllSchedules(
                this.state.data.encounter,
                this.state.data.cc
            );
            
            if (Object.keys(this.state.levelSummaries).length > 0) {
                await this.firebase.saveLevelSummaries(this.state.levelSummaries);
            }
            
            console.log('All data saved to Firebase');
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
        
        if (!this.state.searchTerm.trim()) {
            this.ui.generateDateTabs(mode, this.state.data);
            this.selectInitialDate();
        }
        this.displayContent();
    }

    selectDate(date) {
        this.state.currentDate = date;
        this.displayContent();
    }

    displayContent() {
        if (this.state.searchTerm.trim()) {
            this.ui.toggleDateTabs(false);
            const searchResults = this.dataProcessor.processGlobalSearch(
                this.state.data,
                this.state.levelSummaries,
                this.state.searchTerm
            );
            this.ui.displayGlobalSearchResults(searchResults);
        } else {
            this.ui.toggleDateTabs(true);
            const processedData = this.dataProcessor.processDataForDisplay(
                this.state.currentMode,
                this.state.currentDate,
                this.state.data,
                this.state.levelSummaries
            );
            // Pass the current date as third parameter
            this.ui.displayContent(this.state.currentMode, processedData, this.state.currentDate);
        }
    }
    
    // Back to simpler version without lesson/workbook status collection
    async showStudentProfile(userId) {
        const student = this.state.studentDetails[userId];
        const levelData = this.state.levelSummaries[userId];
        
        if (!student || !levelData) {
            this.ui.showToast('Student details not found', 'error');
            return;
        }
        
        const studentName = student.firstName;
        const history = [];
        
        if (levelData && levelData.elements) {
            levelData.elements.forEach(level => {
                (level.units || []).forEach(unit => {
                    const result = unit.encounterSummary?.result || "Pending";
                    if (result !== "Pending") {
                        const overallScores = this.dataProcessor.formatScores(
                            unit.activitySummary?.overall, 
                            unit.workbookSummary?.overall
                        );
                        
                        // Extract completion date
                        let completionDate = 'N/A';
                        if (unit.encounterSummary?.dateCompletion) {
                            const dateStr = unit.encounterSummary.dateCompletion;
                            completionDate = dateStr.split('T')[0]; // Get only the date part
                        }
                        
                        // Extract feedback
                        let feedback = null;
                        if (unit.encounterSummary?.feedback) {
                            feedback = unit.encounterSummary.feedback;
                        }
                        
                        history.push({
                            unit: `Unit ${unit.unitNumber}`,
                            result: result,
                            teacher: unit.encounterSummary?.teacherFullName || 'N/A',
                            overall: overallScores,
                            score: unit.encounterSummary?.score !== undefined && unit.encounterSummary?.score !== null 
                                ? unit.encounterSummary.score.toFixed(1) 
                                : 'N/A',
                            date: completionDate,
                            feedback: feedback // Add feedback to history
                        });
                    }
                });
            });
        }
        
        history.sort((a, b) => {
            const unitA = parseInt(a.unit.replace('Unit ', ''));
            const unitB = parseInt(b.unit.replace('Unit ', ''));
            return unitB - unitA;
        });

        this.ui.showStudentProfileModal({
            name: studentName,
            history: history
        });
    }

    // New function to show feedback
    showFeedback(userId, unitNumber) {
        const levelData = this.state.levelSummaries[userId];
        if (!levelData?.elements) {
            this.ui.showToast('No feedback available', 'info');
            return;
        }
        
        for (const level of levelData.elements) {
            for (const unit of (level.units || [])) {
                if (String(unit.unitNumber) === String(unitNumber)) {
                    const feedback = unit.encounterSummary?.feedback;
                    if (feedback) {
                        this.ui.showFeedbackModal(feedback);
                        return;
                    }
                }
            }
        }
        
        this.ui.showToast('No feedback available for this unit', 'info');
    }

    logout() {
        if (!this.state.isAdminMode) {
            console.warn('Logout only available in admin mode');
            return;
        }
        
        if (this.unsubscribeSchedules) this.unsubscribeSchedules();
        if (this.unsubscribeSync) this.unsubscribeSync();
        if (this.unsubscribeSettings) this.unsubscribeSettings();
        if (this.tokenCheckInterval) clearInterval(this.tokenCheckInterval);
        if (this.tokenManager?.unsubscribe) this.tokenManager.unsubscribe();
        
        // Don't clear cache on logout - keep it for next session
        // Only clear session-specific data
        
        this.state = { ...this.state, authToken: null, tokenStatus: 'checking', isFirstLoad: true };
        this.api = null;
        
        localStorage.removeItem('wse_auth_token');
        // Don't remove center name or update time
        
        document.getElementById('appContainer').style.display = 'none';
        document.getElementById('loginScreen').style.display = 'flex';
        
        const tokenField = document.getElementById('authToken');
        if (tokenField) tokenField.value = '';
        
        const adminPanel = document.getElementById('adminSettingsPanel');
        if (adminPanel) adminPanel.classList.add('hidden');
        
        console.log('Logged out successfully');
    }
}

// Global functions
window.selectDate = (date) => window.wseApp?.selectDate(date);
window.showStudentProfile = (userId) => window.wseApp?.showStudentProfile(userId);
window.showFeedback = (userId, unitNumber) => window.wseApp?.showFeedback(userId, unitNumber);

// Reset sync status function (admin only)
window.resetSyncStatus = async () => {
    if (window.wseApp?.state?.isAdminMode) {
        if (confirm('Reset sync status? This will clear any stuck updates.')) {
            try {
                const db = firebase.firestore();
                await db.collection('sync').doc('status').set({
                    isUpdating: false,
                    lastReset: firebase.firestore.FieldValue.serverTimestamp(),
                    resetBy: window.wseApp?.getDeviceId() || 'unknown'
                }, { merge: true });
                
                window.wseApp?.ui?.showToast('Sync status reset', 'success');
                
                const refreshBtn = document.getElementById('refreshBtn');
                if (refreshBtn) {
                    refreshBtn.disabled = false;
                    refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
                }
            } catch (error) {
                console.error('Failed to reset sync:', error);
                alert('Failed to reset sync: ' + error.message);
            }
        }
    } else {
        console.warn('Reset sync status only available in admin mode');
    }
};
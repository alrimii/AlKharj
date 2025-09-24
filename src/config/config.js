// config.js - المسار: /src/config/config.js

export const CONFIG = {
    API_BASE_URL: 'https://world.wallstreetenglish.com/api',
    CENTER_ID: '0403a03c-0ea3-4185-8ace-d27e3b70e1e3',
    
    DAYS_TO_FETCH_AHEAD: 5,
    DAYS_TO_FETCH_BEHIND: 2,
    TIMEZONE_OFFSET: 3,
    
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000,
    REQUEST_TIMEOUT: 15000,
    // Increased cache timeout from 10 minutes to 4 hours for better performance
    CACHE_TIMEOUT: 4 * 60 * 60 * 1000,
    BATCH_SIZE: 15,
    MAX_PARALLEL_REQUESTS: 8,
    
    FIREBASE_CONFIG: {
        apiKey: "AIzaSyA-ElnN5PxDalms3CcC3N9w0F69WRIQWzY",
        authDomain: "wse-tracker.firebaseapp.com",
        projectId: "wse-tracker",
        storageBucket: "wse-tracker.firebasestorage.app",
        messagingSenderId: "129262039821",
        appId: "1:129262039821:web:3c9b9b127c3b7309cc3644",
        measurementId: "G-TS77PDFWGV"
    },
    
    AUTO_REFRESH_INTERVAL: 10 * 60 * 1000,
    USE_FIREBASE_CACHE: true,
    
    STATUS_COLORS: {
        COMPLETE: '#c6efce',
        NOT_STARTED: '#ffffff',
        HIGH_PERCENT: '#ffeb9c',
        LOW_PERCENT: '#ffeb9c',
        CONTINUE: '#c6efce',
        REPEAT: '#ffcccc',
        NO_SHOW: '#ff99cc',
        PENDING: '#ffffff'
    }
};


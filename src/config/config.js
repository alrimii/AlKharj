// config.js - المسار: /src/config/config.js

export const CONFIG = {
    API_BASE_URL: 'https://world.wallstreetenglish.com/api',
    CENTER_ID: '6aa32e2e-585f-4ba2-81db-0db65654d48e',
    
    DAYS_TO_FETCH_AHEAD: 7,
    DAYS_TO_FETCH_BEHIND: 3,
    TIMEZONE_OFFSET: 3,
    
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000,
    REQUEST_TIMEOUT: 15000,
    // Increased cache timeout from 10 minutes to 4 hours for better performance
    CACHE_TIMEOUT: 4 * 60 * 60 * 1000,
    BATCH_SIZE: 40,
    MAX_PARALLEL_REQUESTS: 30,
    
    FIREBASE_CONFIG: {
        apiKey: "AIzaSyCX-PygcH6Wxw5VDHeTL36hOnttc1go7nY",
        authDomain: "alkharj-daac4.firebaseapp.com",
        projectId: "alkharj-daac4",
        storageBucket: "alkharj-daac4.firebasestorage.app",
        messagingSenderId: "301844728095",
        appId: "1:301844728095:web:628c166221ad44d41e882a"
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


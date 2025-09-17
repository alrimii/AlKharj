// config.js - Path: /src/config/config.js

export const CONFIG = {
    API_BASE_URL: 'https://world.wallstreetenglish.com/api',
    CONTRACT_API_URL: 'https://contractapi.wallstreetenglish.com', // Old URL - kept for reference
    NEW_CONTRACT_API_URL: 'https://api.wallstreetenglish.com/contractapi', // NEW CORRECT URL
    CENTER_ID: '0403a03c-0ea3-4185-8ace-d27e3b70e1e3',
    
    DAYS_TO_FETCH_AHEAD: 5,
    DAYS_TO_FETCH_BEHIND: 2,
    TIMEZONE_OFFSET: 3,
    
    RED_FLAG_PROFILES: [
        "d9b01911-6dae-41c5-8d51-8f2330befc92",
        "f9b60c7f-a520-4845-a7b3-e766b7da9bfa",
        "68fd03b7-fcea-44c0-ad20-835ca395efc7"
    ],
    
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000,
    REQUEST_TIMEOUT: 15000,
    CACHE_TIMEOUT: 10 * 60 * 1000,
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
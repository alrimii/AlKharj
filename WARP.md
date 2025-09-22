# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

WSE Tracker is a real-time class management and tracking system for Wall Street English centers. It provides a web-based dashboard for monitoring Encounter and CC (Complementary Class) sessions, student attendance, and progress tracking.

## Development Commands

### Install dependencies
```bash
npm install --legacy-peer-deps
```

### Run local development server (backend)
```bash
cd wse-backend
npm install
npm start
# Server runs on http://localhost:3001
```

### Deploy to Netlify
```bash
# Automatic deployment on push to main branch
# Manual deployment:
netlify deploy --prod
```

### Trigger token update manually (GitHub Actions)
```bash
# Via GitHub UI: Actions > Update WSE Token > Run workflow
# Or via GitHub CLI:
gh workflow run update-token.yml
```

### Check Firebase connection
```bash
# In browser console while on the app:
# Press Ctrl+Shift+D for system debug info
```

## Architecture Overview

### Frontend Architecture
The application is a single-page app with vanilla JavaScript modules:

- **Entry Point**: `index.html` - Contains login screen and main application UI structure
- **Main Controller**: `src/js/app.js` - Orchestrates the entire application flow, manages state, handles authentication, and coordinates between all services
- **Token Management**: `src/js/tokenManager.js` - Handles WSE API token retrieval from Firebase, monitors token validity, and manages automatic token refresh
- **Firebase Service**: `src/js/firebase-service.js` - Manages Firebase Firestore operations for caching schedule data and real-time synchronization across devices
- **API Service**: `src/js/api.js` - Handles all WSE API calls with retry logic, batching, and error handling
- **Data Processor**: `src/js/data.js` - Processes and transforms raw API data into UI-ready format, calculates statistics
- **UI Manager**: `src/js/ui.js` - Manages all DOM manipulation, renders schedules, handles user interactions

### Backend Services

1. **Express Proxy Server** (`wse-backend/server.js`)
   - CORS proxy for WSE Contract API
   - Runs locally or can be deployed separately
   - Endpoints: `/api/contracts`, `/api/students/:studentId/contracts`

2. **Netlify Functions** (`netlify/functions/updateToken.js`)
   - Serverless function for manual token updates
   - Protected with Bearer token authentication
   - Updates token in Firebase Firestore

3. **GitHub Actions** (`.github/workflows/update-token.yml`)
   - Automated token extraction using Selenium
   - Runs on schedule (8:30 AM and 8:30 PM daily)
   - Uses secrets: WSE_USERNAME, WSE_PASSWORD, FIREBASE_CREDS

### Data Flow

1. **Authentication Flow**: 
   - TokenManager checks Firebase for valid token → Falls back to localStorage → Shows manual entry if unavailable
   - Token auto-refreshes via GitHub Actions every 12 hours
   - Real-time token updates via Firebase listener

2. **Data Fetching Flow**:
   - App requests schedule data → Checks Firebase cache first → If expired/missing, fetches from WSE API
   - API calls go through retry mechanism with exponential backoff
   - Student details are fetched in batches to avoid rate limiting

3. **Caching Strategy**:
   - Firebase Firestore stores schedule data with 10-minute expiry
   - Data includes complete lesson summaries (dataVersion: 2)
   - Old data automatically cleaned on new day

4. **Real-time Sync**:
   - Multiple devices share same Firebase instance
   - Real-time updates via Firestore listeners
   - Device count and sync status displayed in UI

### Key Configuration

Located in `src/config/config.js`:
- `CENTER_ID`: WSE center identifier
- `DAYS_TO_FETCH_AHEAD/BEHIND`: Date range for schedule fetching
- `FIREBASE_CONFIG`: Firebase project credentials
- `BATCH_SIZE`: Number of parallel student detail requests
- `CACHE_TIMEOUT`: Firebase cache expiry (10 minutes)

## Important Considerations

### API Integration
- WSE APIs require Bearer token authentication that expires every ~24 hours
- Contract API needs CORS proxy when accessed from browser
- API has rate limiting - batch requests are throttled

### Firebase Structure
- `config/wseToken`: Stores current authentication token
- `schedules/`: Cached schedule data by mode and date
- `metadata/lastClean`: Tracks daily cleanup
- `syncData/`: Real-time sync coordination between devices

### Deployment Notes
- Frontend deployed on Netlify (static hosting)
- Netlify functions handle serverless backend operations
- GitHub Actions manage automated token refresh
- Firebase provides real-time database and caching

### Debugging
- Press Ctrl+Shift+D in the app for system debug information
- Check browser console for detailed logs
- Token status displayed in header when valid/expired
- Sync status indicators show connection state

### Security Considerations
- Token stored in Firebase, not in code
- Firebase rules should restrict access appropriately
- Secrets stored in GitHub Actions and Netlify environment variables
- CORS proxy prevents direct API access from browser
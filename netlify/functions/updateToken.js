// netlify/functions/updateToken.js
const chromium = require('chrome-aws-lambda');
const puppeteer = require('puppeteer-core');
const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    }),
    databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`
  });
}

const db = admin.firestore();

exports.handler = async (event, context) => {
  // Security check
  const authHeader = event.headers.authorization;
  if (authHeader !== `Bearer ${process.env.UPDATE_TOKEN_SECRET}`) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' })
    };
  }

  let browser = null;
  
  try {
    console.log('Starting token extraction...');
    
    // Launch browser
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    
    // Enable request interception
    await page.setRequestInterception(true);
    let extractedToken = null;
    
    // Intercept requests to find token
    page.on('request', (request) => {
      const headers = request.headers();
      const auth = headers.authorization || headers.Authorization;
      
      if (auth && auth.startsWith('Bearer ')) {
        const token = auth.replace('Bearer ', '').trim();
        if (token.startsWith('eyJ') && token.length > 100) {
          extractedToken = token;
        }
      }
      request.continue();
    });

    // Navigate to login page
    await page.goto('https://world.wallstreetenglish.com/login', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Wait for login form
    await page.waitForSelector('#login-user-name', { timeout: 10000 });
    
    // Enter credentials
    await page.type('#login-user-name', process.env.WSE_USERNAME);
    await page.type('#login-password', process.env.WSE_PASSWORD);
    
    // Submit form
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2' }),
      page.keyboard.press('Enter')
    ]);

    // Wait a bit for API calls
    await page.waitForTimeout(3000);

    // Try to extract from localStorage if no token intercepted
    if (!extractedToken) {
      extractedToken = await page.evaluate(() => {
        const keys = ['token', 'authToken', 'auth_token', 'access_token'];
        for (const key of keys) {
          const value = localStorage.getItem(key);
          if (value && value.startsWith('eyJ')) {
            return value;
          }
        }
        // Search all localStorage
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          const value = localStorage.getItem(key);
          if (value && value.includes('eyJ')) {
            const match = value.match(/eyJ[A-Za-z0-9_\-\.]+/);
            if (match && match[0].length > 100) {
              return match[0];
            }
          }
        }
        return null;
      });
    }

    // Navigate to dashboard to trigger more API calls
    if (!extractedToken) {
      await page.goto('https://world.wallstreetenglish.com/dashboard', {
        waitUntil: 'networkidle2'
      });
      await page.waitForTimeout(3000);
    }

    if (extractedToken) {
      // Save token to Firebase
      await db.collection('config').doc('wseToken').set({
        token: extractedToken,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: 'automatic',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      });

      console.log('Token updated successfully');
      
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          success: true, 
          message: 'Token updated successfully',
          tokenPreview: extractedToken.substring(0, 30) + '...'
        })
      };
    } else {
      throw new Error('Failed to extract token');
    }

  } catch (error) {
    console.error('Error:', error);
    
    // Log error to Firebase
    await db.collection('logs').add({
      type: 'token_update_error',
      error: error.message,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        success: false, 
        error: error.message 
      })
    };
    
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};
import os
import json
import time
import datetime
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import firebase_admin
from firebase_admin import credentials, firestore

def setup_driver():
    """Setup Chrome driver for GitHub Actions"""
    chrome_options = Options()
    chrome_options.add_argument("--headless")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--window-size=1920,1080")
    chrome_options.add_argument("--disable-features=VizDisplayCompositor")
    chrome_options.add_argument("--disable-dev-tools")
    chrome_options.add_argument("--no-zygote")
    chrome_options.add_argument("--single-process")
    chrome_options.add_argument("--remote-debugging-port=9222")
    
    # Enable logging
    chrome_options.add_experimental_option("prefs", {
        "profile.default_content_setting_values.notifications": 2
    })
    chrome_options.set_capability("goog:loggingPrefs", {"performance": "ALL"})
    
    try:
        driver = webdriver.Chrome(options=chrome_options)
        print("Chrome driver initialized successfully")
        return driver
    except Exception as e:
        print(f"Failed to initialize Chrome: {e}")
        # Try with chromium-driver
        chrome_options.binary_location = "/usr/bin/chromium-browser"
        driver = webdriver.Chrome(options=chrome_options)
        print("Chromium driver initialized successfully")
        return driver

def extract_token():
    """Extract WSE token and save to Firebase"""
    driver = None
    
    try:
        print("Setting up driver...")
        driver = setup_driver()
        
        print("Navigating to WSE login page...")
        driver.get("https://world.wallstreetenglish.com/login")
        
        # Wait for page to load
        print("Waiting for login form...")
        WebDriverWait(driver, 15).until(
            EC.presence_of_element_located((By.ID, "login-user-name"))
        )
        
        # Enter credentials
        print("Entering credentials...")
        username_field = driver.find_element(By.ID, "login-user-name")
        password_field = driver.find_element(By.ID, "login-password")
        
        username_field.clear()
        username_field.send_keys(os.environ['WSE_USERNAME'])
        password_field.clear()
        password_field.send_keys(os.environ['WSE_PASSWORD'])
        
        # Submit form
        print("Submitting login form...")
        submit_button = driver.find_element(By.CSS_SELECTOR, "button[type='submit']")
        submit_button.click()
        
        # Wait for redirect after login
        print("Waiting for login to complete...")
        time.sleep(10)
        
        # Navigate to dashboard
        print("Navigating to dashboard...")
        driver.get("https://world.wallstreetenglish.com/dashboard")
        time.sleep(5)
        
        # Try multiple methods to extract token
        token = None
        
        # Method 1: Check network logs
        print("Checking network logs for token...")
        try:
            logs = driver.get_log("performance")
            for log in logs:
                message = json.loads(log["message"])["message"]
                if message["method"] == "Network.requestWillBeSent":
                    params = message.get("params", {})
                    headers = params.get("request", {}).get("headers", {})
                    auth = headers.get("authorization") or headers.get("Authorization")
                    
                    if auth and auth.startswith("Bearer "):
                        potential_token = auth.replace("Bearer ", "")
                        if potential_token.startswith("eyJ") and len(potential_token) > 100:
                            token = potential_token
                            print(f"Found token from network: {token[:30]}...")
                            break
        except Exception as e:
            print(f"Network log check failed: {e}")
        
        # Method 2: Check localStorage
        if not token:
            print("Checking localStorage...")
            try:
                token = driver.execute_script("""
                    // Check all localStorage items
                    for(let i = 0; i < localStorage.length; i++) {
                        const key = localStorage.key(i);
                        const value = localStorage.getItem(key);
                        
                        // Log for debugging
                        console.log(`${key}: ${value ? value.substring(0, 50) : 'empty'}`);
                        
                        // Check for JWT tokens
                        if (value && value.startsWith('eyJ')) {
                            // Basic JWT validation
                            const parts = value.split('.');
                            if (parts.length === 3 && value.length > 100) {
                                return value;
                            }
                        }
                    }
                    
                    // Try specific keys
                    const keys = ['token', 'authToken', 'auth_token', 'access_token', 'jwt', 'jwtToken'];
                    for (const key of keys) {
                        const value = localStorage.getItem(key);
                        if (value && value.startsWith('eyJ') && value.length > 100) {
                            return value;
                        }
                    }
                    
                    return null;
                """)
                
                if token:
                    print(f"Found token from localStorage: {token[:30]}...")
            except Exception as e:
                print(f"localStorage check failed: {e}")
        
        # Method 3: Check sessionStorage
        if not token:
            print("Checking sessionStorage...")
            try:
                token = driver.execute_script("""
                    for(let i = 0; i < sessionStorage.length; i++) {
                        const key = sessionStorage.key(i);
                        const value = sessionStorage.getItem(key);
                        if (value && value.startsWith('eyJ') && value.length > 100) {
                            return value;
                        }
                    }
                    return null;
                """)
                
                if token:
                    print(f"Found token from sessionStorage: {token[:30]}...")
            except Exception as e:
                print(f"sessionStorage check failed: {e}")
        
        # Validate and save token
        if token and token.startswith("eyJ"):
            print(f"Valid token extracted: {token[:30]}...")
            
            # Initialize Firebase
            print("Initializing Firebase...")
            cred_dict = json.loads(os.environ['FIREBASE_CREDS'])
            cred = credentials.Certificate(cred_dict)
            
            if not firebase_admin._apps:
                firebase_admin.initialize_app(cred)
            
            db = firestore.client()
            
            # Calculate expiry time (10 hours from now)
            expiry_time = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=10)
            
            # Save to Firebase
            print("Saving token to Firebase...")
            db.collection('config').document('wseToken').set({
                'token': token,
                'updatedAt': firestore.SERVER_TIMESTAMP,
                'expiresAt': expiry_time,
                'source': 'github-action',
                'expiresInHours': 10
            })
            
            print(f"✅ Token saved successfully!")
            print(f"Token will expire at: {expiry_time}")
            return True
        else:
            print("❌ ERROR: No valid token found!")
            print("Possible reasons:")
            print("1. Login failed - check credentials")
            print("2. Website structure changed")
            print("3. Token storage method changed")
            return False
            
    except Exception as e:
        print(f"❌ CRITICAL ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False
        
    finally:
        if driver:
            try:
                driver.quit()
                print("Driver closed")
            except:
                pass

if __name__ == "__main__":
    success = extract_token()
    if not success:
        exit(1)
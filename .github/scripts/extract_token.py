import os
import json
import time
import datetime
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import firebase_admin
from firebase_admin import credentials, firestore

# Setup Chrome
chrome_options = Options()
chrome_options.add_argument("--headless")
chrome_options.add_argument("--no-sandbox")
chrome_options.add_argument("--disable-dev-shm-usage")
chrome_options.set_capability("goog:loggingPrefs", {"performance": "ALL"})

driver = webdriver.Chrome(options=chrome_options)

try:
    print("Starting login process...")
    driver.get("https://world.wallstreetenglish.com/login")
    
    # Wait and login
    WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.ID, "login-user-name")))
    driver.find_element(By.ID, "login-user-name").send_keys(os.environ['WSE_USERNAME'])
    driver.find_element(By.ID, "login-password").send_keys(os.environ['WSE_PASSWORD'])
    driver.find_element(By.CSS_SELECTOR, "button[type='submit']").click()
    
    print("Waiting for login to complete...")
    time.sleep(8)
    
    # Navigate to dashboard to trigger API calls
    driver.get("https://world.wallstreetenglish.com/dashboard")
    time.sleep(5)
    
    # Check network logs for token
    token = None
    logs = driver.get_log("performance")
    
    for log in logs:
        message = json.loads(log["message"])["message"]
        if message["method"] != "Network.requestWillBeSent":
            continue
            
        params = message.get("params", {})
        headers = params.get("request", {}).get("headers", {})
        auth = headers.get("authorization") or headers.get("Authorization")
        
        if auth and auth.startswith("Bearer "):
            token = auth.replace("Bearer ", "")
            if token.startswith("eyJ") and len(token) > 100:
                print(f"Found token from network logs: {token[:30]}...")
                break
    
    # Try localStorage if no token from network
    if not token:
        print("Checking localStorage...")
        token = driver.execute_script("""
            for(let i=0; i<localStorage.length; i++) {
                let key = localStorage.key(i);
                let value = localStorage.getItem(key);
                console.log(key + ': ' + (value ? value.substring(0,50) : 'empty'));
                if(value && value.startswith('eyJ') && value.length > 100) {
                    return value;
                }
            }
            return localStorage.getItem('token') || 
                   localStorage.getItem('authToken') || 
                   localStorage.getItem('auth_token');
        """)
    
    if token and token.startswith("eyJ"):
        print(f"Token extracted: {token[:30]}...")
        
        # Save to Firebase with proper expiry time
        cred_dict = json.loads(os.environ['FIREBASE_CREDS'])
        cred = credentials.Certificate(cred_dict)
        firebase_admin.initialize_app(cred)
        db = firestore.client()
        
        # Set expiry to 10 hours from now
        expiry_time = datetime.datetime.now() + datetime.timedelta(hours=10)
        
        db.collection('config').document('wseToken').set({
            'token': token,
            'updatedAt': firestore.SERVER_TIMESTAMP,
            'expiresAt': expiry_time,
            'source': 'github-action',
            'expiresInHours': 10
        })
        
        print(f"Token saved to Firebase successfully")
        print(f"Token will expire at: {expiry_time}")
    else:
        print("ERROR: No valid token found!")
        print("Check if login was successful")
        exit(1)
        
except Exception as e:
    print(f"ERROR: {e}")
    exit(1)
finally:
    driver.quit()
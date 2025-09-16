import os
import json
import time
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

driver = webdriver.Chrome(options=chrome_options)

try:
    # Login to WSE
    driver.get("https://world.wallstreetenglish.com/login")
    WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.ID, "login-user-name")))
    
    driver.find_element(By.ID, "login-user-name").send_keys(os.environ['WSE_USERNAME'])
    driver.find_element(By.ID, "login-password").send_keys(os.environ['WSE_PASSWORD'])
    driver.find_element(By.CSS_SELECTOR, "button[type='submit']").click()
    
    time.sleep(5)
    
    # Extract token from localStorage
    token = driver.execute_script("""
        return localStorage.getItem('token') || 
               localStorage.getItem('authToken') || 
               localStorage.getItem('auth_token');
    """)
    
    if not token:
        # Search in all localStorage
        token = driver.execute_script("""
            for(let i=0; i<localStorage.length; i++) {
                let value = localStorage.getItem(localStorage.key(i));
                if(value && value.startsWith('eyJ')) return value;
            }
        """)
    
    if token:
        # Save to Firebase
        cred_dict = json.loads(os.environ['FIREBASE_CREDS'])
        cred = credentials.Certificate(cred_dict)
        firebase_admin.initialize_app(cred)
        db = firestore.client()
        
        db.collection('config').document('wseToken').set({
            'token': token,
            'updatedAt': firestore.SERVER_TIMESTAMP,
            'expiresAt': firestore.SERVER_TIMESTAMP
        })
        
        print(f"Token saved successfully: {token[:30]}...")
    else:
        print("Failed to extract token")
        exit(1)
        
finally:
    driver.quit()
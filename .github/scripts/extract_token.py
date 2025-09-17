import os
import json
import time
import datetime
import re
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import firebase_admin
from firebase_admin import credentials, firestore

def extract_token():
    """Extract WSE token using URL redirect method"""
    driver = None
    
    try:
        print("🚀 Starting token extraction...")
        
        # Setup Chrome options
        chrome_options = Options()
        chrome_options.add_argument("--headless")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--disable-gpu")
        chrome_options.add_argument("--window-size=1920,1080")
        
        # GitHub Actions specific
        chrome_options.binary_location = "/usr/bin/google-chrome"
        
        print("... Setting up Chrome driver")
        service = Service()
        driver = webdriver.Chrome(service=service, options=chrome_options)
        driver.set_page_load_timeout(30)
        
        # Navigate to login page
        login_url = "https://world.wallstreetenglish.com/learn/login"
        print(f"🌐 Navigating to: {login_url}")
        driver.get(login_url)
        
        # Wait and login
        wait = WebDriverWait(driver, 15)
        
        print("... Finding username field")
        username_field = wait.until(EC.presence_of_element_located((By.NAME, "username")))
        
        print("... Finding password field")
        password_field = wait.until(EC.presence_of_element_located((By.NAME, "password")))
        
        print("... Entering credentials")
        username_field.clear()
        username_field.send_keys(os.environ['WSE_USERNAME'])
        password_field.clear()
        password_field.send_keys(os.environ['WSE_PASSWORD'])
        
        print("... Finding 'Log in' button")
        login_button_xpath = "//button[normalize-space()='Log in']"
        login_button = wait.until(EC.element_to_be_clickable((By.XPATH, login_button_xpath)))
        
        print("... Clicking login button")
        driver.execute_script("arguments[0].click();", login_button)
        
        print("✅ Login submitted, waiting for redirect...")
        
        # Wait for redirect to autoLogin URL
        long_wait = WebDriverWait(driver, 30)
        long_wait.until(EC.url_contains("autoLogin/"))
        
        final_url = driver.current_url
        print(f"🔗 Redirect URL found: {final_url[:70]}...")
        
        # Extract token from URL
        token_match = re.search(r'autoLogin/(eyJ[a-zA-Z0-9_\-\.]+)', final_url)
        
        if token_match:
            token = token_match.group(1)
            print(f"✅ Token extracted: {token[:30]}...")
            
            # Save to Firebase
            print("📦 Saving to Firebase...")
            cred_dict = json.loads(os.environ['FIREBASE_CREDS'])
            cred = credentials.Certificate(cred_dict)
            
            if not firebase_admin._apps:
                firebase_admin.initialize_app(cred)
            
            db = firestore.client()
            
            # Set expiry time
            expiry_time = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=10)
            
            db.collection('config').document('wseToken').set({
                'token': token,
                'updatedAt': firestore.SERVER_TIMESTAMP,
                'expiresAt': expiry_time,
                'source': 'github-action',
                'method': 'url-redirect'
            })
            
            print("🎉 Token saved successfully!")
            print(f"📅 Will expire at: {expiry_time}")
            return True
        else:
            print("❌ No token found in URL")
            return False
            
    except Exception as e:
        print(f"❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False
        
    finally:
        if driver:
            try:
                driver.quit()
                print("🔒 Browser closed")
            except:
                pass

if __name__ == "__main__":
    success = extract_token()
    if not success:
        exit(1)
import os
import json
import time
import datetime
import re
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import firebase_admin
from firebase_admin import credentials, firestore

print("🚀 Starting token extraction...")

chrome_options = Options()
chrome_options.add_argument("--headless")
chrome_options.add_argument("--no-sandbox")
chrome_options.add_argument("--disable-dev-shm-usage")
chrome_options.binary_location = "/usr/bin/chromium-browser"

driver = webdriver.Chrome(options=chrome_options)

try:
    driver.get("https://world.wallstreetenglish.com/learn/login")
    
    wait = WebDriverWait(driver, 15)
    wait.until(EC.presence_of_element_located((By.NAME, "username"))).send_keys(os.environ['WSE_USERNAME'])
    driver.find_element(By.NAME, "password").send_keys(os.environ['WSE_PASSWORD'])
    driver.find_element(By.XPATH, "//button[normalize-space()='Log in']").click()
    
    WebDriverWait(driver, 30).until(EC.url_contains("autoLogin/"))
    
    token_match = re.search(r'autoLogin/(eyJ[a-zA-Z0-9_\-\.]+)', driver.current_url)
    
    if token_match:
        token = token_match.group(1)
        print(f"✅ Token: {token[:30]}...")
        
        cred = credentials.Certificate(json.loads(os.environ['FIREBASE_CREDS']))
        if not firebase_admin._apps:
            firebase_admin.initialize_app(cred)
        
        firestore.client().collection('config').document('wseToken').set({
            'token': token,
            'updatedAt': firestore.SERVER_TIMESTAMP,
            'expiresAt': datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=10)
        })
        print("✅ Saved!")
    else:
        print("❌ No token found")
        exit(1)
finally:
    driver.quit()
#!/usr/bin/env python3
import subprocess
import time
import os
from datetime import datetime

# Create screenshots directory
os.makedirs('debug_screenshots', exist_ok=True)

def take_screenshot(name):
    """Take screenshot using macOS screencapture"""
    timestamp = datetime.now().strftime('%H%M%S')
    filename = f'debug_screenshots/{name}_{timestamp}.png'
    subprocess.run(['screencapture', '-x', filename])
    print(f"📸 Screenshot saved: {filename}")
    return filename

def check_console_log():
    """Check if there's a console log file"""
    log_file = 'electron_console.log'
    if os.path.exists(log_file):
        with open(log_file, 'r') as f:
            content = f.read()
            if content:
                print("\n📝 Console output:")
                print(content[-2000:])  # Last 2000 chars
                return content
    return None

def main():
    print("🚀 Starting Kimi IDE debug session...")
    print("=" * 50)
    
    # Clean up previous runs
    subprocess.run(['pkill', '-f', 'electron'], capture_output=True)
    time.sleep(1)
    
    # Start Electron with logging
    print("\n🟢 Starting Electron...")
    log_file = open('electron_console.log', 'w')
    
    process = subprocess.Popen(
        ['npm', 'start'],
        stdout=log_file,
        stderr=subprocess.STDOUT,
        cwd='/Users/mac/kimi-vscode/ide'
    )
    
    print(f"PID: {process.pid}")
    
    # Take screenshots at intervals
    time.sleep(3)
    take_screenshot('03s_startup')
    check_console_log()
    
    time.sleep(5)
    take_screenshot('08s_loading')
    check_console_log()
    
    time.sleep(5)
    take_screenshot('13s_loaded')
    check_console_log()
    
    # Check if dist files exist
    print("\n📁 Checking dist files:")
    dist_files = ['dist/main.js', 'dist/renderer.js', 'dist/index.html']
    for f in dist_files:
        exists = os.path.exists(f)
        size = os.path.getsize(f) if exists else 0
        status = "✅" if exists else "❌"
        print(f"{status} {f}: {size} bytes")
    
    # Check index.html content
    print("\n📄 Checking index.html:")
    with open('dist/index.html', 'r') as f:
        html = f.read()
        if '<script' in html:
            print("✅ Script tag found in HTML")
        else:
            print("❌ No script tag in HTML!")
        
        if 'renderer.js' in html:
            print("✅ renderer.js referenced")
        else:
            print("❌ renderer.js not referenced!")
    
    # Keep running for a bit more
    time.sleep(5)
    take_screenshot('18s_final')
    
    print("\n🔴 Killing Electron...")
    process.terminate()
    log_file.close()
    
    print("\n✅ Debug session complete!")
    print("📸 Screenshots saved in: debug_screenshots/")
    print("📝 Console log: electron_console.log")

if __name__ == '__main__':
    main()

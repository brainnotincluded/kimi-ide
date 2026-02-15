#!/usr/bin/env python3
"""Take screenshot of Kimi IDE window"""
import subprocess
import time
import os

# Wait for window to appear
time.sleep(2)

# Find window ID
result = subprocess.run(
    ["osascript", "-e", 
     'tell application "System Events" to tell process "Electron" to return id of window 1'],
    capture_output=True, text=True
)

if result.returncode == 0:
    window_id = result.stdout.strip()
    print(f"Found window ID: {window_id}")
    
    # Take screenshot
    subprocess.run([
        "screencapture", 
        "-l", window_id,
        "/tmp/kimi_ide_window.png"
    ])
    print(f"Screenshot saved: /tmp/kimi_ide_window.png")
else:
    # Fallback - screenshot entire screen
    subprocess.run(["screencapture", "/tmp/kimi_ide_screen.png"])
    print("Fallback screenshot: /tmp/kimi_ide_screen.png")

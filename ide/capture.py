import subprocess
import time
import os

# Start IDE
proc = subprocess.Popen(
    ['./node_modules/.bin/electron', '.'],
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE
)

# Wait for window
time.sleep(4)

# Screenshot
subprocess.run(['screencapture', '/tmp/kimi_ide_final.png'])
print("Screenshot saved: /tmp/kimi_ide_final.png")

# Kill
proc.terminate()
time.sleep(1)

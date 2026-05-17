#!/bin/bash
# Android Security Lab — Full Setup Script
# Tested on macOS Apple Silicon (arm64)
# Requirements: Homebrew, Android Studio installed

set -e

echo "[1/5] Installing tools..."
brew install jadx apktool mitmproxy apkeep
pip3 install frida-tools

echo "[2/5] Installing Android SDK cmdline-tools..."
ANDROID_SDK_ROOT="$HOME/Library/Android/sdk"
mkdir -p "$ANDROID_SDK_ROOT/cmdline-tools"
curl -o /tmp/cmdline-tools.zip "https://dl.google.com/android/repository/commandlinetools-mac-13114758_latest.zip"
unzip -q /tmp/cmdline-tools.zip -d /tmp/cmdline-tools-extract
mv /tmp/cmdline-tools-extract/cmdline-tools "$ANDROID_SDK_ROOT/cmdline-tools/latest"

export PATH="$ANDROID_SDK_ROOT/cmdline-tools/latest/bin:$ANDROID_SDK_ROOT/emulator:$ANDROID_SDK_ROOT/platform-tools:$PATH"

echo "[3/5] Accepting licenses and downloading ARM64 system image..."
yes | sdkmanager --licenses > /dev/null
sdkmanager "system-images;android-33;google_apis;arm64-v8a" "platforms;android-33" "emulator"

echo "[4/5] Creating SecurityLab AVD..."
echo "no" | avdmanager create avd -n "SecurityLab" -k "system-images;android-33;google_apis;arm64-v8a" --device "pixel_6"

echo "[5/5] Adding to PATH in .zshrc..."
cat >> ~/.zshrc << 'EOF'
export ANDROID_SDK_ROOT="$HOME/Library/Android/sdk"
export PATH="$ANDROID_SDK_ROOT/cmdline-tools/latest/bin:$ANDROID_SDK_ROOT/emulator:$ANDROID_SDK_ROOT/platform-tools:/Library/Frameworks/Python.framework/Versions/3.10/bin:$PATH"
EOF

echo ""
echo "Done! Start your lab with:"
echo "  emulator -avd SecurityLab -no-snapshot-load -writable-system &"
echo "  adb root && adb remount"
echo "  adb shell 'nohup /data/local/tmp/frida-server &'"

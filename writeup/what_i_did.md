# What I Did — Step by Step

Everything I built and tested, in order. All of these worked.

---

## Step 1 — Installed the Security Toolkit on Mac

Installed all tools from scratch using Homebrew and pip:

```bash
brew install jadx apktool mitmproxy apkeep
pip3 install frida-tools
```

| Tool | Purpose |
|------|---------|
| `jadx` | Decompile APKs into readable Java source code |
| `apktool` | Unpack/repack APKs, edit smali bytecode |
| `mitmproxy` | Intercept and inspect HTTPS traffic |
| `apkeep` | Download APKs from APKPure without a Google account |
| `frida-tools` | Dynamic instrumentation — hook into running apps |

**Result: All tools installed and working.**

---

## Step 2 — Set Up Android SDK Command-Line Tools

Android Studio was already installed but missing `avdmanager` and `sdkmanager`. Downloaded and installed them manually:

```bash
curl -o /tmp/cmdline-tools.zip "https://dl.google.com/android/repository/commandlinetools-mac-13114758_latest.zip"
unzip -q /tmp/cmdline-tools.zip -d /tmp/cmdline-tools-extract
mv /tmp/cmdline-tools-extract/cmdline-tools ~/Library/Android/sdk/cmdline-tools/latest
```

**Result: `avdmanager` and `sdkmanager` working.**

---

## Step 3 — Downloaded arm64 Android System Image

Mac is Apple Silicon (arm64). Had to use `arm64-v8a` image — x86_64 doesn't run on Apple Silicon.

```bash
sdkmanager "system-images;android-33;google_apis;arm64-v8a" "platforms;android-33" "emulator"
```

Key detail: used **Google APIs** image (not Google Play) — only Google APIs allows `adb root`.

**Result: Android 13 arm64 system image downloaded.**

---

## Step 4 — Created the SecurityLab Emulator (AVD)

```bash
avdmanager create avd -n "SecurityLab" -k "system-images;android-33;google_apis;arm64-v8a" --device "pixel_6"
```

**Result: Pixel 6 emulator created, named SecurityLab.**

---

## Step 5 — Booted and Rooted the Emulator

```bash
emulator -avd SecurityLab -no-snapshot-load -writable-system &
adb root
adb remount
adb reboot
```

After reboot, verified root:
```bash
adb shell whoami  # → root
adb shell id      # → uid=0(root)
```

**Result: Fully rooted Android 13 emulator running.**

---

## Step 6 — Installed mitmproxy CA Certificate

So mitmproxy can intercept HTTPS traffic from the emulator:

```bash
# Generate cert
mitmdump --mode regular@8082 &

# Get cert hash (Android requires this filename format)
CERT_HASH=$(openssl x509 -inform PEM -subject_hash_old -in ~/.mitmproxy/mitmproxy-ca-cert.pem | head -1)

# Push to system trust store via sdcard
adb push /tmp/${CERT_HASH}.0 /sdcard/${CERT_HASH}.0
adb shell "cp /sdcard/${CERT_HASH}.0 /system/etc/security/cacerts/${CERT_HASH}.0"
adb shell "chmod 644 /system/etc/security/cacerts/${CERT_HASH}.0"
```

**Result: mitmproxy cert trusted system-wide on emulator.**

---

## Step 7 — Installed Frida Server on Emulator

Frida lets you hook into running apps, bypass SSL pinning, dump memory etc.

```bash
# Download correct version for android arm64
curl -sL "https://github.com/frida/frida/releases/download/17.9.10/frida-server-17.9.10-android-arm64.xz" -o /tmp/frida-server.xz
xz -d /tmp/frida-server.xz

# Push and run on device
adb push /tmp/frida-server /data/local/tmp/frida-server
adb shell chmod 755 /data/local/tmp/frida-server
adb shell "nohup /data/local/tmp/frida-server &"

# Verify — list running processes via Frida
frida-ps -U
```

**Result: Frida server running on emulator, connected from Mac.**

---

## Step 8 — Installed 3 Antivirus Apps

Downloaded XAPKs with `apkeep` and sideloaded via `adb install-multiple`:

```bash
apkeep -a com.antivirus -d apk-pure .           # AVG AntiVirus
apkeep -a com.kms.free -d apk-pure .            # Kaspersky
apkeep -a com.bitdefender.security -d apk-pure . # BitDefender
```

Note: Avast and Malwarebytes were excluded — APKPure only had x86 builds, incompatible with arm64 emulator.

**Result: AVG, Kaspersky, BitDefender installed on emulator.**

---

## Step 9 — Created Test Payloads

Used the **EICAR standard test file** — a harmless 68-byte string that all AV engines must detect. Not malware.

**File 1 — Raw EICAR (baseline)**
```bash
printf 'X5O!P%%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*' > eicar.txt
```

**File 2 — Base64 encoded**
```bash
printf 'X5O!P%%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*' | base64 > eicar_b64.txt
```

**File 3 — Fake extension**
```bash
cp eicar_b64.txt vacation_photo.jpg
```

**File 4 — Runtime dropper script**
```bash
cat > dropper.sh << 'EOF'
#!/system/bin/sh
P1="X5O!P%@AP[4"
P2="\\PZX54(P^)7CC)7}"
P3='$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'
echo "${P1}${P2}${P3}" > /sdcard/Download/runtime_payload.txt
EOF
```

Pushed all files to emulator:
```bash
adb push eicar.txt /sdcard/Download/eicar.txt
adb push eicar_b64.txt /sdcard/Download/eicar_b64.txt
adb push vacation_photo.jpg /sdcard/Download/vacation_photo.jpg
adb push dropper.sh /sdcard/Download/dropper.sh
adb shell "sh /sdcard/Download/dropper.sh"
```

**Result: 5 test files on emulator — raw, encoded, fake extension, dropper script, runtime output.**

---

## Step 10 — Ran AVG Scan and Recorded Results

Granted storage permission:
```bash
adb shell appops set com.antivirus MANAGE_EXTERNAL_STORAGE allow
```

Automated the UI with ADB (tapping buttons by coordinate from `uiautomator dump`):
```bash
adb shell uiautomator dump /sdcard/ui.xml
# parse XML → get button bounds → tap center coordinates
adb shell input tap 540 2095  # CONTINUE WITH ADS
adb shell input tap 539 606   # SCAN NOW
```

---

## Results — What AVG Detected vs Missed

| File | Technique | AVG Result |
|------|-----------|------------|
| `eicar.txt` | Raw signature | **DETECTED** ✅ |
| `runtime_payload.txt` | Assembled at runtime | **DETECTED** ✅ |
| `eicar_b64.txt` | Base64 encoded | **MISSED** ❌ |
| `vacation_photo.jpg` | Fake extension | **MISSED** ❌ |
| `dropper.sh` | Split string script | **MISSED** ❌ |

### What this proves:
- AVG uses **pure signature matching** on raw bytes
- It **does not decode** base64 or other encodings before scanning
- It **does not analyse scripts** for payload assembly patterns
- The dropper script itself is invisible — only the output file gets caught
- **Base64 encoding = complete static bypass** against AVG

---

## Step 11 — Published to GitHub

```bash
git init
git add .
git commit -m "Initial commit: Android AV detection & bypass research"
gh repo create android-av-research --public --source=. --remote=origin --push
```

**Live at: https://github.com/SherbekjonDev/android-av-research**

---

## Full Lab Stack Summary

```
Mac (Apple Silicon)
├── jadx          → decompile APKs
├── apktool       → unpack/repack APKs  
├── mitmproxy     → HTTPS traffic interception
├── frida-tools   → dynamic app instrumentation
├── adb           → device control
└── Android Emulator (SecurityLab)
    ├── Android 13 — Pixel 6 — arm64
    ├── Fully rooted (uid=0)
    ├── mitmproxy CA trusted system-wide
    ├── frida-server running
    ├── AVG AntiVirus installed
    ├── Kaspersky installed
    └── BitDefender installed
```

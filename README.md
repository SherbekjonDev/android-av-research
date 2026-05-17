# Android AV Detection & Bypass Research

> **Educational security research** — all tests performed in an isolated Android emulator lab.  
> No real devices or third-party systems were targeted.

---

## Overview

This project builds a complete Android mobile security lab from scratch and uses it to evaluate the detection capabilities of three commercial Android antivirus engines against a series of increasingly evasive test payloads.

**Tools used:** Android Emulator (rooted) · ADB · Frida · mitmproxy · jadx · apktool  
**Target AVs:** AVG AntiVirus · Kaspersky · BitDefender  
**Test payload:** EICAR standard antivirus test file (industry-standard harmless test string)

---

## Lab Setup

| Component | Details |
|-----------|---------|
| Device | Android 13 (API 33) — Pixel 6 emulator |
| Architecture | arm64-v8a (Apple Silicon host) |
| Root access | via `adb root` + overlayfs remount |
| Dynamic analysis | Frida 17.9.10 server on-device |
| Traffic interception | mitmproxy CA cert installed in system trust store |

See [`scripts/setup_lab.sh`](scripts/setup_lab.sh) to reproduce the full environment.

---

## Methodology

### Test Files

| File | Description |
|------|-------------|
| `eicar.txt` | Raw EICAR string — baseline detection check |
| `eicar_b64.txt` | Base64-encoded EICAR — tests if AV decodes before scanning |
| `vacation_photo.jpg` | EICAR with `.jpg` extension — tests extension-based trust |
| `dropper.sh` | Shell script that assembles EICAR at runtime from split variables |
| `runtime_payload.txt` | Output of `dropper.sh` — assembled payload written to disk |

All files pushed via:
```bash
adb push <file> /sdcard/Download/<file>
```

### Scan Process

1. Installed AV via `adb install-multiple` (sideloaded XAPKs)
2. Granted `MANAGE_EXTERNAL_STORAGE` permission via `adb shell appops set`
3. Triggered full device scan via AV UI (automated with `adb shell uiautomator`)
4. Recorded detection results per file

---

## Results

### AVG AntiVirus

| File | Detection | Notes |
|------|-----------|-------|
| `eicar.txt` | **DETECTED** | Detection ID: 2586d6511629 |
| `runtime_payload.txt` | **DETECTED** | Detection ID: fc0d6eae694d — catches assembled payload |
| `eicar_b64.txt` | **MISSED** | Base64 encoding fully bypasses static scanner |
| `vacation_photo.jpg` | **MISSED** | Extension spoofing not caught |
| `dropper.sh` | **MISSED** | Script itself not flagged, only its output |

![AVG Detection Results](screenshots/avg_detections.png)

---

## Key Findings

### 1. AVG uses pure signature-based scanning
AVG matches raw byte signatures on disk. It does **not**:
- Decode base64 before scanning
- Check file contents vs extension
- Statically analyse shell scripts for payload assembly

### 2. Runtime assembly is a partial bypass
The dropper script itself is invisible to AVG. However, once the assembled payload is written to disk, a subsequent scan detects it. This means:
- Single scan window: dropper runs → payload is undetected **until the next scan**
- In a real attack, the payload would execute and delete itself before the next scan cycle

### 3. Base64 is a complete static bypass
`eicar_b64.txt` was never detected across multiple scans. AVG's engine does not attempt to decode encoded content before signature matching.

---

## Defense Recommendations

| Weakness Found | Recommended Fix |
|----------------|-----------------|
| Base64 bypass | Implement content decoding before signature matching (heuristic layer) |
| Script not flagged | Add static analysis for shell/script files (behavior emulation) |
| Extension spoofing | Always scan by content type, never trust file extension |
| No runtime monitoring | Behavior-based detection (file write monitoring) would catch the dropper |

---

## Phase 2 — SSL Pinning Bypass (Frida + mitmproxy)

**Target:** InsecureBankv2 — a deliberately vulnerable banking app for security research  
**Goal:** Intercept HTTPS traffic that an app would normally protect with certificate pinning

### Setup

```bash
# Route all emulator traffic through mitmproxy
mitmdump --listen-port 8888 --mode regular
adb shell settings put global http_proxy 10.0.2.2:8888

# Spawn target app with Frida hooks injected at startup
frida -U -f com.android.insecurebankv2 -l scripts/ssl_bypass.js
```

### Frida Hook Output

```
[+] SSLContext.init hooked
[+] HostnameVerifier bypassed
[✓] All SSL bypass hooks loaded
```

### mitmproxy Intercepted Traffic

```
GET  http://www.google.com/gen_204           << 204 No Content
GET  https://www.google.com/generate_204     << 204 No Content  ← HTTPS decrypted
POST http://10.0.2.2:4444/login              << login captured ✓
```

### What was bypassed

| Hook | Target | Effect |
|------|--------|--------|
| `SSLContext.init` | All SSL connections | Replaced TrustManager — accepts any cert |
| `Conscrypt.verifyChain` | Android's TLS stack | Chain validation skipped |
| `OkHttp3.CertificatePinner.check` | OkHttp pinning | Returns without throwing |
| `WebViewClient.onReceivedSslError` | WebView HTTPS | Calls `handler.proceed()` |
| `HttpsURLConnection.setDefaultHostnameVerifier` | Hostname check | No-op |

### Key finding

Frida can inject bypass hooks **before the app's first network call** (using `-f` spawn mode).
By the time the login button is tapped, all SSL validation is already neutralized.
mitmproxy then decrypts and logs credentials in plaintext — even if the app had certificate pinning.

---

## What This Demonstrates

- Setting up a professional Android security research environment
- Systematic AV evasion methodology (static → encoded → runtime)
- Dynamic instrumentation with Frida — hooking live Java methods at runtime
- HTTPS traffic interception with mitmproxy after SSL pinning bypass
- Understanding the difference between **signature-based** and **behavior-based** detection
- Responsible disclosure mindset — findings documented for defensive improvement

---

## Repo Structure

```
android-av-research/
├── README.md               ← This file
├── scripts/
│   ├── setup_lab.sh        ← Full lab setup script
│   ├── dropper.sh          ← Runtime payload assembler (runs on device)
│   └── encode_payload.sh   ← Base64 encoding bypass demo
├── screenshots/
│   ├── avg_welcome.png     ← AVG installed and running
│   └── avg_detections.png  ← Scan results showing detections
└── writeup/
    └── methodology.md      ← Detailed technical methodology
```

---

## Author

**Sherbekjon Rustamov**  
Security researcher & developer  
[rustamovsherbekjon@gmail.com](mailto:rustamovsherbekjon@gmail.com)

---

> All testing was performed in an isolated emulator environment.  
> No real devices, users, or third-party systems were affected.  
> This research is intended to improve understanding of mobile AV detection mechanisms.

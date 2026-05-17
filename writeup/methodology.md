# Technical Methodology

## Phase 1 — Lab Construction

### Why a rooted emulator?
A rooted device is required to:
- Install CA certificates into the system trust store (for HTTPS interception)
- Run frida-server as root (for dynamic instrumentation)
- Remount `/system` as writable for persistent changes

Google APIs images (not Google Play) must be used — Play Store images prevent `adb root`.

### Why arm64?
The host machine is Apple Silicon (M-series). Android emulator on arm64 Mac cannot run x86_64 system images — QEMU2 does not support cross-architecture emulation. All system images and APKs must be arm64-v8a.

### Frida server
Frida enables dynamic instrumentation — hooking into running processes to:
- Bypass SSL pinning (intercept HTTPS even when apps pin their cert)
- Hook Java methods at runtime
- Dump memory, arguments, return values

Frida server was pushed to `/data/local/tmp/frida-server` and started as root.

### mitmproxy CA cert
The CA cert hash is computed with `openssl x509 -subject_hash_old` and placed in `/system/etc/security/cacerts/<hash>.0`. This makes Android trust mitmproxy's dynamically-generated TLS certificates system-wide.

---

## Phase 2 — AV Installation

AVs were sideloaded via XAPK files (downloaded with `apkeep` from APKPure). XAPK is a ZIP containing:
- Base APK (`<package>.apk`)
- Split APKs for ABI, density, language (`config.*.apk`)

Installation requires `adb install-multiple` with all splits. Missing any split causes `INSTALL_FAILED_MISSING_SPLIT`. Avast and Malwarebytes were excluded because their APKPure builds only contained x86 native libraries — incompatible with our arm64 emulator.

---

## Phase 3 — Test Design

### EICAR test file
The EICAR standard test string is a 68-byte ASCII string that all compliant AV engines must detect. It is completely harmless — it cannot execute, it is not malware, it exists purely as a test vector. Using EICAR means:
- Results are reproducible on any AV
- No legal/ethical risk
- Industry-standard methodology

### Bypass variants
Each variant tests a different layer of the detection stack:

**Base64 encoding** → tests whether the AV decodes content before matching signatures. Most signature scanners work on raw bytes and do not attempt decoding.

**Extension spoofing** → tests whether the AV trusts file extensions. A properly implemented scanner should use magic bytes / content detection, not extension.

**Runtime assembly** → tests whether the AV performs static analysis on scripts. The dropper splits the signature across shell variables — no contiguous signature exists in the script file itself.

---

## Phase 4 — Results Interpretation

AVG detected the raw payload and the runtime-assembled payload (after it was written to disk), but missed all three bypass variants. This is consistent with a pure signature-based scanner with no:
- Content decoding pipeline
- Script emulation / sandboxing
- Behavior monitoring (file write events)

Modern enterprise EDR products (CrowdStrike, SentinelOne) would catch the dropper via behavior monitoring — watching for a process writing a known-bad byte sequence to disk in real time. AVG free does not implement this.

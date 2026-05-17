#!/bin/bash
# Base64 encoding bypass
# Encodes EICAR test string — AVG does not detect the encoded version.
# Shows that signature-based scanners operate on raw bytes only.

EICAR='X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'
echo "$EICAR" | base64 > eicar_b64.txt
echo "Encoded payload written to eicar_b64.txt"

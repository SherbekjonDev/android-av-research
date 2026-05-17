#!/system/bin/sh
# Runtime payload assembler
# Demonstrates that splitting a signature across variables
# evades static analysis — the dropper itself is not flagged,
# only the assembled output file is (if written to disk).

P1="X5O!P%@AP[4"
P2="\\PZX54(P^)7CC)7}"
P3='$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'
echo "${P1}${P2}${P3}" > /sdcard/Download/runtime_payload.txt

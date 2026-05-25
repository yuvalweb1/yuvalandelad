package com.chatwrapped.app;

import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.OpenableColumns;
import android.util.Base64;
import com.getcapacitor.BridgeActivity;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;

public class MainActivity extends BridgeActivity {

    // Held in memory until the WebView is ready to receive it.
    private String pendingBase64;
    private String pendingName;
    private String pendingType;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        handleShareIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleShareIntent(intent);
    }

    private void handleShareIntent(Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) return;

        Uri uri;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            uri = intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri.class);
        } else {
            //noinspection deprecation
            uri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
        }
        if (uri == null) return;

        try {
            // Resolve display name from content URI
            String name = "chat.zip";
            Cursor cursor = getContentResolver().query(uri, null, null, null, null);
            if (cursor != null && cursor.moveToFirst()) {
                int col = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (col >= 0) name = cursor.getString(col);
                cursor.close();
            }

            // Read file bytes
            InputStream is = getContentResolver().openInputStream(uri);
            if (is == null) return;
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] chunk = new byte[8192];
            int n;
            while ((n = is.read(chunk)) > 0) out.write(chunk, 0, n);
            is.close();

            String type = getContentResolver().getType(uri);
            if (type == null) type = name.endsWith(".txt") ? "text/plain" : "application/zip";

            pendingBase64 = Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP);
            pendingName = name;
            pendingType = type;
            scheduleDelivery(0);
        } catch (Exception e) {
            pendingBase64 = null;
        }
    }

    // Retry delivering the file to the WebView until window.__capacitorSharedFile is registered.
    private void scheduleDelivery(int attempt) {
        if (pendingBase64 == null || attempt > 20) return;
        long delay = attempt == 0 ? 300 : Math.min(300L * (1 << Math.min(attempt, 4)), 3000);
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            if (getBridge() == null || pendingBase64 == null) return;
            String safeName = pendingName.replace("\\", "\\\\").replace("'", "\\'");
            String js =
                "(function(){" +
                "  try {" +
                "    if (typeof window.__capacitorSharedFile !== 'function') return 'noop';" +
                "    window.__capacitorSharedFile('" + pendingBase64 + "','" + safeName + "','" + pendingType + "');" +
                "    return 'ok';" +
                "  } catch(e) { return 'err'; }" +
                "})()";
            getBridge().getWebView().evaluateJavascript(js, result -> {
                if ("\"ok\"".equals(result)) {
                    pendingBase64 = null;
                    pendingName = null;
                    pendingType = null;
                } else {
                    scheduleDelivery(attempt + 1);
                }
            });
        }, delay);
    }
}

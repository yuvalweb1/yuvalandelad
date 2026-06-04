package com.chatwrapped.app;

import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.OpenableColumns;
import com.getcapacitor.BridgeActivity;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;

public class MainActivity extends BridgeActivity {

    // Path to the cached copy of the shared file, held until the WebView consumes it.
    // The raw bytes NEVER cross the JS bridge — only this path string does.
    private String pendingPath;
    private String pendingName;
    private String pendingType;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        cleanupStaleCache();
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

            // Stream the file straight to disk — no in-memory accumulation, no base64.
            // For a 500 MB WhatsApp export this peaks at ~64 KB resident on the Java
            // side instead of the ~3 GB the old ByteArrayOutputStream + Base64 path
            // forced through Java heap and the WebView bridge.
            File outFile = new File(getCacheDir(), "shared_" + System.currentTimeMillis() + ".bin");
            InputStream is = getContentResolver().openInputStream(uri);
            if (is == null) return;
            FileOutputStream os = new FileOutputStream(outFile);
            try {
                byte[] chunk = new byte[64 * 1024];
                int n;
                while ((n = is.read(chunk)) > 0) os.write(chunk, 0, n);
            } finally {
                try { is.close(); } catch (Exception ignored) {}
                try { os.close(); } catch (Exception ignored) {}
            }

            String type = getContentResolver().getType(uri);
            if (type == null) type = name.endsWith(".txt") ? "text/plain" : "application/zip";

            pendingPath = outFile.getAbsolutePath();
            pendingName = name;
            pendingType = type;
            scheduleDelivery(0);
        } catch (Exception e) {
            pendingPath = null;
        }
    }

    // Retry delivering the path to the WebView until window.__capacitorSharedFile is registered.
    private void scheduleDelivery(int attempt) {
        if (pendingPath == null || attempt > 20) return;
        long delay = attempt == 0 ? 300 : Math.min(300L * (1 << Math.min(attempt, 4)), 3000);
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            if (getBridge() == null || pendingPath == null) return;
            String safeName = pendingName.replace("\\", "\\\\").replace("'", "\\'");
            String safePath = pendingPath.replace("\\", "\\\\").replace("'", "\\'");
            String safeType = pendingType.replace("\\", "\\\\").replace("'", "\\'");
            String js =
                "(function(){" +
                "  try {" +
                "    if (typeof window.__capacitorSharedFile !== 'function') return 'noop';" +
                "    window.__capacitorSharedFile('" + safePath + "','" + safeName + "','" + safeType + "');" +
                "    return 'ok';" +
                "  } catch(e) { return 'err'; }" +
                "})()";
            getBridge().getWebView().evaluateJavascript(js, result -> {
                if ("\"ok\"".equals(result)) {
                    pendingPath = null;
                    pendingName = null;
                    pendingType = null;
                } else {
                    scheduleDelivery(attempt + 1);
                }
            });
        }, delay);
    }

    // The JS side reads the cache file via fetch(Capacitor.convertFileSrc(path)). We don't
    // know exactly when it's done, so we sweep leftovers on next app start instead of
    // trying to coordinate a delete signal across the bridge.
    private void cleanupStaleCache() {
        try {
            File dir = getCacheDir();
            File[] files = dir.listFiles();
            if (files == null) return;
            for (File f : files) {
                if (f.getName().startsWith("shared_")) {
                    //noinspection ResultOfMethodCallIgnored
                    f.delete();
                }
            }
        } catch (Exception ignored) {}
    }
}

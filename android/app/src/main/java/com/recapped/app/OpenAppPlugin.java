package com.recapped.app;

import android.content.Intent;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// Opens another installed app by its package name using the OS launcher intent —
// the exact same action as tapping the app's icon. Unlike ACTION_VIEW on a
// custom scheme (whatsapp://), this never depends on the target app registering
// a matching URL intent-filter, so it can't silently no-op.
@CapacitorPlugin(name = "OpenApp")
public class OpenAppPlugin extends Plugin {

    @PluginMethod
    public void openWhatsApp(PluginCall call) {
        Intent intent = getContext().getPackageManager()
                .getLaunchIntentForPackage("com.whatsapp");
        if (intent != null) {
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } else {
            call.reject("WhatsApp not installed");
        }
    }
}

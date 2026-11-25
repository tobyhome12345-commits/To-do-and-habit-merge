package com.doable.tick;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Helps reminders arrive when Doable is closed or swiped away. Phones (Samsung especially) can put
 * "optimized" apps to sleep and hold back their alarms; letting Doable ignore battery optimization
 * (Samsung calls it "Unrestricted") stops that.
 */
@CapacitorPlugin(name = "ReminderHelper")
public class ReminderHelperPlugin extends Plugin {

    private boolean isIgnoringBatteryOptimizations() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return true;
        PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
        return pm != null && pm.isIgnoringBatteryOptimizations(getContext().getPackageName());
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject result = new JSObject();
        result.put("ignoringBatteryOptimizations", isIgnoringBatteryOptimizations());
        result.put("manufacturer", Build.MANUFACTURER == null ? "" : Build.MANUFACTURER);
        call.resolve(result);
    }

    /** Shows Android's "Let Doable always run in the background?" dialog. */
    @PluginMethod
    public void requestIgnoreBatteryOptimizations(PluginCall call) {
        if (!isIgnoringBatteryOptimizations()) {
            try {
                Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                getActivity().startActivity(intent);
            } catch (Exception e) {
                openDetails();
            }
        }
        call.resolve();
    }

    /** Opens Doable's page in Android Settings (battery, notifications…). */
    @PluginMethod
    public void openAppSettings(PluginCall call) {
        openDetails();
        call.resolve();
    }

    private void openDetails() {
        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            getActivity().startActivity(intent);
        } catch (Exception ignored) {
            // Nothing else we can open.
        }
    }
}

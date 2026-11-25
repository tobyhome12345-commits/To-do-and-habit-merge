package com.doable.tick;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Doable's own small plugin (see ReminderHelperPlugin): must be registered before super.onCreate.
        registerPlugin(ReminderHelperPlugin.class);
        super.onCreate(savedInstanceState);
    }
}

package com.kebabpos.terminal;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register custom plugins BEFORE super.onCreate()
        registerPlugin(SunmiPrinterPlugin.class);
        
        super.onCreate(savedInstanceState);
    }
}

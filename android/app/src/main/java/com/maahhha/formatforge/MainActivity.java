package com.maahhha.formatforge;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Capacitor automatically discovers all installed plugins
        // (including @capacitor-mlkit/subject-segmentation and @capacitor-community/text-to-speech)
    }
}

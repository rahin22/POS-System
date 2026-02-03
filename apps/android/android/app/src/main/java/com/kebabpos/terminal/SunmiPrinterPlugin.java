package com.kebabpos.terminal;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.content.pm.PackageManager;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbEndpoint;
import android.hardware.usb.UsbInterface;
import android.hardware.usb.UsbManager;
import android.util.Log;

import androidx.core.app.ActivityCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONException;

import java.io.IOException;
import java.io.OutputStream;
import java.util.HashMap;
import java.util.Set;
import java.util.UUID;

/**
 * Universal Printer Plugin for Android
 * 
 * Priority order:
 * 1. Sunmi built-in printer (via PrinterX SDK reflection)
 * 2. Bluetooth ESC/POS printers
 * 3. USB ESC/POS printers
 */
@CapacitorPlugin(
    name = "SunmiPrinter",
    permissions = {
        @Permission(strings = { Manifest.permission.BLUETOOTH }, alias = "bluetooth"),
        @Permission(strings = { Manifest.permission.BLUETOOTH_ADMIN }, alias = "bluetoothAdmin"),
        @Permission(strings = { Manifest.permission.BLUETOOTH_CONNECT }, alias = "bluetoothConnect"),
        @Permission(strings = { Manifest.permission.BLUETOOTH_SCAN }, alias = "bluetoothScan")
    }
)
public class SunmiPrinterPlugin extends Plugin {

    private static final String TAG = "PrinterPlugin";
    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");

    // Printer types
    private enum PrinterType { NONE, SUNMI, SUNMI_AIDL, BLUETOOTH, USB }
    
    private PrinterType activePrinterType = PrinterType.NONE;
    private Object sunmiPrinter = null;
    private Object sunmiAidlService = null;
    private BluetoothSocket bluetoothSocket = null;
    private OutputStream bluetoothOutputStream = null;
    private UsbDeviceConnection usbConnection = null;
    private UsbEndpoint usbEndpoint = null;
    
    private boolean isConnected = false;

    // ESC/POS Commands
    private static final byte[] ESC_INIT = { 0x1B, 0x40 };
    private static final byte[] ESC_ALIGN_LEFT = { 0x1B, 0x61, 0x00 };
    private static final byte[] ESC_ALIGN_CENTER = { 0x1B, 0x61, 0x01 };
    private static final byte[] ESC_ALIGN_RIGHT = { 0x1B, 0x61, 0x02 };
    private static final byte[] ESC_BOLD_ON = { 0x1B, 0x45, 0x01 };
    private static final byte[] ESC_BOLD_OFF = { 0x1B, 0x45, 0x00 };
    private static final byte[] ESC_DOUBLE_HEIGHT = { 0x1B, 0x21, 0x10 };
    private static final byte[] ESC_DOUBLE_WIDTH = { 0x1B, 0x21, 0x20 };
    private static final byte[] ESC_DOUBLE_SIZE = { 0x1B, 0x21, 0x30 };
    private static final byte[] ESC_NORMAL_SIZE = { 0x1B, 0x21, 0x00 };
    private static final byte[] ESC_CUT_PAPER = { 0x1D, 0x56, 0x00 };
    private static final byte[] ESC_FEED_LINES = { 0x1B, 0x64 };
    private static final byte[] ESC_OPEN_DRAWER = { 0x1B, 0x70, 0x00, 0x19, (byte)0xFA };

    @Override
    public void load() {
        super.load();
        autoConnect();
    }

    /**
     * Auto-detect and connect to best available printer
     */
    private void autoConnect() {
        // Try Sunmi PrinterX SDK first (works on T2s)
        if (connectSunmi()) {
            Log.i(TAG, "Connected to Sunmi PrinterX SDK");
            return;
        }
        Log.i(TAG, "Sunmi not available, will use Bluetooth/USB when connected");
    }

    /**
     * Connect to Sunmi via AIDL service (T2s, V2, etc)
     */
    private boolean connectSunmiAidl() {
        try {
            android.content.Intent intent = new android.content.Intent();
            intent.setPackage("woyou.aidlservice.jiuiv5");
            intent.setAction("woyou.aidlservice.jiuiv5.IWoyouService");
            
            getContext().bindService(intent, new android.content.ServiceConnection() {
                @Override
                public void onServiceConnected(android.content.ComponentName name, android.os.IBinder service) {
                    try {
                        Class<?> stubClass = Class.forName("woyou.aidlservice.jiuiv5.IWoyouService$Stub");
                        sunmiAidlService = stubClass.getMethod("asInterface", android.os.IBinder.class).invoke(null, service);
                        activePrinterType = PrinterType.SUNMI_AIDL;
                        isConnected = true;
                        Log.i(TAG, "Sunmi AIDL service connected");
                        
                        JSObject ret = new JSObject();
                        ret.put("connected", true);
                        ret.put("type", "sunmi");
                        notifyListeners("printerConnected", ret);
                    } catch (Exception e) {
                        Log.e(TAG, "Error getting AIDL interface", e);
                    }
                }

                @Override
                public void onServiceDisconnected(android.content.ComponentName name) {
                    sunmiAidlService = null;
                    if (activePrinterType == PrinterType.SUNMI_AIDL) {
                        activePrinterType = PrinterType.NONE;
                        isConnected = false;
                    }
                    Log.i(TAG, "Sunmi AIDL service disconnected");
                }
            }, android.content.Context.BIND_AUTO_CREATE);
            
            return true;
        } catch (Exception e) {
            Log.d(TAG, "Sunmi AIDL not available: " + e.getMessage());
            return false;
        }
    }

    /**
     * Try to connect to Sunmi printer via reflection
     */
    private boolean connectSunmi() {
        try {
            Class<?> printerSdkClass = Class.forName("com.sunmi.printerx.PrinterSdk");
            Object instance = printerSdkClass.getMethod("getInstance").invoke(null);
            printerSdkClass.getMethod("log", boolean.class, String.class).invoke(instance, true, TAG);

            Class<?> listenerClass = Class.forName("com.sunmi.printerx.PrinterSdk$PrinterListen");
            Object listener = java.lang.reflect.Proxy.newProxyInstance(
                listenerClass.getClassLoader(),
                new Class<?>[] { listenerClass },
                (proxy, method, args) -> {
                    if ("onDefPrinter".equals(method.getName()) && args != null && args.length > 0) {
                        sunmiPrinter = args[0];
                        activePrinterType = PrinterType.SUNMI;
                        isConnected = true;
                        Log.i(TAG, "Sunmi printer ready: " + sunmiPrinter);
                        
                        JSObject ret = new JSObject();
                        ret.put("connected", true);
                        ret.put("type", "sunmi");
                        notifyListeners("printerConnected", ret);
                    }
                    return null;
                }
            );

            printerSdkClass.getMethod("getPrinter", android.content.Context.class, listenerClass)
                .invoke(instance, getContext(), listener);
            return true;
        } catch (ClassNotFoundException e) {
            Log.d(TAG, "Sunmi SDK not available");
            return false;
        } catch (Exception e) {
            Log.e(TAG, "Error connecting to Sunmi", e);
            return false;
        }
    }

    @PluginMethod
    public void discoverPrinters(PluginCall call) {
        JSObject result = new JSObject();
        JSArray printers = new JSArray();

        // Check Sunmi (PrinterX SDK)
        if (activePrinterType == PrinterType.SUNMI && sunmiPrinter != null) {
            JSObject sunmi = new JSObject();
            sunmi.put("name", "Sunmi Built-in Printer");
            sunmi.put("address", "sunmi");
            sunmi.put("type", "sunmi");
            sunmi.put("connected", true);
            printers.put(sunmi);
        }

        // List Bluetooth devices
        try {
            BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
            if (adapter != null && adapter.isEnabled()) {
                if (ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED) {
                    Set<BluetoothDevice> pairedDevices = adapter.getBondedDevices();
                    for (BluetoothDevice device : pairedDevices) {
                        JSObject bt = new JSObject();
                        bt.put("name", device.getName() != null ? device.getName() : "Unknown");
                        bt.put("address", device.getAddress());
                        bt.put("type", "bluetooth");
                        bt.put("connected", bluetoothSocket != null && bluetoothSocket.isConnected() 
                            && device.getAddress().equals(bluetoothSocket.getRemoteDevice().getAddress()));
                        printers.put(bt);
                    }
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error listing Bluetooth devices", e);
        }

        // List USB devices
        try {
            UsbManager usbManager = (UsbManager) getContext().getSystemService(android.content.Context.USB_SERVICE);
            HashMap<String, UsbDevice> deviceList = usbManager.getDeviceList();
            for (UsbDevice device : deviceList.values()) {
                // Filter for printer class (0x07)
                if (device.getDeviceClass() == 7 || hasInterface(device, 7)) {
                    JSObject usb = new JSObject();
                    usb.put("name", device.getProductName() != null ? device.getProductName() : "USB Printer");
                    usb.put("address", device.getDeviceName());
                    usb.put("type", "usb");
                    usb.put("connected", usbConnection != null);
                    printers.put(usb);
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error listing USB devices", e);
        }

        result.put("printers", printers);
        call.resolve(result);
    }

    private boolean hasInterface(UsbDevice device, int interfaceClass) {
        for (int i = 0; i < device.getInterfaceCount(); i++) {
            if (device.getInterface(i).getInterfaceClass() == interfaceClass) {
                return true;
            }
        }
        return false;
    }

    @PluginMethod
    public void connect(PluginCall call) {
        String address = call.getString("address", "");
        String type = call.getString("type", "auto");

        if ("sunmi".equals(address) || "sunmi".equals(type)) {
            // If already connected via PrinterX, resolve immediately
            if (activePrinterType == PrinterType.SUNMI && sunmiPrinter != null) {
                call.resolve();
                return;
            }
            // Try PrinterX SDK
            if (connectSunmi()) {
                call.resolve();
            } else {
                call.reject("Sunmi printer not available");
            }
            return;
        }

        if ("bluetooth".equals(type)) {
            connectBluetooth(address, call);
            return;
        }

        if ("usb".equals(type)) {
            connectUsb(address, call);
            return;
        }

        call.reject("Unknown printer type");
    }

    private void connectBluetooth(String address, PluginCall call) {
        try {
            BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
            if (adapter == null) {
                call.reject("Bluetooth not available");
                return;
            }

            BluetoothDevice device = adapter.getRemoteDevice(address);
            if (ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
                call.reject("Bluetooth permission not granted");
                return;
            }

            // Close existing connection
            disconnectBluetooth();

            bluetoothSocket = device.createRfcommSocketToServiceRecord(SPP_UUID);
            bluetoothSocket.connect();
            bluetoothOutputStream = bluetoothSocket.getOutputStream();
            
            activePrinterType = PrinterType.BLUETOOTH;
            isConnected = true;
            
            Log.i(TAG, "Connected to Bluetooth printer: " + device.getName());
            
            JSObject ret = new JSObject();
            ret.put("connected", true);
            ret.put("type", "bluetooth");
            ret.put("name", device.getName());
            notifyListeners("printerConnected", ret);
            
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Bluetooth connection failed", e);
            call.reject("Failed to connect: " + e.getMessage());
        }
    }

    private void connectUsb(String deviceName, PluginCall call) {
        try {
            UsbManager usbManager = (UsbManager) getContext().getSystemService(android.content.Context.USB_SERVICE);
            UsbDevice device = usbManager.getDeviceList().get(deviceName);
            
            if (device == null) {
                call.reject("USB device not found");
                return;
            }

            if (!usbManager.hasPermission(device)) {
                call.reject("USB permission not granted");
                return;
            }

            disconnectUsb();

            usbConnection = usbManager.openDevice(device);
            UsbInterface intf = device.getInterface(0);
            usbConnection.claimInterface(intf, true);

            for (int i = 0; i < intf.getEndpointCount(); i++) {
                UsbEndpoint ep = intf.getEndpoint(i);
                if (ep.getDirection() == android.hardware.usb.UsbConstants.USB_DIR_OUT) {
                    usbEndpoint = ep;
                    break;
                }
            }

            if (usbEndpoint == null) {
                call.reject("No output endpoint found");
                return;
            }

            activePrinterType = PrinterType.USB;
            isConnected = true;
            
            Log.i(TAG, "Connected to USB printer: " + device.getProductName());
            
            JSObject ret = new JSObject();
            ret.put("connected", true);
            ret.put("type", "usb");
            ret.put("name", device.getProductName());
            notifyListeners("printerConnected", ret);
            
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "USB connection failed", e);
            call.reject("Failed to connect: " + e.getMessage());
        }
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        disconnectBluetooth();
        disconnectUsb();
        // Keep Sunmi connected if available
        if (activePrinterType != PrinterType.SUNMI) {
            activePrinterType = PrinterType.NONE;
            isConnected = false;
        }
        call.resolve();
    }

    private void disconnectBluetooth() {
        try {
            if (bluetoothOutputStream != null) bluetoothOutputStream.close();
            if (bluetoothSocket != null) bluetoothSocket.close();
        } catch (IOException e) {
            Log.e(TAG, "Error disconnecting Bluetooth", e);
        }
        bluetoothOutputStream = null;
        bluetoothSocket = null;
    }

    private void disconnectUsb() {
        if (usbConnection != null) {
            usbConnection.close();
        }
        usbConnection = null;
        usbEndpoint = null;
    }

    @PluginMethod
    public void getPrinterStatus(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("connected", isConnected);
        ret.put("type", activePrinterType.name().toLowerCase());
        
        if (isConnected) {
            ret.put("status", 1);
            ret.put("message", "Connected via " + activePrinterType.name());
        } else {
            ret.put("status", -1);
            ret.put("message", "Not connected");
        }
        
        call.resolve(ret);
    }

    @PluginMethod
    public void printerInit(PluginCall call) {
        if (!checkPrinter(call)) return;
        
        try {
            if (activePrinterType == PrinterType.SUNMI) {
                // Sunmi PrinterX handles init
            } else if (activePrinterType == PrinterType.SUNMI_AIDL) {
                sunmiAidlService.getClass().getMethod("printerInit", Object.class)
                    .invoke(sunmiAidlService, (Object) null);
            } else {
                writeEscPos(ESC_INIT);
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to init printer", e);
        }
    }

    @PluginMethod
    public void setAlignment(PluginCall call) {
        if (!checkPrinter(call)) return;
        
        int alignment = call.getInt("alignment", 0);
        try {
            if (activePrinterType == PrinterType.SUNMI_AIDL) {
                sunmiAidlService.getClass().getMethod("setAlignment", int.class, Object.class)
                    .invoke(sunmiAidlService, alignment, null);
            } else if (activePrinterType != PrinterType.SUNMI) {
                switch (alignment) {
                    case 1: writeEscPos(ESC_ALIGN_CENTER); break;
                    case 2: writeEscPos(ESC_ALIGN_RIGHT); break;
                    default: writeEscPos(ESC_ALIGN_LEFT); break;
                }
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to set alignment", e);
        }
    }

    @PluginMethod
    public void setFontSize(PluginCall call) {
        if (!checkPrinter(call)) return;
        
        int size = call.getInt("size", 24);
        try {
            if (activePrinterType == PrinterType.SUNMI_AIDL) {
                sunmiAidlService.getClass().getMethod("setFontSize", float.class, Object.class)
                    .invoke(sunmiAidlService, (float) size, null);
            } else if (activePrinterType != PrinterType.SUNMI) {
                if (size >= 48) {
                    writeEscPos(ESC_DOUBLE_SIZE);
                } else if (size >= 36) {
                    writeEscPos(ESC_DOUBLE_HEIGHT);
                } else {
                    writeEscPos(ESC_NORMAL_SIZE);
                }
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to set font size", e);
        }
    }

    @PluginMethod
    public void printText(PluginCall call) {
        if (!checkPrinter(call)) return;

        String text = call.getString("text", "");
        try {
            if (activePrinterType == PrinterType.SUNMI) {
                Object lineApi = sunmiPrinter.getClass().getMethod("lineApi").invoke(sunmiPrinter);
                // Log available methods for debugging
                for (java.lang.reflect.Method m : lineApi.getClass().getMethods()) {
                    if (m.getName().contains("print") || m.getName().contains("add") || m.getName().contains("text")) {
                        Log.d(TAG, "LineApi method: " + m.getName() + " params: " + java.util.Arrays.toString(m.getParameterTypes()));
                    }
                }
                // Try different method signatures
                boolean printed = false;
                // Try 1: printText(String, BaseStyle)
                for (java.lang.reflect.Method m : lineApi.getClass().getMethods()) {
                    if (m.getName().equals("printText") && m.getParameterCount() == 2) {
                        Class<?>[] params = m.getParameterTypes();
                        if (params[0] == String.class) {
                            m.invoke(lineApi, text, null);
                            printed = true;
                            Log.d(TAG, "Used printText with params: " + java.util.Arrays.toString(params));
                            break;
                        }
                    }
                }
                // Try 2: printText(String)
                if (!printed) {
                    for (java.lang.reflect.Method m : lineApi.getClass().getMethods()) {
                        if (m.getName().equals("printText") && m.getParameterCount() == 1) {
                            m.invoke(lineApi, text);
                            printed = true;
                            break;
                        }
                    }
                }
                if (!printed) {
                    throw new Exception("No suitable printText method found");
                }
            } else if (activePrinterType == PrinterType.SUNMI_AIDL) {
                sunmiAidlService.getClass().getMethod("printText", String.class, Object.class)
                    .invoke(sunmiAidlService, text, null);
            } else {
                writeEscPos(text.getBytes("GBK"));
            }
            call.resolve();
        } catch (Exception e) {
            Log.e(TAG, "printText error", e);
            call.reject("Failed to print text: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void printTextWithFont(PluginCall call) {
        if (!checkPrinter(call)) return;

        String text = call.getString("text", "");
        int fontSize = call.getInt("fontSize", 24);
        try {
            if (activePrinterType == PrinterType.SUNMI) {
                printTextSunmiWithFont(text, fontSize);
            } else if (activePrinterType == PrinterType.SUNMI_AIDL) {
                printTextSunmiAidl(text, fontSize);
            } else {
                if (fontSize >= 48) writeEscPos(ESC_DOUBLE_SIZE);
                else if (fontSize >= 36) writeEscPos(ESC_DOUBLE_HEIGHT);
                writeEscPos(text.getBytes("GBK"));
                writeEscPos(ESC_NORMAL_SIZE);
            }
            call.resolve();
        } catch (Exception e) {
            Log.e(TAG, "printTextWithFont error: " + e.getMessage(), e);
            call.reject("Failed to print text with font: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void printTextStyled(PluginCall call) {
        if (!checkPrinter(call)) return;
        
        String text = call.getString("text", "");
        int fontSize = call.getInt("fontSize", 24);
        int alignment = call.getInt("alignment", 0); // 0=LEFT, 1=CENTER, 2=RIGHT
        boolean bold = call.getBoolean("bold", false);
        
        try {
            if (activePrinterType == PrinterType.SUNMI) {
                printTextSunmiStyled(text, fontSize, alignment, bold);
            } else if (activePrinterType == PrinterType.SUNMI_AIDL) {
                // Set alignment first
                sunmiAidlService.getClass().getMethod("setAlignment", int.class, Object.class)
                    .invoke(sunmiAidlService, alignment, null);
                printTextSunmiAidl(text, fontSize);
            } else {
                // ESC/POS
                switch (alignment) {
                    case 1: writeEscPos(ESC_ALIGN_CENTER); break;
                    case 2: writeEscPos(ESC_ALIGN_RIGHT); break;
                    default: writeEscPos(ESC_ALIGN_LEFT); break;
                }
                if (bold) writeEscPos(ESC_BOLD_ON);
                if (fontSize >= 48) writeEscPos(ESC_DOUBLE_SIZE);
                else if (fontSize >= 36) writeEscPos(ESC_DOUBLE_HEIGHT);
                writeEscPos(text.getBytes("GBK"));
                writeEscPos(ESC_NORMAL_SIZE);
                if (bold) writeEscPos(ESC_BOLD_OFF);
                writeEscPos(ESC_ALIGN_LEFT); // Reset alignment
            }
            call.resolve();
        } catch (Exception e) {
            Log.e(TAG, "printTextStyled error: " + e.getMessage(), e);
            call.reject("Failed to print styled text: " + e.getMessage(), e);
        }
    }

    private void printTextSunmiStyled(String text, int fontSize, int alignment, boolean bold) throws Exception {
        Object lineApi = sunmiPrinter.getClass().getMethod("lineApi").invoke(sunmiPrinter);
        
        try {
            // Build text style
            Class<?> textStyleClass = Class.forName("com.sunmi.printerx.style.TextStyle");
            Object textStyle = textStyleClass.getMethod("getStyle").invoke(null);
            
            // Set font size
            try {
                textStyleClass.getMethod("setTextSize", int.class).invoke(textStyle, fontSize);
            } catch (Exception e) {
                Log.d(TAG, "setTextSize not available: " + e.getMessage());
            }
            
            // Set alignment
            try {
                Class<?> alignClass = Class.forName("com.sunmi.printerx.enums.Align");
                Object alignValue = null;
                String alignName = alignment == 1 ? "CENTER" : alignment == 2 ? "RIGHT" : "LEFT";
                for (Object enumConstant : alignClass.getEnumConstants()) {
                    if (enumConstant.toString().equals(alignName)) {
                        alignValue = enumConstant;
                        break;
                    }
                }
                if (alignValue != null) {
                    textStyleClass.getMethod("setAlign", alignClass).invoke(textStyle, alignValue);
                    Log.d(TAG, "Set text alignment to " + alignName);
                }
            } catch (Exception e) {
                Log.d(TAG, "setAlign not available: " + e.getMessage());
            }
            
            // Set bold
            if (bold) {
                try {
                    textStyleClass.getMethod("enableBold", boolean.class).invoke(textStyle, true);
                } catch (Exception e) {
                    Log.d(TAG, "enableBold not available: " + e.getMessage());
                }
            }
            
            lineApi.getClass().getMethod("printText", String.class, textStyleClass).invoke(lineApi, text, textStyle);
        } catch (Exception e) {
            // Fallback: print without style
            Log.d(TAG, "printText styled failed, using basic: " + e.getMessage());
            Class<?> textStyleClass = Class.forName("com.sunmi.printerx.style.TextStyle");
            lineApi.getClass().getMethod("printText", String.class, textStyleClass).invoke(lineApi, text, null);
        }
    }

    private void printTextSunmi(String text) throws Exception {
        Object lineApi = sunmiPrinter.getClass().getMethod("lineApi").invoke(sunmiPrinter);
        // Try printText with null style
        try {
            Class<?> textStyleClass = Class.forName("com.sunmi.printerx.style.TextStyle");
            lineApi.getClass().getMethod("printText", String.class, textStyleClass).invoke(lineApi, text, null);
        } catch (Exception e) {
            Log.d(TAG, "printText with style failed: " + e.getMessage());
            throw e;
        }
    }

    private void printTextSunmiWithFont(String text, int fontSize) throws Exception {
        Object lineApi = sunmiPrinter.getClass().getMethod("lineApi").invoke(sunmiPrinter);
        
        try {
            // Build text style
            Class<?> textStyleClass = Class.forName("com.sunmi.printerx.style.TextStyle");
            Object textStyle = textStyleClass.getMethod("getStyle").invoke(null);
            
            // Set font size
            try {
                textStyleClass.getMethod("setTextSize", int.class).invoke(textStyle, fontSize);
            } catch (Exception e) {
                Log.d(TAG, "setTextSize not available: " + e.getMessage());
            }
            
            lineApi.getClass().getMethod("printText", String.class, textStyleClass).invoke(lineApi, text, textStyle);
        } catch (Exception e) {
            // Fallback: print without style
            Log.d(TAG, "printText with font failed, using basic: " + e.getMessage());
            Class<?> textStyleClass = Class.forName("com.sunmi.printerx.style.TextStyle");
            lineApi.getClass().getMethod("printText", String.class, textStyleClass).invoke(lineApi, text, null);
        }
    }

    private void printTextSunmiAidl(String text, int fontSize) throws Exception {
        if (sunmiAidlService == null) throw new Exception("AIDL service not connected");
        
        // Set font size first
        sunmiAidlService.getClass().getMethod("setFontSize", float.class, Object.class)
            .invoke(sunmiAidlService, (float) fontSize, null);
        
        // Print text
        sunmiAidlService.getClass().getMethod("printText", String.class, Object.class)
            .invoke(sunmiAidlService, text, null);
    }

    @PluginMethod
    public void printColumnsText(PluginCall call) {
        if (!checkPrinter(call)) return;
        
        try {
            JSArray texts = call.getArray("texts");
            JSArray widths = call.getArray("widths");
            JSArray aligns = call.getArray("aligns");
            
            if (texts == null || texts.length() == 0) {
                call.resolve();
                return;
            }
            
            // Build formatted line
            StringBuilder line = new StringBuilder();
            
            for (int i = 0; i < texts.length(); i++) {
                String text = texts.getString(i);
                int width = i < widths.length() ? widths.getInt(i) : 10;
                int align = i < aligns.length() ? aligns.getInt(i) : 0;
                
                // Pad/truncate text to width
                if (text.length() > width) {
                    text = text.substring(0, width);
                }
                
                if (align == 0) { // Left
                    line.append(String.format("%-" + width + "s", text));
                } else if (align == 1) { // Center
                    int pad = (width - text.length()) / 2;
                    line.append(String.format("%" + (pad + text.length()) + "s", text));
                    line.append(String.format("%-" + (width - pad - text.length()) + "s", ""));
                } else { // Right
                    line.append(String.format("%" + width + "s", text));
                }
            }
            line.append("\n");
            
            // Print using dynamic method lookup
            if (activePrinterType == PrinterType.SUNMI) {
                Object lineApi = sunmiPrinter.getClass().getMethod("lineApi").invoke(sunmiPrinter);
                boolean printed = false;
                for (java.lang.reflect.Method m : lineApi.getClass().getMethods()) {
                    if (m.getName().equals("printText") && m.getParameterCount() == 2) {
                        Class<?>[] params = m.getParameterTypes();
                        if (params[0] == String.class) {
                            m.invoke(lineApi, line.toString(), null);
                            printed = true;
                            break;
                        }
                    }
                }
                if (!printed) {
                    for (java.lang.reflect.Method m : lineApi.getClass().getMethods()) {
                        if (m.getName().equals("printText") && m.getParameterCount() == 1) {
                            m.invoke(lineApi, line.toString());
                            printed = true;
                            break;
                        }
                    }
                }
            } else if (activePrinterType == PrinterType.SUNMI_AIDL) {
                sunmiAidlService.getClass().getMethod("printText", String.class, Object.class)
                    .invoke(sunmiAidlService, line.toString(), null);
            } else {
                writeEscPos(line.toString().getBytes("GBK"));
            }
            
            call.resolve();
        } catch (Exception e) {
            Log.e(TAG, "printColumnsText error", e);
            call.reject("Failed to print columns: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void printQRCode(PluginCall call) {
        if (!checkPrinter(call)) return;

        String data = call.getString("data", "");
        int moduleSize = call.getInt("moduleSize", 8);
        int alignment = call.getInt("alignment", 1); // Default to CENTER (1)
        try {
            if (activePrinterType == PrinterType.SUNMI) {
                Object lineApi = sunmiPrinter.getClass().getMethod("lineApi").invoke(sunmiPrinter);
                
                // Try to create QrStyle with alignment
                boolean printed = false;
                try {
                    Class<?> qrStyleClass = Class.forName("com.sunmi.printerx.style.QrStyle");
                    Object qrStyle = qrStyleClass.getMethod("getStyle").invoke(null);
                    
                    // Set alignment
                    try {
                        Class<?> alignClass = Class.forName("com.sunmi.printerx.enums.Align");
                        Object alignValue = null;
                        String alignName = alignment == 1 ? "CENTER" : alignment == 2 ? "RIGHT" : "LEFT";
                        for (Object enumConstant : alignClass.getEnumConstants()) {
                            if (enumConstant.toString().equals(alignName)) {
                                alignValue = enumConstant;
                                break;
                            }
                        }
                        if (alignValue != null) {
                            qrStyleClass.getMethod("setAlign", alignClass).invoke(qrStyle, alignValue);
                            Log.d(TAG, "Set QR alignment to " + alignName);
                        }
                    } catch (Exception e) {
                        Log.d(TAG, "Could not set QR alignment: " + e.getMessage());
                    }
                    
                    // Set dot size if method exists
                    try {
                        qrStyleClass.getMethod("setDot", int.class).invoke(qrStyle, moduleSize);
                    } catch (Exception e) {
                        Log.d(TAG, "Could not set QR dot size: " + e.getMessage());
                    }
                    
                    // Print with style
                    lineApi.getClass().getMethod("printQrCode", String.class, qrStyleClass)
                        .invoke(lineApi, data, qrStyle);
                    printed = true;
                    Log.d(TAG, "Printed QR code with QrStyle");
                } catch (Exception e) {
                    Log.d(TAG, "printQrCode with style failed: " + e.getMessage());
                }
                
                // Fallback: try dynamic method lookup
                if (!printed) {
                    for (java.lang.reflect.Method m : lineApi.getClass().getMethods()) {
                        if (m.getName().equals("printQrCode") && m.getParameterCount() == 2) {
                            Class<?>[] params = m.getParameterTypes();
                            if (params[0] == String.class) {
                                m.invoke(lineApi, data, null);
                                printed = true;
                                Log.d(TAG, "Used printQrCode with params: " + java.util.Arrays.toString(params));
                                break;
                            }
                        }
                    }
                }
                if (!printed) {
                    for (java.lang.reflect.Method m : lineApi.getClass().getMethods()) {
                        if (m.getName().equals("printQrCode") && m.getParameterCount() == 1) {
                            m.invoke(lineApi, data);
                            printed = true;
                            break;
                        }
                    }
                }
                if (!printed) {
                    Log.e(TAG, "No suitable printQrCode method found");
                }
            } else if (activePrinterType == PrinterType.SUNMI_AIDL) {
                sunmiAidlService.getClass().getMethod("printQRCode", String.class, int.class, int.class, Object.class)
                    .invoke(sunmiAidlService, data, moduleSize, 3, null);
            } else {
                // ESC/POS QR Code commands
                byte[] qrData = data.getBytes("UTF-8");
                int len = qrData.length + 3;
                byte[] cmd = new byte[] {
                    0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, (byte) moduleSize,
                    0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, 0x30,
                    0x1D, 0x28, 0x6B, (byte) (len % 256), (byte) (len / 256), 0x31, 0x50, 0x30
                };
                writeEscPos(cmd);
                writeEscPos(qrData);
                writeEscPos(new byte[] { 0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30 });
            }
            call.resolve();
        } catch (Exception e) {
            Log.e(TAG, "printQRCode error", e);
            call.reject("Failed to print QR code: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void printBitmap(PluginCall call) {
        if (!checkPrinter(call)) return;
        
        String base64 = call.getString("bitmap", "");
        int alignment = call.getInt("alignment", 1); // Default to CENTER (1)
        if (base64.isEmpty()) {
            call.resolve();
            return;
        }
        
        try {
            // Decode base64 to bitmap
            byte[] decodedBytes = android.util.Base64.decode(base64, android.util.Base64.DEFAULT);
            android.graphics.Bitmap bitmap = android.graphics.BitmapFactory.decodeByteArray(decodedBytes, 0, decodedBytes.length);
            
            if (bitmap == null) {
                call.reject("Failed to decode bitmap");
                return;
            }
            
            if (activePrinterType == PrinterType.SUNMI) {
                Object lineApi = sunmiPrinter.getClass().getMethod("lineApi").invoke(sunmiPrinter);
                
                // Log available bitmap methods
                for (java.lang.reflect.Method m : lineApi.getClass().getMethods()) {
                    if (m.getName().toLowerCase().contains("bitmap") || m.getName().toLowerCase().contains("image")) {
                        Log.d(TAG, "Bitmap method: " + m.getName() + " params: " + java.util.Arrays.toString(m.getParameterTypes()));
                    }
                }
                
                // Try to create BitmapStyle with DITHERING algorithm and alignment
                boolean printed = false;
                try {
                    Class<?> bitmapStyleClass = Class.forName("com.sunmi.printerx.style.BitmapStyle");
                    Object bitmapStyle = bitmapStyleClass.getMethod("getStyle").invoke(null);
                    
                    // Set alignment
                    try {
                        Class<?> alignClass = Class.forName("com.sunmi.printerx.enums.Align");
                        Object alignValue = null;
                        String alignName = alignment == 1 ? "CENTER" : alignment == 2 ? "RIGHT" : "LEFT";
                        for (Object enumConstant : alignClass.getEnumConstants()) {
                            if (enumConstant.toString().equals(alignName)) {
                                alignValue = enumConstant;
                                break;
                            }
                        }
                        if (alignValue != null) {
                            bitmapStyleClass.getMethod("setAlign", alignClass).invoke(bitmapStyle, alignValue);
                            Log.d(TAG, "Set bitmap alignment to " + alignName);
                        }
                    } catch (Exception e) {
                        Log.d(TAG, "Could not set alignment: " + e.getMessage());
                    }
                    
                    // Try to set algorithm to DITHERING (better for logos)
                    try {
                        Class<?> algorithmClass = Class.forName("com.sunmi.printerx.enums.ImageAlgorithm");
                        Object dithering = null;
                        for (Object enumConstant : algorithmClass.getEnumConstants()) {
                            if (enumConstant.toString().equals("DITHERING")) {
                                dithering = enumConstant;
                                break;
                            }
                        }
                        if (dithering != null) {
                            bitmapStyleClass.getMethod("setAlgorithm", algorithmClass).invoke(bitmapStyle, dithering);
                            Log.d(TAG, "Set image algorithm to DITHERING");
                        }
                    } catch (Exception e) {
                        Log.d(TAG, "Could not set algorithm: " + e.getMessage());
                    }
                    
                    // Print with style
                    lineApi.getClass().getMethod("printBitmap", android.graphics.Bitmap.class, bitmapStyleClass)
                        .invoke(lineApi, bitmap, bitmapStyle);
                    printed = true;
                    Log.d(TAG, "Printed bitmap with BitmapStyle");
                } catch (Exception e) {
                    Log.d(TAG, "printBitmap with style failed: " + e.getMessage());
                }
                
                // Fallback: try dynamic method lookup
                if (!printed) {
                    for (java.lang.reflect.Method m : lineApi.getClass().getMethods()) {
                        if (m.getName().equals("printBitmap") && m.getParameterCount() == 2) {
                            Class<?>[] params = m.getParameterTypes();
                            if (params[0] == android.graphics.Bitmap.class) {
                                m.invoke(lineApi, bitmap, null);
                                printed = true;
                                Log.d(TAG, "Used printBitmap with null style");
                                break;
                            }
                        }
                    }
                }
                
                if (!printed) {
                    Log.e(TAG, "No suitable printBitmap method found");
                }
            } else if (activePrinterType == PrinterType.SUNMI_AIDL) {
                sunmiAidlService.getClass().getMethod("printBitmap", android.graphics.Bitmap.class, Object.class)
                    .invoke(sunmiAidlService, bitmap, null);
            }
            
            call.resolve();
        } catch (Exception e) {
            Log.e(TAG, "printBitmap error", e);
            call.reject("Failed to print bitmap: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void lineWrap(PluginCall call) {
        if (!checkPrinter(call)) return;

        int lines = call.getInt("lines", 3);
        try {
            if (activePrinterType == PrinterType.SUNMI) {
                Object lineApi = sunmiPrinter.getClass().getMethod("lineApi").invoke(sunmiPrinter);
                StringBuilder sb = new StringBuilder();
                for (int i = 0; i < lines; i++) {
                    sb.append("\n");
                }
                // Use dynamic method lookup
                boolean printed = false;
                for (java.lang.reflect.Method m : lineApi.getClass().getMethods()) {
                    if (m.getName().equals("printText") && m.getParameterCount() == 2) {
                        Class<?>[] params = m.getParameterTypes();
                        if (params[0] == String.class) {
                            m.invoke(lineApi, sb.toString(), null);
                            printed = true;
                            break;
                        }
                    }
                }
                if (!printed) {
                    for (java.lang.reflect.Method m : lineApi.getClass().getMethods()) {
                        if (m.getName().equals("printText") && m.getParameterCount() == 1) {
                            m.invoke(lineApi, sb.toString());
                            printed = true;
                            break;
                        }
                    }
                }
            } else if (activePrinterType == PrinterType.SUNMI_AIDL) {
                sunmiAidlService.getClass().getMethod("lineWrap", int.class, Object.class)
                    .invoke(sunmiAidlService, lines, null);
            } else {
                writeEscPos(new byte[] { ESC_FEED_LINES[0], ESC_FEED_LINES[1], (byte) lines });
            }
            call.resolve();
        } catch (Exception e) {
            Log.e(TAG, "lineWrap error", e);
            call.reject("Failed to line wrap: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void cutPaper(PluginCall call) {
        if (!checkPrinter(call)) return;
        
        try {
            if (activePrinterType == PrinterType.SUNMI) {
                Object lineApi = sunmiPrinter.getClass().getMethod("lineApi").invoke(sunmiPrinter);
                lineApi.getClass().getMethod("autoOut").invoke(lineApi);
            } else if (activePrinterType == PrinterType.SUNMI_AIDL) {
                sunmiAidlService.getClass().getMethod("cutPaper", Object.class)
                    .invoke(sunmiAidlService, (Object) null);
            } else {
                writeEscPos(new byte[] { 0x1B, 0x64, 0x05 }); // Feed 5 lines
                writeEscPos(ESC_CUT_PAPER);
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to cut paper", e);
        }
    }

    @PluginMethod
    public void openDrawer(PluginCall call) {
        if (!checkPrinter(call)) return;
        
        try {
            if (activePrinterType == PrinterType.SUNMI) {
                Object api = sunmiPrinter.getClass().getMethod("cashDrawerApi").invoke(sunmiPrinter);
                api.getClass().getMethod("open").invoke(api);
            } else if (activePrinterType == PrinterType.SUNMI_AIDL) {
                sunmiAidlService.getClass().getMethod("openDrawer", Object.class)
                    .invoke(sunmiAidlService, (Object) null);
            } else {
                writeEscPos(ESC_OPEN_DRAWER);
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to open drawer", e);
        }
    }

    @PluginMethod
    public void printReceipt(PluginCall call) {
        if (!checkPrinter(call)) return;
        
        try {
            if (activePrinterType == PrinterType.SUNMI) {
                Object lineApi = sunmiPrinter.getClass().getMethod("lineApi").invoke(sunmiPrinter);
                lineApi.getClass().getMethod("autoOut").invoke(lineApi);
            } else if (activePrinterType == PrinterType.SUNMI_AIDL) {
                // Line wrap to feed paper out, then cut
                sunmiAidlService.getClass().getMethod("lineWrap", int.class, Object.class)
                    .invoke(sunmiAidlService, 4, null);
                sunmiAidlService.getClass().getMethod("cutPaper", Object.class)
                    .invoke(sunmiAidlService, (Object) null);
            } else {
                writeEscPos(new byte[] { 0x1B, 0x64, 0x05 }); // Feed
                writeEscPos(ESC_CUT_PAPER);
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to complete print", e);
        }
    }

    /**
     * Write ESC/POS data to connected printer
     */
    private void writeEscPos(byte[] data) throws IOException {
        if (activePrinterType == PrinterType.BLUETOOTH && bluetoothOutputStream != null) {
            bluetoothOutputStream.write(data);
            bluetoothOutputStream.flush();
        } else if (activePrinterType == PrinterType.USB && usbConnection != null && usbEndpoint != null) {
            usbConnection.bulkTransfer(usbEndpoint, data, data.length, 5000);
        }
    }

    private boolean checkPrinter(PluginCall call) {
        if (!isConnected) {
            call.reject("Printer not connected");
            return false;
        }
        return true;
    }

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        disconnectBluetooth();
        disconnectUsb();
        try {
            Class<?> sdk = Class.forName("com.sunmi.printerx.PrinterSdk");
            sdk.getMethod("destroy").invoke(sdk.getMethod("getInstance").invoke(null));
        } catch (Exception ignored) {}
    }
}

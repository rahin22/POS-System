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
    private enum PrinterType { NONE, SUNMI, BLUETOOTH, USB }
    
    private PrinterType activePrinterType = PrinterType.NONE;
    private Object sunmiPrinter = null;
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
        // Try Sunmi first
        if (connectSunmi()) {
            Log.i(TAG, "Connected to Sunmi built-in printer");
            return;
        }
        Log.i(TAG, "Sunmi not available, will use Bluetooth/USB when connected");
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

        // Check Sunmi
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
                // Sunmi handles init
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
            if (activePrinterType != PrinterType.SUNMI) {
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
            if (activePrinterType != PrinterType.SUNMI) {
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
                printTextSunmi(text);
            } else {
                writeEscPos(text.getBytes("GBK"));
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to print text", e);
        }
    }

    @PluginMethod
    public void printTextWithFont(PluginCall call) {
        if (!checkPrinter(call)) return;

        String text = call.getString("text", "");
        int fontSize = call.getInt("fontSize", 24);
        try {
            if (activePrinterType == PrinterType.SUNMI) {
                printTextSunmi(text);
            } else {
                if (fontSize >= 48) writeEscPos(ESC_DOUBLE_SIZE);
                else if (fontSize >= 36) writeEscPos(ESC_DOUBLE_HEIGHT);
                writeEscPos(text.getBytes("GBK"));
                writeEscPos(ESC_NORMAL_SIZE);
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to print text with font", e);
        }
    }

    private void printTextSunmi(String text) throws Exception {
        Object lineApi = sunmiPrinter.getClass().getMethod("lineApi").invoke(sunmiPrinter);
        lineApi.getClass().getMethod("printText", String.class).invoke(lineApi, text);
    }

    @PluginMethod
    public void printColumnsText(PluginCall call) {
        call.resolve();
    }

    @PluginMethod
    public void printQRCode(PluginCall call) {
        if (!checkPrinter(call)) return;

        String data = call.getString("data", "");
        int moduleSize = call.getInt("moduleSize", 8);
        try {
            if (activePrinterType == PrinterType.SUNMI) {
                Object lineApi = sunmiPrinter.getClass().getMethod("lineApi").invoke(sunmiPrinter);
                lineApi.getClass().getMethod("printQrCode", String.class, int.class).invoke(lineApi, data, moduleSize);
            } else {
                // ESC/POS QR Code commands
                byte[] qrData = data.getBytes("UTF-8");
                int len = qrData.length + 3;
                byte[] cmd = new byte[] {
                    0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, (byte) moduleSize,  // Set size
                    0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, 0x30,                // Error correction
                    0x1D, 0x28, 0x6B, (byte) (len % 256), (byte) (len / 256), 0x31, 0x50, 0x30  // Store data
                };
                writeEscPos(cmd);
                writeEscPos(qrData);
                writeEscPos(new byte[] { 0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30 }); // Print
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to print QR code", e);
        }
    }

    @PluginMethod
    public void printBitmap(PluginCall call) {
        call.resolve();
    }

    @PluginMethod
    public void lineWrap(PluginCall call) {
        if (!checkPrinter(call)) return;

        int lines = call.getInt("lines", 3);
        try {
            if (activePrinterType == PrinterType.SUNMI) {
                Object lineApi = sunmiPrinter.getClass().getMethod("lineApi").invoke(sunmiPrinter);
                lineApi.getClass().getMethod("printBlankLines", int.class).invoke(lineApi, lines);
            } else {
                writeEscPos(new byte[] { ESC_FEED_LINES[0], ESC_FEED_LINES[1], (byte) lines });
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to line wrap", e);
        }
    }

    @PluginMethod
    public void cutPaper(PluginCall call) {
        if (!checkPrinter(call)) return;
        
        try {
            if (activePrinterType == PrinterType.SUNMI) {
                Object lineApi = sunmiPrinter.getClass().getMethod("lineApi").invoke(sunmiPrinter);
                lineApi.getClass().getMethod("autoOut").invoke(lineApi);
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

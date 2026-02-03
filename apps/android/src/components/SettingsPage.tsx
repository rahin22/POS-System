import { useState, useEffect } from 'react';
import { Settings, Printer, Info, RefreshCw } from 'lucide-react';
import { printer, appInfo, settings as platformSettings } from '../lib/platform';

export function SettingsPage() {
  const [printerStatus, setPrinterStatus] = useState<{ connected: boolean; error?: string }>({ connected: false });
  const [appVersion, setAppVersion] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [printerEnabled, setPrinterEnabled] = useState(true);

  useEffect(() => {
    loadInfo();
  }, []);

  const loadInfo = async () => {
    // Get app info
    const info = await appInfo.get();
    setAppVersion(info.version);
    
    // Get printer status
    const status = await printer.getStatus();
    setPrinterStatus(status);
    
    // Get printer enabled setting
    const enabled = await platformSettings.get('printerEnabled', true);
    setPrinterEnabled(enabled);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadInfo();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleTogglePrinter = async (enabled: boolean) => {
    setPrinterEnabled(enabled);
    await platformSettings.set('printerEnabled', enabled);
  };

  const handleTestPrint = async () => {
    const result = await printer.printReceipt({
      orderId: 'test',
      orderNumber: 999,
      orderType: 'takeaway',
      items: [
        { name: 'Test Item 1', quantity: 2, price: 10.00 },
        { name: 'Test Item 2', quantity: 1, price: 5.50 },
      ],
      subtotal: 25.50,
      gstAmount: 2.32,
      total: 25.50,
      paymentMethod: 'card',
      createdAt: new Date().toISOString(),
    });

    if (result.success) {
      alert('Test print sent successfully!');
    } else {
      alert(`Print failed: ${result.error}`);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-4 bg-gray-100">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Settings className="w-6 h-6" />
            Settings
          </h1>
          <button
            onClick={handleRefresh}
            className={`p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 active:bg-gray-100 ${isRefreshing ? 'animate-spin' : ''}`}
          >
            <RefreshCw className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Printer Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Printer className="w-5 h-5" />
            Printer
          </h2>

          <div className="space-y-4">
            {/* Printer Status */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">Built-in Printer</span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                printerStatus.connected 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-red-100 text-red-700'
              }`}>
                {printerStatus.connected ? 'Connected' : 'Not Connected'}
              </span>
            </div>

            {printerStatus.error && (
              <p className="text-sm text-red-600">{printerStatus.error}</p>
            )}

            {/* Enable/Disable Printer */}
            <div className="flex items-center justify-between">
              <span className="text-gray-700">Enable Printing</span>
              <button
                onClick={() => handleTogglePrinter(!printerEnabled)}
                className={`w-14 h-8 rounded-full transition-colors ${
                  printerEnabled ? 'bg-primary-600' : 'bg-gray-300'
                }`}
              >
                <div className={`w-6 h-6 bg-white rounded-full shadow transition-transform ${
                  printerEnabled ? 'translate-x-7' : 'translate-x-1'
                }`} />
              </button>
            </div>

            {/* Test Print */}
            <button
              onClick={handleTestPrint}
              disabled={!printerStatus.connected || !printerEnabled}
              className="w-full py-3 px-4 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 active:bg-primary-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Test Print
            </button>
          </div>
        </div>

        {/* App Info */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Info className="w-5 h-5" />
            App Information
          </h2>

          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Version</span>
              <span className="font-medium">{appVersion}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Platform</span>
              <span className="font-medium">Android (Sunmi T2s)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Architecture</span>
              <span className="font-medium">ARM64</span>
            </div>
          </div>
        </div>

        {/* Note about updates */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-sm text-blue-800">
            <strong>Updates:</strong> To update the app, download the latest APK from the releases page and install it manually, or check for updates in the Google Play Store (if published).
          </p>
        </div>
      </div>
    </div>
  );
}

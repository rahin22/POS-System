import { useState, useEffect, useRef } from 'react';
import { Settings, Printer, Info, RefreshCw, Image, QrCode, Trash2 } from 'lucide-react';
import { printer, appInfo, settings as platformSettings } from '../lib/platform';

// Default assets
import defaultLogoUrl from '../assets/receipt_logo.png';
import defaultQrCodeUrl from '../assets/review_qrcode.png';

export function SettingsPage() {
  const [printerStatus, setPrinterStatus] = useState<{ connected: boolean; error?: string }>({ connected: false });
  const [appVersion, setAppVersion] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [printerEnabled, setPrinterEnabled] = useState(true);
  const [customLogoPreview, setCustomLogoPreview] = useState<string | null>(null);
  const [customQrCodePreview, setCustomQrCodePreview] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const qrCodeInputRef = useRef<HTMLInputElement>(null);

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
    
    // Load custom images from storage
    const customLogo = await platformSettings.get('customLogoBase64', null);
    const customQrCode = await platformSettings.get('customQrCodeBase64', null);
    setCustomLogoPreview(customLogo);
    setCustomQrCodePreview(customQrCode);
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

  const handleImageUpload = async (file: File, type: 'logo' | 'qrcode') => {
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        // Remove data URL prefix for storage
        const base64Data = base64.split(',')[1] || base64;
        
        if (type === 'logo') {
          await platformSettings.set('customLogoBase64', base64Data);
          setCustomLogoPreview(base64Data);
        } else {
          await platformSettings.set('customQrCodeBase64', base64Data);
          setCustomQrCodePreview(base64Data);
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      alert(`Failed to upload image: ${error}`);
    }
  };

  const handleResetImage = async (type: 'logo' | 'qrcode') => {
    if (type === 'logo') {
      await platformSettings.set('customLogoBase64', null);
      setCustomLogoPreview(null);
    } else {
      await platformSettings.set('customQrCodeBase64', null);
      setCustomQrCodePreview(null);
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

        {/* Receipt Customization */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Image className="w-5 h-5" />
            Receipt Customization
          </h2>

          <div className="space-y-6">
            {/* Custom Logo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Receipt Logo
              </label>
              <div className="flex items-center gap-4">
                <div className="w-24 h-24 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden border border-gray-200">
                  <img 
                    src={customLogoPreview ? `data:image/png;base64,${customLogoPreview}` : defaultLogoUrl} 
                    alt="Logo" 
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
                <div className="flex-1 space-y-2">
                  <p className="text-sm text-gray-500">
                    {customLogoPreview ? 'Custom logo' : 'Using default logo'}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => logoInputRef.current?.click()}
                      className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 flex items-center gap-1"
                    >
                      <Image className="w-4 h-4" />
                      Change
                    </button>
                    {customLogoPreview && (
                      <button
                        onClick={() => handleResetImage('logo')}
                        className="px-3 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 flex items-center gap-1"
                      >
                        <Trash2 className="w-4 h-4" />
                        Reset
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageUpload(file, 'logo');
                }}
              />
            </div>

            {/* Custom QR Code */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Review QR Code
              </label>
              <div className="flex items-center gap-4">
                <div className="w-24 h-24 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden border border-gray-200">
                  <img 
                    src={customQrCodePreview ? `data:image/png;base64,${customQrCodePreview}` : defaultQrCodeUrl} 
                    alt="QR Code" 
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
                <div className="flex-1 space-y-2">
                  <p className="text-sm text-gray-500">
                    {customQrCodePreview ? 'Custom QR code' : 'Using default QR code'}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => qrCodeInputRef.current?.click()}
                      className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 flex items-center gap-1"
                    >
                      <QrCode className="w-4 h-4" />
                      Change
                    </button>
                    {customQrCodePreview && (
                      <button
                        onClick={() => handleResetImage('qrcode')}
                        className="px-3 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 flex items-center gap-1"
                      >
                        <Trash2 className="w-4 h-4" />
                        Reset
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <input
                ref={qrCodeInputRef}
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageUpload(file, 'qrcode');
                }}
              />
            </div>

            <p className="text-xs text-gray-500">
              For best results, use PNG images with transparent backgrounds. Logo should be black/white for thermal printing.
            </p>
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

import { useState, useEffect } from 'react';
import { Settings, Printer, RefreshCw, Monitor, Image, QrCode, Trash2 } from 'lucide-react';

export function SettingsPage() {
  const [settings, setSettings] = useState({
    apiUrl: '',
    kioskMode: false,
    printerEnabled: true,
    printerName: 'Element_RW973_Mk',
    vfdEnabled: false,
    vfdPort: '/dev/ttyUSB0',
    vfdBaudRate: 9600,
    customLogoPath: '',
    customQrCodePath: '',
  });
  const [saved, setSaved] = useState(false);
  const [availablePrinters, setAvailablePrinters] = useState<string[]>([]);
  const [availablePorts, setAvailablePorts] = useState<{ path: string; manufacturer?: string }[]>([]);
  const [vfdStatus, setVfdStatus] = useState<{ connected: boolean }>({ connected: false });
  const [printQueue, setPrintQueue] = useState<Array<{ job: string; user: string; size: string; date: string }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSettings();
    loadPrinters();
    loadPrintQueue();
    loadSerialPorts();
    loadVfdStatus();
  }, []);

  const loadSettings = async () => {
    if (window.electronAPI?.getSettings) {
      const currentSettings = await window.electronAPI.getSettings();
      setSettings(currentSettings);
    }
  };

  const loadPrinters = async () => {
    if (window.electronAPI?.getPrinters) {
      setLoading(true);
      const result = await window.electronAPI.getPrinters();
      if (result.success) {
        setAvailablePrinters(result.printers);
      }
      setLoading(false);
    }
  };

  const loadSerialPorts = async () => {
    if (window.electronAPI?.vfd?.listPorts) {
      const ports = await window.electronAPI.vfd.listPorts();
      setAvailablePorts(ports);
    }
  };

  const loadVfdStatus = async () => {
    if (window.electronAPI?.vfd?.status) {
      const status = await window.electronAPI.vfd.status();
      setVfdStatus(status);
    }
  };

  const connectVfd = async () => {
    if (window.electronAPI?.vfd?.connect) {
      const result = await window.electronAPI.vfd.connect(settings.vfdPort, settings.vfdBaudRate);
      if (result.success) {
        setVfdStatus({ connected: true });
      } else {
        alert('Failed to connect: ' + result.error);
      }
    }
  };

  const disconnectVfd = async () => {
    if (window.electronAPI?.vfd?.disconnect) {
      await window.electronAPI.vfd.disconnect();
      setVfdStatus({ connected: false });
    }
  };

  const testVfd = async () => {
    if (window.electronAPI?.vfd) {
      // Show a test total, then welcome
      await window.electronAPI.vfd.total(123.45);
      setTimeout(async () => {
        await window.electronAPI.vfd.welcome();
      }, 3000);
    }
  };

  const loadPrintQueue = async () => {
    if (window.electronAPI?.getPrintQueue) {
      const result = await window.electronAPI.getPrintQueue();
      if (result.success) {
        setPrintQueue(result.jobs);
      }
    }
  };

  const handleSave = async () => {
    if (window.electronAPI?.setSettings) {
      await window.electronAPI.setSettings(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  const handleRefresh = () => {
    loadPrinters();
    loadPrintQueue();
  };

  return (
    <div className="h-screen bg-gray-100 p-6 overflow-y-auto">
      <div className="max-w-2xl mx-auto pb-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center gap-3 mb-6">
            <Settings className="w-6 h-6" />
            <h1 className="text-2xl font-bold">Printer Configuration</h1>
          </div>

          <div className="space-y-6">
            {/* Printer Name */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Select Printer
                </label>
                <button
                  onClick={handleRefresh}
                  className="text-blue-600 hover:text-blue-700 p-1"
                  title="Refresh printers"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
              
              {availablePrinters.length > 0 ? (
                <select
                  value={settings.printerName}
                  onChange={(e) => setSettings({ ...settings, printerName: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {availablePrinters.map((printer) => (
                    <option key={printer} value={printer}>
                      {printer}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="text-sm text-gray-500 p-3 bg-gray-50 rounded-lg">
                  {loading ? 'Loading printers...' : 'No printers found. Make sure CUPS is configured.'}
                </div>
              )}
              
              <p className="mt-1 text-sm text-gray-500">
                Connected printers from CUPS
              </p>
            </div>

            {/* Print Queue */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Printer className="w-4 h-4 text-gray-600" />
                <label className="text-sm font-medium text-gray-700">
                  Print Queue
                </label>
              </div>
              
              {printQueue.length > 0 ? (
                <div className="border border-gray-300 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-gray-700">Job</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-700">User</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-700">Size</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-700">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {printQueue.map((job, idx) => (
                        <tr key={idx} className="border-t border-gray-200">
                          <td className="px-3 py-2">{job.job}</td>
                          <td className="px-3 py-2">{job.user}</td>
                          <td className="px-3 py-2">{job.size}</td>
                          <td className="px-3 py-2">{job.date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-sm text-gray-500 p-3 bg-gray-50 rounded-lg">
                  No pending print jobs
                </div>
              )}
            </div>

            {/* Printer Enabled */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Enable Printer
                </label>
                <p className="text-sm text-gray-500">
                  Print receipts automatically
                </p>
              </div>
              <button
                onClick={() => setSettings({ ...settings, printerEnabled: !settings.printerEnabled })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.printerEnabled ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.printerEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Kiosk Mode */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Kiosk Mode
                </label>
                <p className="text-sm text-gray-500">
                  Fullscreen mode without window controls
                </p>
              </div>
              <button
                onClick={() => setSettings({ ...settings, kioskMode: !settings.kioskMode })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.kioskMode ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.kioskMode ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* VFD Customer Display Section */}
            <div className="pt-4 border-t">
              <div className="flex items-center gap-2 mb-4">
                <Monitor className="w-5 h-5 text-gray-600" />
                <h2 className="text-lg font-semibold">Customer Display (VFD)</h2>
                <span className={`ml-auto px-2 py-0.5 text-xs rounded ${
                  vfdStatus.connected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {vfdStatus.connected ? 'Connected' : 'Disconnected'}
                </span>
              </div>

              {/* VFD Enabled Toggle */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Enable VFD Display
                  </label>
                  <p className="text-sm text-gray-500">
                    Show items and totals on customer display
                  </p>
                </div>
                <button
                  onClick={() => setSettings({ ...settings, vfdEnabled: !settings.vfdEnabled })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.vfdEnabled ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.vfdEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* VFD Port Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Serial Port
                </label>
                <div className="flex gap-2">
                  <select
                    value={settings.vfdPort}
                    onChange={(e) => setSettings({ ...settings, vfdPort: e.target.value })}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {availablePorts.length > 0 ? (
                      availablePorts.map((port) => (
                        <option key={port.path} value={port.path}>
                          {port.path} {port.manufacturer ? `(${port.manufacturer})` : ''}
                        </option>
                      ))
                    ) : (
                      <option value={settings.vfdPort}>{settings.vfdPort}</option>
                    )}
                  </select>
                  <button
                    onClick={loadSerialPorts}
                    className="px-3 py-2 text-gray-600 hover:text-gray-800"
                    title="Refresh ports"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* VFD Baud Rate */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Baud Rate
                </label>
                <select
                  value={settings.vfdBaudRate}
                  onChange={(e) => setSettings({ ...settings, vfdBaudRate: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value={9600}>9600</option>
                  <option value={19200}>19200</option>
                  <option value={38400}>38400</option>
                  <option value={115200}>115200</option>
                </select>
              </div>

              {/* VFD Controls */}
              <div className="flex gap-2">
                {vfdStatus.connected ? (
                  <>
                    <button
                      onClick={disconnectVfd}
                      className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                    >
                      Disconnect
                    </button>
                    <button
                      onClick={testVfd}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                    >
                      Test Display
                    </button>
                  </>
                ) : (
                  <button
                    onClick={connectVfd}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                  >
                    Connect VFD
                  </button>
                )}
              </div>
            </div>

            {/* Receipt Customization Section */}
            <div className="pt-4 border-t">
              <div className="flex items-center gap-2 mb-4">
                <Image className="w-5 h-5 text-gray-600" />
                <h2 className="text-lg font-semibold">Receipt Customization</h2>
              </div>

              {/* Custom Logo */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Receipt Logo
                </label>
                <div className="flex items-center gap-3">
                  <div className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm text-gray-600 truncate">
                    {settings.customLogoPath ? settings.customLogoPath.split('/').pop() || settings.customLogoPath.split('\\').pop() : 'Using default Al Taher logo'}
                  </div>
                  <button
                    onClick={async () => {
                      if (window.electronAPI?.selectLogoImage) {
                        const result = await window.electronAPI.selectLogoImage();
                        if (result.success && result.path) {
                          setSettings({ ...settings, customLogoPath: result.path });
                        }
                      }
                    }}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2"
                  >
                    <Image className="w-4 h-4" />
                    Select
                  </button>
                  {settings.customLogoPath && (
                    <button
                      onClick={async () => {
                        if (window.electronAPI?.resetLogo) {
                          await window.electronAPI.resetLogo();
                          setSettings({ ...settings, customLogoPath: '' });
                        }
                      }}
                      className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center gap-2"
                      title="Reset to default"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  PNG image recommended, 200-300px width
                </p>
              </div>

              {/* Custom QR Code */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Receipt QR Code
                </label>
                <div className="flex items-center gap-3">
                  <div className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm text-gray-600 truncate">
                    {settings.customQrCodePath ? settings.customQrCodePath.split('/').pop() || settings.customQrCodePath.split('\\').pop() : 'Using default review QR code'}
                  </div>
                  <button
                    onClick={async () => {
                      if (window.electronAPI?.selectQrCodeImage) {
                        const result = await window.electronAPI.selectQrCodeImage();
                        if (result.success && result.path) {
                          setSettings({ ...settings, customQrCodePath: result.path });
                        }
                      }
                    }}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2"
                  >
                    <QrCode className="w-4 h-4" />
                    Select
                  </button>
                  {settings.customQrCodePath && (
                    <button
                      onClick={async () => {
                        if (window.electronAPI?.resetQrCode) {
                          await window.electronAPI.resetQrCode();
                          setSettings({ ...settings, customQrCodePath: '' });
                        }
                      }}
                      className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center gap-2"
                      title="Reset to default"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  PNG image recommended, 200x200px
                </p>
              </div>
            </div>

            {/* Save Button */}
            <div className="pt-4 border-t">
              <button
                onClick={handleSave}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                Save Settings
              </button>
              {saved && (
                <p className="mt-2 text-center text-green-600 text-sm">
                  Settings saved successfully!
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

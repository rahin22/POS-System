import { useState, useEffect } from 'react';
import { Settings, Printer, RefreshCw } from 'lucide-react';

export function SettingsPage() {
  const [settings, setSettings] = useState({
    apiUrl: '',
    kioskMode: false,
    printerEnabled: true,
    printerName: 'Element_RW973_Mk',
  });
  const [saved, setSaved] = useState(false);
  const [availablePrinters, setAvailablePrinters] = useState<string[]>([]);
  const [printQueue, setPrintQueue] = useState<Array<{ job: string; user: string; size: string; date: string }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSettings();
    loadPrinters();
    loadPrintQueue();
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
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-2xl mx-auto">
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

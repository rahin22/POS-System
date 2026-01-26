import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

interface Settings {
  shopName: string;
  address: string;
  phone: string;
  email?: string;
  vatNumber?: string;
  vatRate: number;
  currency: string;
  currencySymbol: string;
  receiptFooter?: string;
}

export function SettingsPage() {
  const { fetchApi, user } = useAuth();
  const [settings, setSettings] = useState<Settings>({
    shopName: '',
    address: '',
    phone: '',
    vatRate: 20,
    currency: 'GBP',
    currencySymbol: '£',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetchApi<{ success: boolean; data: Settings }>('/api/settings');
        if (res.success) setSettings(res.data);
      } catch (error) {
        console.error('Failed to load settings:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadSettings();
  }, [fetchApi]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage('');

    try {
      await fetchApi('/api/settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      });
      setMessage('Settings saved successfully!');
    } catch (error: any) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="animate-pulse">Loading...</div>;
  }

  const isAdmin = user?.role === 'admin';

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Settings</h1>

      <form onSubmit={handleSave} className="max-w-2xl">
        <div className="card mb-6">
          <h2 className="text-lg font-semibold mb-4">Shop Information</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Shop Name</label>
              <input
                type="text"
                value={settings.shopName}
                onChange={(e) => setSettings({ ...settings, shopName: e.target.value })}
                className="input"
                disabled={!isAdmin}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <textarea
                value={settings.address}
                onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                className="input"
                rows={2}
                disabled={!isAdmin}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="text"
                  value={settings.phone}
                  onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                  className="input"
                  disabled={!isAdmin}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={settings.email || ''}
                  onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                  className="input"
                  disabled={!isAdmin}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="card mb-6">
          <h2 className="text-lg font-semibold mb-4">Tax & Currency</h2>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">VAT Rate (%)</label>
              <input
                type="number"
                value={settings.vatRate}
                onChange={(e) => setSettings({ ...settings, vatRate: parseFloat(e.target.value) })}
                className="input"
                disabled={!isAdmin}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Currency Code</label>
              <input
                type="text"
                value={settings.currency}
                onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                className="input"
                maxLength={3}
                disabled={!isAdmin}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Currency Symbol</label>
              <input
                type="text"
                value={settings.currencySymbol}
                onChange={(e) => setSettings({ ...settings, currencySymbol: e.target.value })}
                className="input"
                maxLength={5}
                disabled={!isAdmin}
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">VAT Number</label>
            <input
              type="text"
              value={settings.vatNumber || ''}
              onChange={(e) => setSettings({ ...settings, vatNumber: e.target.value })}
              className="input"
              disabled={!isAdmin}
            />
          </div>
        </div>

        <div className="card mb-6">
          <h2 className="text-lg font-semibold mb-4">Receipt</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Receipt Footer</label>
            <textarea
              value={settings.receiptFooter || ''}
              onChange={(e) => setSettings({ ...settings, receiptFooter: e.target.value })}
              className="input"
              rows={2}
              placeholder="Thank you for your order!"
              disabled={!isAdmin}
            />
          </div>
        </div>

        {message && (
          <div
            className={`mb-4 p-3 rounded-lg ${
              message.startsWith('Error') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
            }`}
          >
            {message}
          </div>
        )}

        {isAdmin && (
          <button type="submit" disabled={isSaving} className="btn-primary">
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
        )}

        {!isAdmin && (
          <p className="text-gray-500 text-sm">Only admins can modify settings.</p>
        )}
      </form>
    </div>
  );
}

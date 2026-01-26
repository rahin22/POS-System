import { useState, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';

interface CheckoutModalProps {
  total: number;
  currencySymbol: string;
  onSubmit: (customerInfo: { name: string; phone: string }) => Promise<void>;
  onCancel: () => void;
  user?: User | null;
}

export function CheckoutModal({ total, currencySymbol, onSubmit, onCancel, user }: CheckoutModalProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pre-fill from user profile
  useEffect(() => {
    if (user) {
      setName(user.user_metadata?.full_name || '');
      setPhone(user.user_metadata?.phone || '');
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await onSubmit({ name, phone });
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />

      <div className="relative bg-white rounded-2xl p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Complete Your Order</h2>

        <div className="text-center py-4 mb-4 bg-gray-50 rounded-xl">
          <p className="text-gray-600 text-sm">Order Total</p>
          <p className="text-3xl font-bold text-primary-600">
            {currencySymbol}{total.toFixed(2)}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Your Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
              placeholder="For order pickup"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number *
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="input"
              placeholder="We'll text you when ready"
              required
            />
          </div>

          <p className="text-sm text-gray-500">
            You'll pay at the shop when collecting your order.
          </p>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="btn-secondary flex-1"
              disabled={isSubmitting}
            >
              Back
            </button>
            <button
              type="submit"
              className="btn-primary flex-1"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Placing Order...' : 'Place Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

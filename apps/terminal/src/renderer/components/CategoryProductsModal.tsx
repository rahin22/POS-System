import { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { ProductGrid } from './ProductGrid';

interface Product {
  id: string;
  name: string;
  price: number;
  pricePerKg?: number | null;
  description?: string;
  imageUrl?: string;
  isAvailable: boolean;
}

interface CategoryProductsModalProps {
  categoryName: string;
  products: Product[];
  currencySymbol: string;
  onProductClick: (product: Product) => void;
  onClose: () => void;
}

export function CategoryProductsModal({
  categoryName,
  products,
  currencySymbol,
  onProductClick,
  onClose,
}: CategoryProductsModalProps) {
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [onClose]);

  const handleProductClick = (product: Product) => {
    onProductClick(product);

    // Weight-priced items open their own modal, so only confirm direct adds
    if (!product.pricePerKg) {
      setToast(`${product.name} added`);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), 1500);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40 p-6">
      <div className="bg-gray-100 rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{categoryName}</h2>
            <p className="text-sm text-gray-500">
              {products.length} item{products.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-3 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 active:bg-gray-300"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Products */}
        <div className="flex-1 overflow-y-auto touch-scroll p-4">
          <ProductGrid
            products={products}
            currencySymbol={currencySymbol}
            onProductClick={handleProductClick}
          />
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-white border-t border-gray-200 flex items-center justify-between gap-4">
          <span className={`text-sm font-medium text-green-700 transition-opacity ${toast ? 'opacity-100' : 'opacity-0'}`}>
            {toast || ' '}
          </span>
          <button
            onClick={onClose}
            className="px-8 py-3 bg-primary-500 text-white rounded-lg font-semibold hover:bg-primary-600 active:bg-primary-700"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

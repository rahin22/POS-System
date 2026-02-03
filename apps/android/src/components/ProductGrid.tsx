

interface Product {
  id: string;
  name: string;
  price: number;
  pricePerKg?: number | null;
  description?: string;
  image?: string;
  imageUrl?: string;
  isAvailable: boolean;
}

interface ProductGridProps {
  products: Product[];
  currencySymbol: string;
  onProductClick: (product: Product) => void;
}

export function ProductGrid({ products, currencySymbol, onProductClick }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        No products in this category
      </div>
    );
  }

  const formatPrice = (price: number) => `${currencySymbol}${price.toFixed(2)}`;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {products.map((product) => (
        <button
          key={product.id}
          onClick={() => onProductClick(product)}
          disabled={!product.isAvailable}
          className={`product-card flex flex-col ${!product.isAvailable ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {product.imageUrl || product.image ? (
            <img
              src={product.imageUrl || product.image}
              alt={product.name}
              className="w-full h-32 object-cover rounded-t-lg"
            />
          ) : (
            <div className="w-full h-32 bg-primary-100 rounded-t-lg flex items-center justify-center">
              <span className="text-5xl">🥙</span>
            </div>
          )}
          <div className="p-3 flex-1 flex flex-col justify-between">
            <span className="text-sm font-medium text-gray-800 text-left line-clamp-2 mb-2">
              {product.name}
            </span>
            {product.pricePerKg ? (
              <div className="text-left">
                <span className="text-primary-600 font-bold text-sm block">
                  {formatPrice(product.price)} ea
                </span>
                <span className="text-primary-600 font-bold text-sm block">
                  {formatPrice(product.pricePerKg)}/kg
                </span>
              </div>
            ) : (
              <span className="text-primary-600 font-bold text-left block">
                {formatPrice(product.price)}
              </span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

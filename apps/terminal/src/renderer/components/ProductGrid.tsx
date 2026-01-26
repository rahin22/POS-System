

interface Product {
  id: string;
  name: string;
  price: number;
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

  return (
    <div className="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {products.map((product) => (
        <button
          key={product.id}
          onClick={() => onProductClick(product)}
          disabled={!product.isAvailable}
          className={`product-card ${!product.isAvailable ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {product.imageUrl || product.image ? (
            <img
              src={product.imageUrl || product.image}
              alt={product.name}
              className="w-16 h-16 object-cover rounded-lg mb-2"
            />
          ) : (
            <div className="w-16 h-16 bg-primary-100 rounded-lg mb-2 flex items-center justify-center">
              <span className="text-2xl">🥙</span>
            </div>
          )}
          <span className="text-sm font-medium text-gray-800 text-center line-clamp-2">
            {product.name}
          </span>
          <span className="text-primary-600 font-bold mt-1">
            {currencySymbol}{product.price.toFixed(2)}
          </span>
        </button>
      ))}
    </div>
  );
}

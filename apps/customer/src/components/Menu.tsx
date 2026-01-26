import React, { useState } from 'react';

interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  categoryId: string;
  image?: string;
}

interface Category {
  id: string;
  name: string;
}

interface MenuProps {
  products: Product[];
  categories: Category[];
  currencySymbol: string;
  onAddToCart: (product: Product) => void;
}

export function Menu({ products, categories, currencySymbol, onAddToCart }: MenuProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filteredProducts = selectedCategory
    ? products.filter((p) => p.categoryId === selectedCategory)
    : products;

  const groupedProducts = categories.map((category) => ({
    category,
    products: filteredProducts.filter((p) => p.categoryId === category.id),
  })).filter((group) => group.products.length > 0);

  return (
    <div>
      {/* Category Filter */}
      <div className="flex gap-2 overflow-x-auto pb-4 mb-4 -mx-4 px-4">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-colors ${
            selectedCategory === null
              ? 'bg-primary-500 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100'
          }`}
        >
          All
        </button>
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => setSelectedCategory(category.id)}
            className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-colors ${
              selectedCategory === category.id
                ? 'bg-primary-500 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            {category.name}
          </button>
        ))}
      </div>

      {/* Products by Category */}
      {groupedProducts.map(({ category, products }) => (
        <div key={category.id} className="mb-8">
          <h2 className="text-lg font-bold text-gray-800 mb-4">{category.name}</h2>
          <div className="space-y-3">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                currencySymbol={currencySymbol}
                onAdd={() => onAddToCart(product)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ProductCard({
  product,
  currencySymbol,
  onAdd,
}: {
  product: Product;
  currencySymbol: string;
  onAdd: () => void;
}) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm flex gap-4">
      {product.image ? (
        <img
          src={product.image}
          alt={product.name}
          className="w-20 h-20 rounded-lg object-cover"
        />
      ) : (
        <div className="w-20 h-20 rounded-lg bg-primary-100 flex items-center justify-center text-3xl">
          🥙
        </div>
      )}

      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-gray-800">{product.name}</h3>
        {product.description && (
          <p className="text-sm text-gray-500 line-clamp-2">{product.description}</p>
        )}
        <p className="text-primary-600 font-bold mt-1">
          {currencySymbol}{product.price.toFixed(2)}
        </p>
      </div>

      <button
        onClick={onAdd}
        className="self-center bg-primary-500 hover:bg-primary-600 text-white w-10 h-10 rounded-full flex items-center justify-center text-xl font-bold transition-colors"
      >
        +
      </button>
    </div>
  );
}

interface CategoryCard {
  id: string;
  name: string;
  productCount: number;
  imageUrl?: string;
}

interface CategoryCardGridProps {
  categories: CategoryCard[];
  onSelect: (id: string) => void;
}

export function CategoryCardGrid({ categories, onSelect }: CategoryCardGridProps) {
  if (categories.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        No categories available
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {categories.map((category) => (
        <button
          key={category.id}
          onClick={() => onSelect(category.id)}
          className="product-card flex flex-col text-left"
        >
          {category.imageUrl ? (
            <img
              src={category.imageUrl}
              alt={category.name}
              className="w-full h-32 object-cover rounded-t-xl"
            />
          ) : (
            <div className="w-full h-32 bg-primary-100 rounded-t-xl flex items-center justify-center">
              <span className="text-5xl">🥙</span>
            </div>
          )}
          <div className="p-3 flex-1 flex flex-col justify-between">
            <span className="text-base font-semibold text-gray-800 line-clamp-2">
              {category.name}
            </span>
            <span className="text-sm text-primary-600 font-medium mt-1">
              {category.productCount} item{category.productCount !== 1 ? 's' : ''}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}

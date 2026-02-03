

interface Category {
  id: string;
  name: string;
}

interface CategoryTabsProps {
  categories: Category[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function CategoryTabs({ categories, selectedId, onSelect }: CategoryTabsProps) {
  return (
    <div className="bg-gray-50 border-b border-gray-200">
      <div className="px-4 py-3 overflow-x-auto hide-scrollbar touch-scroll">
        <div className="flex gap-3 min-w-max">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => onSelect(category.id)}
              className={`category-tab ${selectedId === category.id ? 'active' : ''}`}
            >
              {category.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

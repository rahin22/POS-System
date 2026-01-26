

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
    <div className="bg-gray-100 px-4 py-3 overflow-x-auto hide-scrollbar">
      <div className="flex gap-2">
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
  );
}

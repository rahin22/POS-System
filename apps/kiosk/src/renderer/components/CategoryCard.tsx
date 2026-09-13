import { useState } from 'react';
import { ChevronRight, UtensilsCrossed } from 'lucide-react';
import { displayName } from '../lib/format';

interface CategoryCardProps {
  name: string;
  productCount: number;
  imageUrl?: string;
  index: number;
  onSelect: () => void;
}

export function CategoryCard({ name, productCount, imageUrl, index, onSelect }: CategoryCardProps) {
  // Menu photos are staff-uploaded URLs; a dead link must not leave an empty tile
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(imageUrl) && !imageFailed;

  return (
    <button
      type="button"
      onClick={onSelect}
      style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}
      className="touchable focus-ring group flex animate-fade-up flex-col overflow-hidden rounded-kiosk bg-white text-left shadow-card hover:ring-4 hover:ring-brand-500"
    >
      <div className="relative aspect-[5/3] w-full overflow-hidden bg-brand-100">
        {showImage ? (
          <img
            src={imageUrl}
            alt=""
            loading="lazy"
            onError={() => setImageFailed(true)}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          // No usable photo: a brand tile keeps the grid's rhythm
          <div className="flex h-full w-full items-center justify-center">
            <UtensilsCrossed className="h-20 w-20 text-brand-700" aria-hidden="true" />
          </div>
        )}
      </div>

      <div className="flex flex-1 items-center justify-between gap-4 p-7">
        <span>
          <span className="block text-kiosk-base font-extrabold leading-tight text-ink-900 line-clamp-2">
            {displayName(name)}
          </span>
          <span className="mt-1 block text-kiosk-xs font-semibold text-ink-600">
            {productCount} item{productCount === 1 ? '' : 's'}
          </span>
        </span>

        <span
          className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full bg-brand-500 text-ink-900 shadow-card transition-colors duration-200 group-hover:bg-brand-400"
          aria-hidden="true"
        >
          <ChevronRight className="h-10 w-10" strokeWidth={3} />
        </span>
      </div>
    </button>
  );
}

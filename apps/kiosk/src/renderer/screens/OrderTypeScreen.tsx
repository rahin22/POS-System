import { ShoppingBag, UtensilsCrossed } from 'lucide-react';
import { BrandMark } from '../components/BrandMark';
import type { OrderType } from '../types';

interface OrderTypeScreenProps {
  onSelect: (type: OrderType) => void;
  onBack: () => void;
}

const OPTIONS: Array<{
  type: OrderType;
  title: string;
  caption: string;
  Icon: typeof UtensilsCrossed;
}> = [
  {
    type: 'dine-in',
    title: 'Eat In',
    caption: 'Served on a tray',
    Icon: UtensilsCrossed,
  },
  {
    type: 'takeaway',
    title: 'Take Away',
    caption: 'Packed and bagged',
    Icon: ShoppingBag,
  },
];

export function OrderTypeScreen({ onSelect, onBack }: OrderTypeScreenProps) {
  return (
    <div className="flex h-full flex-col bg-cream-100">
      <header className="mx-10 mt-10 flex flex-col items-center rounded-panel bg-brand-500 pb-12 pt-12">
        <BrandMark size="md" />
        <h1 className="mt-8 px-12 text-center text-kiosk-2xl font-extrabold text-white">
          Eating in, or taking away?
        </h1>
      </header>

      <div className="grid grid-cols-2 gap-8 px-10 py-14">
        {OPTIONS.map(({ type, title, caption, Icon }, index) => (
          <button
            key={type}
            type="button"
            onClick={() => onSelect(type)}
            style={{ animationDelay: `${index * 60}ms` }}
            className="touchable focus-ring group flex h-[680px] animate-fade-up flex-col items-center justify-center gap-8 rounded-panel bg-white px-8 shadow-card hover:ring-4 hover:ring-brand-500 active:ring-4 active:ring-brand-500"
          >
            <span className="flex h-56 w-56 items-center justify-center rounded-full bg-brand-100 transition-colors duration-200 group-hover:bg-brand-500">
              <Icon className="h-28 w-28 text-brand-600 transition-colors duration-200 group-hover:text-ink-900" aria-hidden="true" />
            </span>
            <span className="text-center">
              <span className="block text-kiosk-2xl font-extrabold text-ink-900">{title}</span>
              <span className="mt-3 block text-kiosk-base text-ink-600">{caption}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="flex flex-1 items-end justify-center px-10 pb-14">
        <button type="button" onClick={onBack} className="btn-quiet mx-auto text-kiosk-base">
          Cancel
        </button>
      </div>
    </div>
  );
}

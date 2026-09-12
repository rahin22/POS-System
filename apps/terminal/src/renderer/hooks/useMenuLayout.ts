import { useState, useEffect } from 'react';

/**
 * Menu layout for the POS product browser.
 *
 * 'tabs'  - original layout: horizontal category slider + product grid
 * 'cards' - one screen of category cards, clicking a card opens a product popup
 */
export type MenuLayout = 'tabs' | 'cards';

const MENU_LAYOUT_EVENT = 'menu-layout-changed';

export const DEFAULT_MENU_LAYOUT: MenuLayout = 'tabs';

function normalize(value: unknown): MenuLayout {
  return value === 'cards' ? 'cards' : 'tabs';
}

export async function getMenuLayout(): Promise<MenuLayout> {
  if (!window.electronAPI?.getSettings) return DEFAULT_MENU_LAYOUT;
  const settings = await window.electronAPI.getSettings();
  return normalize(settings.menuLayout);
}

/** Notify any mounted screens that the saved layout changed so they switch immediately. */
export function notifyMenuLayoutChange(layout: MenuLayout): void {
  window.dispatchEvent(new CustomEvent<MenuLayout>(MENU_LAYOUT_EVENT, { detail: layout }));
}

export function useMenuLayout(): MenuLayout {
  const [layout, setLayout] = useState<MenuLayout>(DEFAULT_MENU_LAYOUT);

  useEffect(() => {
    let mounted = true;
    getMenuLayout().then((value) => {
      if (mounted) setLayout(value);
    });

    const handler = (event: Event) => {
      setLayout(normalize((event as CustomEvent<MenuLayout>).detail));
    };
    window.addEventListener(MENU_LAYOUT_EVENT, handler);

    return () => {
      mounted = false;
      window.removeEventListener(MENU_LAYOUT_EVENT, handler);
    };
  }, []);

  return layout;
}

import { useState, useEffect } from 'react';
import { settings as platformSettings } from '../lib/platform';

/**
 * Menu layout for the POS product browser.
 *
 * 'tabs'  - original layout: horizontal category slider + product grid
 * 'cards' - one screen of category cards, tapping a card opens a product popup
 */
export type MenuLayout = 'tabs' | 'cards';

export const MENU_LAYOUT_KEY = 'menuLayout';
const MENU_LAYOUT_EVENT = 'menu-layout-changed';

export const DEFAULT_MENU_LAYOUT: MenuLayout = 'tabs';

function normalize(value: unknown): MenuLayout {
  return value === 'cards' ? 'cards' : 'tabs';
}

export async function getMenuLayout(): Promise<MenuLayout> {
  return normalize(await platformSettings.get<MenuLayout>(MENU_LAYOUT_KEY, DEFAULT_MENU_LAYOUT));
}

/** Persist the layout and notify any mounted screens so they switch immediately. */
export async function setMenuLayout(layout: MenuLayout): Promise<void> {
  await platformSettings.set(MENU_LAYOUT_KEY, layout);
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

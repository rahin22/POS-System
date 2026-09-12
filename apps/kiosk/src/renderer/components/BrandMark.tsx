import logo from '../assets/logo-ink.png';

/**
 * Single-ink wordmark: orange "AL" with everything else in ink, so it reads on
 * cream and on brand orange alike and needs no backing panel.
 *
 * The original artwork set "Taher" in white and "KEBABS & SWEETS" in black, which
 * no single background can show at once - the dark pill that made "Taher" legible
 * swallowed the line underneath it. logo-ink.png recolours the white to ink so one
 * version works everywhere.
 */
export function BrandMark({
  className = '',
  size = 'md',
}: {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const width = size === 'sm' ? 'w-44' : size === 'lg' ? 'w-[560px]' : 'w-72';

  return (
    <img
      src={logo}
      alt="Al Taher Kebabs and Sweets"
      className={`${width} h-auto ${className}`}
    />
  );
}

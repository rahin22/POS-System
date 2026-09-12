import logo from '../assets/logo.png';

/**
 * The logo artwork sets "Taher" in white, so it only reads on a dark field.
 * On the cream UI it always sits inside this dark badge.
 */
export function BrandMark({ className = '', size = 'md' }: { className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const padding = size === 'sm' ? 'px-5 py-3' : size === 'lg' ? 'px-14 py-10' : 'px-8 py-5';
  const width = size === 'sm' ? 'w-40' : size === 'lg' ? 'w-[520px]' : 'w-64';

  return (
    <span className={`inline-flex items-center justify-center rounded-panel bg-ink-900 ${padding} ${className}`}>
      <img src={logo} alt="Al Taher Kebabs and Sweets" className={`${width} h-auto`} />
    </span>
  );
}

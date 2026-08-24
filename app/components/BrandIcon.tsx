import { brands, lettermarkColors } from "./brands";

/**
 * A platform's mark, or a neutral lettermark when we have no licensed icon for
 * it. Unknown identifiers still render something sensible, so a newly supported
 * Postiz platform never shows up as a blank space.
 */
export function BrandIcon({ identifier, size = 16, className, color }: { identifier: string; size?: number; className?: string; color?: string }) {
  const brand = brands[identifier];
  const label = brand?.title ?? identifier;

  if (brand) {
    return <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-label={label}
      fill={color ?? brand.hex}
    >
      <path d={brand.path} />
    </svg>;
  }

  const tint = color ?? lettermarkColors[identifier] ?? "#5b6b73";
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={label}>
    <rect width="24" height="24" rx="5" fill={tint} />
    <text x="12" y="17" textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff" fontFamily="Asap, Arial, sans-serif">
      {label.slice(0, 1).toUpperCase()}
    </text>
  </svg>;
}

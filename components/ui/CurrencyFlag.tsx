import { getFlagClass, hasFlagIcon } from '@/lib/currency-flags'

interface Props {
  code: string
  flag?: string        // emoji drapeau (fallback si pas de flag-icon)
  size?: number        // taille en px (défaut 20)
  className?: string
}

/**
 * Affiche le drapeau d'une devise via flag-icons (SVG, compatible Windows).
 * Fallback sur l'emoji flag si le code n'est pas reconnu.
 */
export default function CurrencyFlag({ code, flag, size = 20, className = '' }: Props) {
  if (hasFlagIcon(code)) {
    return (
      <span
        className={`${getFlagClass(code)} ${className}`}
        style={{ fontSize: size, lineHeight: 1, verticalAlign: 'middle' }}
      />
    )
  }
  // Fallback emoji
  return <span className={className} style={{ fontSize: size }}>{flag || '🏳️'}</span>
}
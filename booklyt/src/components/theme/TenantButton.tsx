import type { ButtonStyle } from '@/types/builder'

interface Props {
  children: React.ReactNode
  onClick?: () => void
  href?: string
  buttonStyle?: ButtonStyle
  size?: 'sm' | 'md' | 'lg'
  variant?: 'primary' | 'ghost' | 'outline'
  className?: string
}

const radiusMap: Record<ButtonStyle, string> = {
  rounded: 'rounded-lg',
  pill: 'rounded-full',
  sharp: 'rounded-none',
  outline: 'rounded-lg',
}

export function TenantButton({
  children,
  onClick,
  buttonStyle = 'rounded',
  size = 'md',
  variant = 'primary',
  className = '',
  href,
}: Props) {
  const radius = radiusMap[buttonStyle]
  const sizeClass =
    size === 'sm'
      ? 'px-4 py-2 text-sm'
      : size === 'lg'
      ? 'px-8 py-4 text-base'
      : 'px-6 py-3 text-sm'

  const variantStyle =
    variant === 'primary'
      ? 'bg-[var(--tenant-primary)] text-[var(--tenant-on-primary,#ffffff)] font-semibold hover:opacity-90 transition-opacity'
      : variant === 'outline'
      ? 'border-2 border-[var(--tenant-primary)] text-[var(--tenant-primary)] font-semibold hover:bg-[var(--tenant-primary)] hover:text-[var(--tenant-on-primary,#ffffff)] transition-colors'
      : 'text-[var(--tenant-primary)] hover:opacity-70 transition-opacity font-medium'

  const cls = `inline-flex items-center justify-center gap-2 cursor-pointer ${radius} ${sizeClass} ${variantStyle} ${className}`

  if (href) {
    return (
      <a href={href} className={cls}>
        {children}
      </a>
    )
  }
  return (
    <button onClick={onClick} className={cls}>
      {children}
    </button>
  )
}

import Link from 'next/link'
import { cn } from '@/lib/utils'

interface Category {
  label: string
  slug: string
  emoji: string
  color: string
}

const CATEGORIES: Category[] = [
  { label: 'Hair',       slug: 'hair',       emoji: '✂️',  color: 'bg-pink-50   text-pink-600'   },
  { label: 'Nails',      slug: 'nails',      emoji: '💅',  color: 'bg-rose-50   text-rose-600'   },
  { label: 'Spa',        slug: 'spa',        emoji: '🧖',  color: 'bg-teal-50   text-teal-600'   },
  { label: 'Barber',     slug: 'barber',     emoji: '💈',  color: 'bg-blue-50   text-blue-600'   },
  { label: 'Massage',    slug: 'massage',    emoji: '💆',  color: 'bg-purple-50 text-purple-600' },
  { label: 'Makeup',     slug: 'makeup',     emoji: '💄',  color: 'bg-fuchsia-50 text-fuchsia-600'},
  { label: 'Lashes',     slug: 'lashes',     emoji: '👁️',  color: 'bg-amber-50  text-amber-600'  },
  { label: 'More',       slug: '',           emoji: '⊕',   color: 'bg-zinc-50   text-zinc-500'   },
]

interface CategoryGridProps {
  dynamicCategories?: { category: string; count: number }[]
  className?: string
}

export function CategoryGrid({ dynamicCategories, className }: CategoryGridProps) {
  const items = dynamicCategories
    ? dynamicCategories.slice(0, 7).map(({ category }) => {
        const found = CATEGORIES.find(c => c.slug === category.toLowerCase())
        return found ?? {
          label: category.charAt(0).toUpperCase() + category.slice(1),
          slug: category.toLowerCase(),
          emoji: '🏪',
          color: 'bg-violet-50 text-violet-600',
        }
      }).concat(CATEGORIES[CATEGORIES.length - 1])
    : CATEGORIES

  return (
    <div className={cn('grid grid-cols-4 gap-2.5', className)}>
      {items.map(({ label, slug, emoji, color }) => (
        <Link
          key={label}
          href={slug ? `/app/search?category=${encodeURIComponent(slug)}` : '/app/search'}
          className="flex flex-col items-center gap-1.5 p-2 rounded-2xl active:scale-95 transition-transform"
        >
          <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-sm', color)}>
            {emoji}
          </div>
          <span className="text-[11px] font-medium text-zinc-600 text-center leading-tight">{label}</span>
        </Link>
      ))}
    </div>
  )
}

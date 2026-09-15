# BookFlow Design System & Style Guide

## 🎨 Design Philosophy

**BookFlow** is built on a modern, clean design philosophy emphasizing clarity, accessibility, and delightful micro-interactions. The platform uses a premium yet approachable aesthetic suitable for service businesses of all sizes.

### Core Principles
- **Simplicity First**: Every element has a purpose. No unnecessary decorations.
- **Premium Feel**: Use of refined typography, thoughtful spacing, and subtle animations.
- **Accessibility**: WCAG 2.1 AA compliance with high contrast ratios and keyboard navigation.
- **Consistency**: A unified design language across all pages and components.
- **Delightful**: Smooth transitions and micro-interactions that feel natural.

---

## 🎯 Color System

### Primary Palette
- **Violet** (Primary Brand Color)
  - `hsl(256, 95%, 65%)` - Vibrant, accessible
  - Used for CTAs, active states, and brand elements
  - Conveys trust, creativity, and professionalism

### Secondary Colors
- **Blue** - Information, secondary actions
- **Green** - Success, positive outcomes
- **Orange** - Warnings, highlights
- **Red** - Destructive actions, errors

### Neutral Scale
- **Zinc** (Background & Text)
  - Zinc-950: Primary text
  - Zinc-600: Secondary text
  - Zinc-500: Tertiary text
  - Zinc-400: Muted text
  - Zinc-200: Borders
  - Zinc-100: Hover states
  - Zinc-50: Light backgrounds

---

## 📐 Typography

### Font Family
- **Primary**: Inter (Variable)
- **Weight Range**: 400–700
- **Letter Spacing**: Tight tracking for headings, normal for body

### Hierarchy
```
H1: 2xl–5xl, bold, tracking-tight
H2: lg–3xl, semibold, tracking-tight
H3: sm–lg, semibold, tracking-tight
Body: sm–base, regular, leading-relaxed
Caption: xs–sm, regular, text-muted-foreground
```

---

## 📦 Component Library

### 1. **Stat Cards** (`StatCard`)
High-impact metric display with color-coded variants.

**Features:**
- Icon background in matching color
- Large, readable number with tabular figures
- Optional trend indicator (↑↓)
- Four color variants: violet, blue, green, orange
- Subtle shadow and hover effect

**Usage:**
```tsx
<StatCard
  icon={Calendar}
  label="Today"
  value={12}
  change="8%"
  trend="up"
  color="violet"
/>
```

### 2. **Section Cards** (`SectionCard`)
Container for grouped content with header and actions.

**Features:**
- Clean header with optional icon
- Description text below title
- Action button in top-right
- Subtle border and shadow
- Full-width divider separator for content

**Usage:**
```tsx
<SectionCard
  title="Upcoming Appointments"
  description="Your next bookings"
  action={<Button>View all</Button>}
>
  {/* Content */}
</SectionCard>
```

### 3. **Empty States** (`EmptyState`)
Graceful messaging when no data exists.

**Features:**
- Large icon in secondary background
- Clear heading and description
- Optional action button
- Centered layout with proper spacing

**Usage:**
```tsx
<EmptyState
  icon={Calendar}
  title="No appointments"
  description="Share your booking page to start receiving bookings"
  actionLabel="View booking page"
  onAction={() => {}}
/>
```

### 4. **Buttons**

#### Variants
- **default**: Violet primary button for main CTAs
- **outline**: Bordered button for secondary actions
- **ghost**: Text-only button for low-priority actions
- **dark**: Solid dark button for premium feel
- **gradient**: Gradient effect for hero sections

#### Sizes
- **sm**: 8px height, text-xs (for inline actions)
- **default**: 10px height, text-sm (standard)
- **lg**: 12px height, text-base (prominent)
- **icon**: Square button for icons only

#### Best Practices
- Always pair button text with an icon when possible
- Use `gap-2` for consistent spacing between icon and text
- Prioritize one primary button per section

### 5. **Sidebar Navigation**
Enhanced with smooth animations and active indicators.

**Features:**
- Logo and business selector at top
- Navigation items with hover effects
- Active state with colored background and dot indicator
- User profile section with dropdown
- Gradient avatar backgrounds

### 6. **Cards & Containers**

**Rounded Corners**: `rounded-xl` (12px) to `rounded-2xl` (16px)
- Creates modern, friendly appearance
- Consistent with Tailwind's spacing

**Shadows**:
- Subtle: `shadow-sm` - Light elevation
- Medium: `shadow-md` - Notable elevation
- Large: `shadow-lg` - Strong elevation
- Custom: `shadow-[0_4px_24px_rgba(0,0,0,0.06)]`

**Borders**:
- Border color: `border-zinc-200` for structure
- Border color: `border-zinc-100` for subtle divisions
- Hover: Lighten slightly on interaction

---

## ✨ Animations & Micro-interactions

### Entrance Animations
- **slideUp**: Y-axis movement with delay for stagger effect
- **fadeUp**: Opacity + Y-axis for below-fold elements
- Duration: 0.4–0.7s with custom easing `[0.16, 1, 0.3, 1]`

### Interaction Animations
- **Button**: `active:scale-[0.98]` for press feedback
- **Hover**: `group-hover:` prefixed effects
- **Navigation**: Item slides slightly on hover with smooth timing
- **Cards**: Lift slightly with shadow increase on hover

### Implementation (Framer Motion)
```tsx
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
>
  Content
</motion.div>
```

---

## 🎬 Page Layouts

### Dashboard Layout
```
┌─────────────────────────────────────────┐
│         Sidebar (240px)   │   Main      │
│  ─────────────────────────┼─────────────│
│  • Logo                   │ • Header    │
│  • Business Selector      │ • Stats (4) │
│  • Navigation (6 items)   │ • Section 1 │
│  • User Profile           │ • Section 2 │
│                           │ • Section 3 │
└─────────────────────────────────────────┘
```

### Landing Page Sections
1. **Navigation Bar** - Fixed header with logo and CTA
2. **Hero** - Large headline, subheading, CTAs, stats
3. **How it works** - Dark section with 3-step process
4. **Features** - Feature list with icons and descriptions
5. **Testimonials** - 3-column card grid with ratings
6. **CTA Footer** - Dark section with final call-to-action

---

## 🔧 Spacing System

Using Tailwind's default scale (4px base):
- **px**: Horizontal padding/margin
- **py**: Vertical padding/margin
- **gap**: Space between flex items

### Recommended Spacing
- **Between sections**: `space-y-8` or `py-32`
- **Between cards**: `gap-4` or `gap-6`
- **Within cards**: `p-6` to `p-8`
- **Between elements**: `gap-2` to `gap-4`

---

## 🎪 Examples & Patterns

### Call-to-Action Pattern
```tsx
<div className="flex items-center gap-3 flex-wrap">
  <Button variant="default" size="lg">
    Primary Action
    <ArrowRight className="w-4 h-4" />
  </Button>
  <Button variant="outline" size="lg">
    Secondary Action
    <ArrowUpRight className="w-4 h-4" />
  </Button>
</div>
```

### Stat Card Grid
```tsx
<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
  <StatCard icon={Calendar} label="Today" value={12} color="violet" />
  <StatCard icon={TrendingUp} label="All time" value={156} color="blue" />
  {/* ... */}
</div>
```

### Section with Items
```tsx
<SectionCard title="Upcoming Bookings">
  <div className="divide-y divide-zinc-100 -mx-6 -mb-5">
    {items.map(item => (
      <div className="px-6 py-3.5 hover:bg-zinc-50">
        {/* Item content */}
      </div>
    ))}
  </div>
</SectionCard>
```

---

## 📱 Responsive Design

### Breakpoints
- **Mobile First**: Default styles are mobile
- **sm**: 640px - Small tablets
- **lg**: 1024px - Desktops
- **xl**: 1280px - Large desktops
- **2xl**: 1536px - Extra large screens

### Grid Adjustments
```tsx
// 2 columns on mobile, 4 on large screens
<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
```

---

## 🎨 Future Enhancements

### Planned Features
- [ ] Dark mode support (using `dark:` prefix)
- [ ] Animated backgrounds and patterns
- [ ] Advanced data visualizations (charts, calendars)
- [ ] Custom theming per business
- [ ] Accessibility testing suite
- [ ] Performance optimizations

### Animation Library Integration
Consider adding:
- `framer-motion` for advanced animations ✅ (already included)
- `react-day-picker` for calendars ✅ (already included)
- `recharts` for data visualization
- `react-spring` for physics-based animations

---

## 📋 Checklist for New Components

When creating new components, ensure:
- [ ] Accessible WCAG 2.1 AA compliant
- [ ] Works on mobile and desktop
- [ ] Uses consistent color and spacing
- [ ] Includes proper TypeScript types
- [ ] Has hover/active/disabled states
- [ ] Smooth animations (no janky transitions)
- [ ] Documented with JSDoc comments
- [ ] Tested in light mode (dark mode future)

---

## 🚀 Quick Start

### Using Components
```tsx
import { StatCard } from "@/components/dashboard/stat-card"
import { SectionCard } from "@/components/dashboard/section-card"
import { EmptyState } from "@/components/dashboard/empty-state"
import { Button } from "@/components/ui/button"

export function MyPage() {
  return (
    <div className="space-y-8">
      <StatCard icon={Icon} label="Label" value={123} color="violet" />
      <SectionCard title="Title" description="Desc">
        {/* Content */}
      </SectionCard>
    </div>
  )
}
```

### Tailwind Tips
- Use `gap-` for spacing between flex children
- Use `space-y-` or `space-x-` for stacked content
- Use `divide-y-` to add borders between items
- Use `group` and `group-hover:` for compound interactions

---

## 📚 Resources

- **Tailwind CSS**: https://tailwindcss.com
- **Radix UI Components**: https://radix-ui.com
- **Framer Motion**: https://www.framer.com/motion
- **Inter Font**: https://rsms.me/inter/

---

**Last Updated**: June 1, 2026
**Version**: 1.0
**Status**: Active & In Use

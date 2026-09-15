# BookFlow Design Components – Quick Reference

## Component Library

Your BookFlow platform now includes several premium design components. Here's how to use them:

---

## 📊 StatCard

**Location**: `src/components/dashboard/stat-card.tsx`

Display key metrics with icons and optional trend indicators.

### Usage
```tsx
import { StatCard } from "@/components/dashboard/stat-card"
import { Calendar } from "lucide-react"

export function MyDashboard() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        icon={Calendar}
        label="Today"
        value={12}
        change="8%"
        trend="up"
        color="violet"
      />
      <StatCard
        icon={Users}
        label="Staff"
        value={5}
        change="2%"
        trend="down"
        color="orange"
      />
    </div>
  )
}
```

### Props
```typescript
interface StatCardProps {
  icon: LucideIcon          // Icon from lucide-react
  label: string            // Small label above value
  value: string | number   // Main metric value
  change?: string          // Change indicator (e.g., "8%")
  trend?: "up" | "down"    // Trend direction for styling
  color?: "violet" | "blue" | "green" | "orange"  // Color variant
}
```

### Color Variants
- **violet**: Brand primary color
- **blue**: Information and secondary actions
- **green**: Success and positive metrics
- **orange**: Warnings and highlights

---

## 🎯 SectionCard

**Location**: `src/components/dashboard/section-card.tsx`

Container for grouped content with headers and optional actions.

### Usage
```tsx
import { SectionCard } from "@/components/dashboard/section-card"
import { Button } from "@/components/ui/button"
import { Calendar, ArrowRight } from "lucide-react"

export function AppointmentsList() {
  return (
    <SectionCard
      title="Upcoming Appointments"
      description="Your next bookings"
      action={
        <Button variant="ghost" size="sm">
          View all
          <ArrowRight className="w-4 h-4" />
        </Button>
      }
    >
      {/* Content with automatic dividers */}
      <div className="divide-y divide-zinc-100 -mx-6 -mb-5">
        {appointments.map(apt => (
          <div key={apt.id} className="px-6 py-3.5 hover:bg-zinc-50">
            {/* Item content */}
          </div>
        ))}
      </div>
    </SectionCard>
  )
}
```

### Props
```typescript
interface SectionCardProps {
  title: string              // Card heading
  description?: string       // Optional subtitle
  icon?: React.ReactNode    // Optional icon in header
  children: React.ReactNode // Card content
  action?: React.ReactNode  // Optional action in top-right
}
```

---

## 📭 EmptyState

**Location**: `src/components/dashboard/empty-state.tsx`

Display when no data is available with helpful messaging.

### Usage
```tsx
import { EmptyState } from "@/components/dashboard/empty-state"
import { Calendar } from "lucide-react"

export function AppointmentsList() {
  if (appointments.length === 0) {
    return (
      <EmptyState
        icon={Calendar}
        title="No appointments yet"
        description="Share your booking page to start receiving bookings from clients"
        actionLabel="View booking page"
        onAction={() => window.open("/book/your-slug", "_blank")}
      />
    )
  }
  
  return <AppointmentsList />
}
```

### Props
```typescript
interface EmptyStateProps {
  icon: LucideIcon          // Icon to display
  title: string            // Main heading
  description: string      // Supporting text
  actionLabel?: string     // Button text
  onAction?: () => void    // Button click handler
}
```

---

## 🎨 Enhanced Sidebar

**Location**: `src/components/dashboard/sidebar.tsx`

Improved navigation with animations and better visual hierarchy.

### Features
- Animated logo with scale effect on hover
- Business selector with smooth interactions
- Navigation items with active indicator dot
- User profile section with avatar rings
- Smooth transitions and visual feedback

### Navigation Items Auto-Included
- Overview
- Appointments
- Services
- Staff
- Working Hours
- Settings

---

## 🎬 Booking Flow

**Location**: `src/components/booking/booking-flow.tsx`

Enhanced multi-step booking experience with smooth animations.

### Features
1. **Service Selection** - Beautiful service cards with pricing
2. **Staff Selection** - Avatar-based team member picker
3. **Date & Time** - Calendar with time slot grid
4. **Customer Details** - Clean form with summary
5. **Confirmation** - Animated success screen

### Enhanced Animations
- Progress bar color changes (zinc → violet → emerald)
- Staggered item animations
- Smooth step transitions
- Spring animation for confirmation checkmark
- Loading state improvements

---

## 📐 Spacing & Layout Patterns

### Common Patterns

**Section Grid** (4 cards)
```tsx
<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
  {/* Cards */}
</div>
```

**List with Dividers**
```tsx
<div className="divide-y divide-zinc-100 -mx-6 -mb-5">
  {items.map(item => (
    <div key={item.id} className="px-6 py-3.5 hover:bg-zinc-50">
      {/* Content */}
    </div>
  ))}
</div>
```

**Card Grid** (3 columns)
```tsx
<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
  {/* Cards */}
</div>
```

**Horizontal Spacing**
- Compact: `gap-2` (8px)
- Normal: `gap-3` to `gap-4` (12–16px)
- Spacious: `gap-6` to `gap-8` (24–32px)

**Vertical Spacing**
- Between sections: `space-y-8` (32px)
- Between items: `space-y-2` to `space-y-4`
- Within cards: `p-6` to `p-8`

---

## 🎨 Color Usage Guide

### When to Use Each Color

**Violet** (Primary Brand)
- Main CTAs
- Active states
- Primary brand elements
- Primary progress indicators

**Blue** (Secondary)
- Information messages
- Secondary actions
- Secondary metrics
- Secondary progress indicators

**Green** (Success)
- Positive confirmations
- Success states
- Positive metrics
- Completed states

**Orange** (Warning)
- Alerts
- Important notices
- Highlighted metrics
- Pending states

**Red** (Destructive)
- Delete buttons
- Error messages
- Negative states

**Zinc** (Neutral)
- Text (950 = primary, 600 = secondary, 400 = tertiary)
- Borders and dividers
- Backgrounds
- Disabled states

---

## 🔧 Common Component Combinations

### Stats Overview
```tsx
<div className="space-y-8">
  <h2 className="text-2xl font-bold">Dashboard Overview</h2>
  
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
    <StatCard icon={Calendar} label="Today" value={12} color="violet" />
    <StatCard icon={Users} label="Staff" value={5} color="orange" />
    {/* More stat cards */}
  </div>
</div>
```

### List Section
```tsx
<SectionCard
  title="Recent Bookings"
  description="Last 10 appointments"
  action={<Button>View all</Button>}
>
  {bookings.length === 0 ? (
    <EmptyState
      icon={Calendar}
      title="No bookings"
      description="Share your page to start receiving bookings"
    />
  ) : (
    <div className="divide-y divide-zinc-100 -mx-6 -mb-5">
      {/* Items with dividers */}
    </div>
  )}
</SectionCard>
```

### Quick Actions
```tsx
<SectionCard title="Quick actions" description="Manage your business">
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
    {actions.map(action => (
      <Link key={action.href} href={action.href}>
        <div className="flex items-center gap-3.5 px-4 py-3.5 
                      bg-white border border-zinc-200 rounded-xl 
                      hover:border-zinc-300 hover:shadow-md 
                      transition-all cursor-pointer group">
          <div className={`${action.color} w-10 h-10 rounded-lg 
                         flex items-center justify-center`}>
            <action.icon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-900">
              {action.label}
            </p>
            <p className="text-xs text-zinc-500 mt-0.5">
              {action.description}
            </p>
          </div>
        </div>
      </Link>
    ))}
  </div>
</SectionCard>
```

---

## 🎭 Animation Patterns

### Entrance Animation
```tsx
import { motion } from "framer-motion"

<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
>
  Content
</motion.div>
```

### Staggered List
```tsx
<motion.div variants={stagger}>
  {items.map((item, i) => (
    <motion.div key={item.id} variants={fadeUp} custom={i}>
      {item.content}
    </motion.div>
  ))}
</motion.div>
```

### Spring Animation
```tsx
<motion.div
  initial={{ scale: 0, opacity: 0 }}
  animate={{ scale: 1, opacity: 1 }}
  transition={{ type: "spring", stiffness: 260, damping: 20 }}
>
  Content
</motion.div>
```

---

## 📱 Responsive Utilities

### Grid Breakpoints
```tsx
// Mobile: 1 column, Tablet: 2, Desktop: 3, Large: 4
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
```

### Hidden Elements
```tsx
{/* Hide on mobile, show on tablet+ */}
<div className="hidden sm:block">Desktop content</div>

{/* Show on mobile, hide on tablet+ */}
<div className="sm:hidden">Mobile content</div>
```

### Flex Direction
```tsx
{/* Column on mobile, row on desktop */}
<div className="flex flex-col lg:flex-row gap-6">
```

---

## 🚀 Best Practices

1. **Always use the new components** - Don't rebuild card designs
2. **Maintain spacing consistency** - Use the `gap-*` system
3. **Follow color patterns** - Use colors for their intended purpose
4. **Add animations gracefully** - Don't overdo motion
5. **Test responsiveness** - Check all breakpoints
6. **Accessibility first** - Ensure focus states visible
7. **Performance matters** - Monitor animation frame rates

---

## 📚 Related Files

- [Design System](./DESIGN_SYSTEM.md) - Comprehensive design guide
- [Design Showcase](./DESIGN_SHOWCASE.md) - Visual improvements overview
- Component source: `src/components/dashboard/`
- Styling: `src/app/globals.css`

---

**Last Updated**: June 1, 2026
**Status**: Production Ready


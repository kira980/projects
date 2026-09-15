"use client"

import { motion } from "framer-motion"
import { LucideIcon } from "lucide-react"

interface StatCardProps {
  icon: LucideIcon
  label: string
  value: string | number
  change?: string
  trend?: "up" | "down"
  color?: "violet" | "blue" | "green" | "orange"
}

const colorClasses = {
  violet: {
    bg: "bg-violet-50",
    icon: "text-violet-600",
    accent: "bg-violet-100",
  },
  blue: {
    bg: "bg-blue-50",
    icon: "text-blue-600",
    accent: "bg-blue-100",
  },
  green: {
    bg: "bg-green-50",
    icon: "text-green-600",
    accent: "bg-green-100",
  },
  orange: {
    bg: "bg-orange-50",
    icon: "text-orange-600",
    accent: "bg-orange-100",
  },
}

export function StatCard({
  icon: Icon,
  label,
  value,
  change,
  trend,
  color = "violet",
}: StatCardProps) {
  const colors = colorClasses[color]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`${colors.bg} rounded-2xl p-6 border border-white/60 shadow-[0_2px_12px_rgba(0,0,0,0.04)] card-hover`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`${colors.accent} w-12 h-12 rounded-xl flex items-center justify-center`}>
          <Icon className={`w-6 h-6 ${colors.icon}`} />
        </div>
      </div>

      <p className="text-sm font-medium text-zinc-600 mb-1">{label}</p>
      <div className="flex items-baseline gap-2">
        <p className="text-3xl font-bold text-zinc-900 tabular-nums">{value}</p>
        {change && (
          <span
            className={`text-xs font-semibold ${
              trend === "up"
                ? "text-green-600 bg-green-50 px-2 py-0.5 rounded-full"
                : "text-red-600 bg-red-50 px-2 py-0.5 rounded-full"
            }`}
          >
            {trend === "up" ? "↑" : "↓"} {change}
          </span>
        )}
      </div>
    </motion.div>
  )
}

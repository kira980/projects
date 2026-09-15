"use client"

import { LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center py-16 px-6 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/50"
    >
      <div className="w-16 h-16 rounded-2xl bg-zinc-100 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-zinc-400" />
      </div>
      <h3 className="text-base font-semibold text-zinc-900 mb-1">{title}</h3>
      <p className="text-sm text-zinc-500 text-center max-w-xs mb-6">
        {description}
      </p>
      {actionLabel && onAction && (
        <Button onClick={onAction} variant="default" size="sm">
          {actionLabel}
        </Button>
      )}
    </motion.div>
  )
}

"use client"

import React from "react"
import { motion } from "framer-motion"

interface SectionCardProps {
  title: string
  description?: string
  icon?: React.ReactNode
  children: React.ReactNode
  action?: React.ReactNode
}

export function SectionCard({
  title,
  description,
  icon,
  children,
  action,
}: SectionCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="bg-white rounded-2xl border border-zinc-100 shadow-[0_2px_16px_rgba(0,0,0,0.04)] overflow-hidden"
    >
      <div className="px-6 py-5 border-b border-zinc-100 flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1">
          {icon && <div className="mt-0.5">{icon}</div>}
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
            {description && (
              <p className="text-xs text-zinc-500 mt-0.5">{description}</p>
            )}
          </div>
        </div>
        {action && <div className="ml-4 flex-shrink-0">{action}</div>}
      </div>
      <div className="px-6 py-5">{children}</div>
    </motion.div>
  )
}

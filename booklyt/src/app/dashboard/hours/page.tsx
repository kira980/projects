"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Clock, Loader2, Plus, Save, Trash2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { WorkingHourBreak, WorkingHours } from "@/types/database"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/components/ui/use-toast"
import { DAY_NAMES } from "@/lib/utils"

type BreakState = {
  id?: string
  start_time: string
  end_time: string
}

type DayState = {
  id?: string
  day_of_week: number
  is_open: boolean
  open_time: string
  close_time: string
  breaks: BreakState[]
}

const DEFAULT_HOURS: Omit<DayState, "day_of_week"> = {
  is_open: true,
  open_time: "09:00",
  close_time: "18:00",
  breaks: [],
}

export default function HoursPage() {
  const [days, setDays] = useState<DayState[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [businessId, setBusinessId] = useState("")

  const loadData = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: bizData } = await supabase
      .from("businesses")
      .select("id")
      .eq("owner_id", user.id)
      .single()

    const biz = bizData as { id: string } | null
    if (!biz) return
    setBusinessId(biz.id)

    const { data: hoursData } = await supabase
      .from("working_hours")
      .select("*")
      .eq("business_id", biz.id)
      .order("day_of_week")

    const { data: breaksData } = await supabase
      .from("working_hour_breaks")
      .select("*")
      .eq("business_id", biz.id)
      .order("day_of_week")
      .order("start_time")

    const hours = (hoursData ?? []) as WorkingHours[]
    const breaks = (breaksData ?? []) as WorkingHourBreak[]

    const initialDays: DayState[] = Array.from({ length: 7 }, (_, i) => {
      const existing = hours.find((h) => h.day_of_week === i)
      const dayBreaks = breaks
        .filter((breakItem) => breakItem.day_of_week === i)
        .map((breakItem) => ({
          id: breakItem.id,
          start_time: breakItem.start_time.slice(0, 5),
          end_time: breakItem.end_time.slice(0, 5),
        }))

      return existing
        ? {
            id: existing.id,
            day_of_week: i,
            is_open: existing.is_open,
            open_time: existing.open_time?.slice(0, 5) ?? "09:00",
            close_time: existing.close_time?.slice(0, 5) ?? "18:00",
            breaks: dayBreaks,
          }
        : { day_of_week: i, ...DEFAULT_HOURS, breaks: dayBreaks }
    })

    setDays(initialDays)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const updateDay = (index: number, field: keyof DayState, value: unknown) => {
    setDays((prev) =>
      prev.map((day, i) => (i === index ? { ...day, [field]: value } : day))
    )
  }

  const addBreak = (index: number) => {
    setDays((prev) =>
      prev.map((day, i) =>
        i === index
          ? { ...day, breaks: [...day.breaks, { start_time: "13:00", end_time: "14:00" }] }
          : day
      )
    )
  }

  const updateBreak = (
    dayIndex: number,
    breakIndex: number,
    field: keyof BreakState,
    value: string
  ) => {
    setDays((prev) =>
      prev.map((day, i) =>
        i === dayIndex
          ? {
              ...day,
              breaks: day.breaks.map((breakItem, j) =>
                j === breakIndex ? { ...breakItem, [field]: value } : breakItem
              ),
            }
          : day
      )
    )
  }

  const removeBreak = (dayIndex: number, breakIndex: number) => {
    setDays((prev) =>
      prev.map((day, i) =>
        i === dayIndex
          ? { ...day, breaks: day.breaks.filter((_, j) => j !== breakIndex) }
          : day
      )
    )
  }

  const handleSave = async () => {
    setSaving(true)
    const supabase = createClient()

    const toUpsert = days.map((day) => {
      const obj: Record<string, unknown> = {
        id: day.id,
        business_id: businessId,
        day_of_week: day.day_of_week,
        is_open: day.is_open,
        open_time: day.is_open ? `${day.open_time}:00` : null,
        close_time: day.is_open ? `${day.close_time}:00` : null,
      }
      if (!obj.id) delete obj.id
      return obj
    })

    const { error } = await supabase
      .from("working_hours")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .upsert(toUpsert as any, { onConflict: "business_id,day_of_week" })

    if (error) {
      toast({ variant: "destructive", title: "Error saving hours", description: error.message })
      setSaving(false)
      return
    }

    const { error: deleteBreaksError } = await supabase
      .from("working_hour_breaks")
      .delete()
      .eq("business_id", businessId)

    if (deleteBreaksError) {
      toast({ variant: "destructive", title: "Error saving breaks", description: deleteBreaksError.message })
      setSaving(false)
      return
    }

    const breakRows = days.flatMap((day) =>
      day.is_open
        ? day.breaks
            .filter((breakItem) => breakItem.start_time && breakItem.end_time && breakItem.start_time < breakItem.end_time)
            .map((breakItem) => ({
              business_id: businessId,
              day_of_week: day.day_of_week,
              start_time: `${breakItem.start_time}:00`,
              end_time: `${breakItem.end_time}:00`,
            }))
        : []
    )

    if (breakRows.length > 0) {
      const { error: breaksError } = await supabase
        .from("working_hour_breaks")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .insert(breakRows as any)

      if (breaksError) {
        toast({ variant: "destructive", title: "Error saving breaks", description: breaksError.message })
        setSaving(false)
        return
      }
    }

    toast({ title: "Working hours saved" })
    await loadData()
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    )
  }

  const openDays = days.filter((d) => d.is_open).length

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Working Hours</h1>
          <p className="text-zinc-500 mt-1">
            Set your availability. Clients can only book during open hours.
          </p>
        </div>
        <Button variant="gradient" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save hours
        </Button>
      </div>

      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <Clock className="w-4 h-4 text-violet-500" />
        Open on{" "}
        <span className="font-medium text-zinc-700">
          {openDays === 7 ? "every day" : `${openDays} day${openDays !== 1 ? "s" : ""}`} a week
        </span>
      </div>

      <div className="space-y-2">
        {days.map((day, i) => (
          <motion.div
            key={day.day_of_week}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className={`p-4 rounded-xl border bg-white transition-all ${!day.is_open ? "opacity-50" : ""}`}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <div className="w-28 shrink-0">
                <p className="font-medium text-sm">{DAY_NAMES[day.day_of_week]}</p>
                <p className="text-xs text-zinc-400">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day.day_of_week]}</p>
              </div>

              <Switch
                checked={day.is_open}
                onCheckedChange={(v) => updateDay(i, "is_open", v)}
              />

              {day.is_open ? (
                <div className="flex flex-wrap items-center gap-2 flex-1">
                  <Input
                    type="time"
                    value={day.open_time}
                    onChange={(e) => updateDay(i, "open_time", e.target.value)}
                    className="w-32 text-sm"
                  />
                  <span className="text-zinc-400 text-sm">to</span>
                  <Input
                    type="time"
                    value={day.close_time}
                    onChange={(e) => updateDay(i, "close_time", e.target.value)}
                    className="w-32 text-sm"
                  />
                </div>
              ) : (
                <div className="flex-1">
                  <span className="text-sm text-zinc-400 italic">Closed</span>
                </div>
              )}
            </div>

            {day.is_open && (
              <div className="mt-4 space-y-2 sm:ml-[9.5rem]">
                {day.breaks.map((breakItem, breakIndex) => (
                  <div key={breakIndex} className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-zinc-400 w-12">Break</span>
                    <Input
                      type="time"
                      value={breakItem.start_time}
                      onChange={(e) => updateBreak(i, breakIndex, "start_time", e.target.value)}
                      className="w-28 text-sm"
                    />
                    <span className="text-zinc-400 text-sm">to</span>
                    <Input
                      type="time"
                      value={breakItem.end_time}
                      onChange={(e) => updateBreak(i, breakIndex, "end_time", e.target.value)}
                      className="w-28 text-sm"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-zinc-400 hover:text-red-600"
                      onClick={() => removeBreak(i, breakIndex)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addBreak(i)}
                  className="text-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add break
                </Button>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      <div className="text-xs text-zinc-400 pt-2">
        Changes take effect immediately on your public booking page.
      </div>
    </div>
  )
}

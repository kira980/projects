"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Plus,
  Scissors,
  Pencil,
  Trash2,
  Loader2,
  Clock,
  DollarSign,
  MoreVertical,
  Power,
  Tag,
  GripVertical,
  X,
} from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { createClient } from "@/lib/supabase/client"
import type { Service, ServiceCategory } from "@/types/database"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "@/components/ui/use-toast"
import { formatCurrency, formatDuration } from "@/lib/utils"

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  price: z.coerce.number().min(0, "Price must be 0 or more"),
  duration_minutes: z.coerce.number().min(5, "Minimum 5 minutes").max(480, "Maximum 8 hours"),
  category_id: z.string().optional(),
  active: z.boolean().default(true),
})

const UNCATEGORISED = "__none__"

type FormData = z.infer<typeof schema>

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([])
  const [categories, setCategories] = useState<ServiceCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [editingService, setEditingService] = useState<Service | null>(null)
  const [saving, setSaving] = useState(false)
  const [businessId, setBusinessId] = useState<string>("")
  const [activeFilter, setActiveFilter] = useState<string>("all")

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { active: true, duration_minutes: 30, price: 0 },
  })

  const activeValue = watch("active")
  const categoryValue = watch("category_id")

  const loadData = async () => {
    const supabase = createClient() as AnySupabase
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: biz } = await supabase
      .from("businesses")
      .select("id")
      .eq("owner_id", user.id)
      .single()

    if (!biz) return
    setBusinessId(biz.id)

    const [{ data }, { data: cats }] = await Promise.all([
      supabase
        .from("services")
        .select("*")
        .eq("business_id", biz.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("service_categories")
        .select("*")
        .eq("business_id", biz.id)
        .order("sort_order")
        .order("name"),
    ])

    setServices((data as Service[]) ?? [])
    setCategories((cats as ServiceCategory[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const openCreate = () => {
    setEditingService(null)
    reset({
      active: true,
      duration_minutes: 30,
      price: 0,
      // Creating from inside a filtered category pre-selects it.
      category_id: activeFilter !== "all" && activeFilter !== UNCATEGORISED ? activeFilter : UNCATEGORISED,
    })
    setDialogOpen(true)
  }

  const openEdit = (service: Service) => {
    setEditingService(service)
    reset({
      name: service.name,
      description: service.description ?? "",
      price: service.price,
      duration_minutes: service.duration_minutes,
      category_id: service.category_id ?? UNCATEGORISED,
      active: service.active,
    })
    setDialogOpen(true)
  }

  const onSubmit = async (data: FormData) => {
    setSaving(true)
    const supabase = createClient() as AnySupabase
    const { category_id, ...rest } = data
    const payload = { ...rest, category_id: category_id === UNCATEGORISED ? null : category_id ?? null }

    if (editingService) {
      const { error } = await supabase
        .from("services")
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("id", editingService.id)

      if (error) {
        toast({ variant: "destructive", title: "Error", description: error.message })
      } else {
        toast({ title: "Service updated" })
        setDialogOpen(false)
        loadData()
      }
    } else {
      const { error } = await supabase
        .from("services")
        .insert({ ...payload, business_id: businessId })

      if (error) {
        toast({ variant: "destructive", title: "Error", description: error.message })
      } else {
        toast({ title: "Service created" })
        setDialogOpen(false)
        loadData()
      }
    }
    setSaving(false)
  }

  const toggleActive = async (service: Service) => {
    const supabase = createClient() as AnySupabase
    await supabase
      .from("services")
      .update({ active: !service.active, updated_at: new Date().toISOString() })
      .eq("id", service.id)
    loadData()
  }

  const deleteService = async (service: Service) => {
    if (!confirm(`Delete "${service.name}"? This cannot be undone.`)) return
    const supabase = createClient() as AnySupabase
    await supabase.from("services").delete().eq("id", service.id)
    toast({ title: "Service deleted" })
    loadData()
  }

  const addCategory = async (name: string) => {
    const supabase = createClient() as AnySupabase
    const { error } = await supabase
      .from("service_categories")
      .insert({ business_id: businessId, name, sort_order: categories.length })
    if (error) toast({ variant: "destructive", title: "Error", description: error.message })
    else loadData()
  }

  const renameCategory = async (id: string, name: string) => {
    const supabase = createClient() as AnySupabase
    const { error } = await supabase
      .from("service_categories")
      .update({ name, updated_at: new Date().toISOString() })
      .eq("id", id)
    if (error) toast({ variant: "destructive", title: "Error", description: error.message })
    else loadData()
  }

  // Services are not deleted with their category — they fall back to Uncategorised.
  const deleteCategory = async (category: ServiceCategory) => {
    const count = services.filter(s => s.category_id === category.id).length
    const warning = count
      ? `Delete "${category.name}"? ${count} service${count > 1 ? "s" : ""} will remain in All with no category.`
      : `Delete "${category.name}"?`
    if (!confirm(warning)) return
    const supabase = createClient() as AnySupabase
    const { error } = await supabase.from("service_categories").delete().eq("id", category.id)
    if (error) toast({ variant: "destructive", title: "Error", description: error.message })
    else {
      toast({ title: "Category deleted" })
      if (activeFilter === category.id) setActiveFilter("all")
      loadData()
    }
  }

  const moveCategory = async (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= categories.length) return
    const reordered = [...categories]
    const [moved] = reordered.splice(index, 1)
    reordered.splice(target, 0, moved)
    setCategories(reordered)
    const supabase = createClient() as AnySupabase
    await Promise.all(reordered.map((c, i) =>
      supabase.from("service_categories").update({ sort_order: i, updated_at: new Date().toISOString() }).eq("id", c.id)
    ))
    loadData()
  }

  // "All" is always the default flat list; categories are optional filters.
  const unassignedServices = services.filter(service => !service.category_id || !categories.some(category => category.id === service.category_id))
  const groups = activeFilter === "all" || categories.length === 0
    ? [{ id: "all", name: "All", services }]
    : [{
        id: activeFilter,
        name: activeFilter === UNCATEGORISED ? "No category" : categories.find(category => category.id === activeFilter)?.name ?? "",
        services: activeFilter === UNCATEGORISED ? unassignedServices : services.filter(service => service.category_id === activeFilter),
      }]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Services</h1>
          <p className="text-zinc-500 mt-1">
            Manage your offerings, prices, and durations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setCategoryDialogOpen(true)}>
            <Tag className="w-4 h-4" />
            Categories
          </Button>
          <Button variant="gradient" onClick={openCreate}>
            <Plus className="w-4 h-4" />
            Add service
          </Button>
        </div>
      </div>

      {/* Category filter — one tap to narrow the list */}
      {!loading && (services.length > 0 || categories.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {[
            { id: "all", name: "All", count: services.length },
            ...categories.map(c => ({ id: c.id, name: c.name, count: services.filter(s => s.category_id === c.id).length })),
            ...(categories.length > 0 && unassignedServices.length > 0 ? [{ id: UNCATEGORISED, name: "No category", count: unassignedServices.length }] : []),
          ]
            .map(chip => (
              <button
                key={chip.id}
                onClick={() => setActiveFilter(chip.id)}
                aria-pressed={activeFilter === chip.id}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  activeFilter === chip.id
                    ? "border-violet-600 bg-violet-600 text-white"
                    : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50"
                }`}
              >
                {chip.name}
                <span className={activeFilter === chip.id ? "text-violet-200" : "text-zinc-400"}>{chip.count}</span>
              </button>
            ))}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : services.length === 0 ? (
        <EmptyState onAdd={openCreate} />
      ) : (
        <div className="space-y-8">
          {groups.map(group => (
            <section key={group.id}>
              {/* A single unnamed group needs no heading. */}
              {(group.id !== "all") && (
                <div className="flex items-center gap-3 mb-3">
                  <h2 className="text-sm font-semibold text-zinc-700">{group.name}</h2>
                  <span className="text-xs text-zinc-400">{group.services.length}</span>
                  <div className="h-px flex-1 bg-zinc-100" />
                </div>
              )}
              {group.services.length === 0 && <p className="text-sm text-zinc-500">No services in this category yet. Add a service or assign an existing one.</p>}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                <AnimatePresence>
                  {group.services.map((service, i) => (
                    <motion.div
                      key={service.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                    >
                      <ServiceCard
                        service={service}
                        onEdit={openEdit}
                        onToggle={toggleActive}
                        onDelete={deleteService}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingService ? "Edit service" : "New service"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Service name *</Label>
              <Input placeholder="e.g. Haircut & Style" {...register("name")} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                placeholder="What&apos;s included in this service?"
                rows={3}
                {...register("description")}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Category</Label>
              <div className="flex flex-wrap gap-1.5">
                {[{ id: UNCATEGORISED, name: "None" }, ...categories].map(option => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setValue("category_id", option.id)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      (categoryValue ?? UNCATEGORISED) === option.id
                        ? "border-violet-600 bg-violet-600 text-white"
                        : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                    }`}
                  >
                    {option.name}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setCategoryDialogOpen(true)}
                  className="rounded-full border border-dashed border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-500 hover:border-violet-400 hover:text-violet-600"
                >
                  <Plus className="mr-1 inline h-3 w-3" />New
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Price ($)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className="pl-9"
                    {...register("price")}
                  />
                </div>
                {errors.price && <p className="text-xs text-destructive">{errors.price.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label>Duration (min)</Label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <Input
                    type="number"
                    step="5"
                    min="5"
                    max="480"
                    placeholder="30"
                    className="pl-9"
                    {...register("duration_minutes")}
                  />
                </div>
                {errors.duration_minutes && (
                  <p className="text-xs text-destructive">{errors.duration_minutes.message}</p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg">
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-xs text-zinc-400">Visible on your booking page</p>
              </div>
              <Switch
                checked={activeValue}
                onCheckedChange={(v) => setValue("active", v)}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="gradient" disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {editingService ? "Save changes" : "Create service"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <CategoryManager
        open={categoryDialogOpen}
        onOpenChange={setCategoryDialogOpen}
        categories={categories}
        counts={Object.fromEntries(categories.map(c => [c.id, services.filter(s => s.category_id === c.id).length]))}
        onAdd={addCategory}
        onRename={renameCategory}
        onDelete={deleteCategory}
        onMove={moveCategory}
      />
    </div>
  )
}

function CategoryManager({
  open,
  onOpenChange,
  categories,
  counts,
  onAdd,
  onRename,
  onDelete,
  onMove,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: ServiceCategory[]
  counts: Record<string, number>
  onAdd: (name: string) => Promise<void>
  onRename: (id: string, name: string) => Promise<void>
  onDelete: (category: ServiceCategory) => void
  onMove: (index: number, direction: -1 | 1) => void
}) {
  const [newName, setNewName] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState("")
  const [busy, setBusy] = useState(false)

  const submitNew = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    setBusy(true)
    await onAdd(name)
    setNewName("")
    setBusy(false)
  }

  const commitRename = async (id: string) => {
    const name = draftName.trim()
    setEditingId(null)
    if (name) await onRename(id, name)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Service categories</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-zinc-500">
          Group your services so customers can find them faster when booking.
        </p>

        <form onSubmit={submitNew} className="flex gap-2">
          <Input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="e.g. Haircuts"
            maxLength={40}
          />
          <Button type="submit" variant="gradient" disabled={busy || !newName.trim()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add
          </Button>
        </form>

        {categories.length === 0 ? (
          <p className="py-6 text-center text-sm text-zinc-400">No categories yet.</p>
        ) : (
          <ul className="max-h-72 space-y-1.5 overflow-y-auto">
            {categories.map((category, index) => (
              <li key={category.id} className="flex items-center gap-2 rounded-lg border border-zinc-100 bg-white px-3 py-2">
                <div className="flex flex-col text-zinc-300">
                  <button type="button" aria-label="Move up" onClick={() => onMove(index, -1)} disabled={index === 0} className="leading-none hover:text-zinc-600 disabled:opacity-30">▴</button>
                  <button type="button" aria-label="Move down" onClick={() => onMove(index, 1)} disabled={index === categories.length - 1} className="leading-none hover:text-zinc-600 disabled:opacity-30">▾</button>
                </div>
                <GripVertical className="h-3.5 w-3.5 shrink-0 text-zinc-300" />
                {editingId === category.id ? (
                  <Input
                    autoFocus
                    value={draftName}
                    onChange={e => setDraftName(e.target.value)}
                    onBlur={() => commitRename(category.id)}
                    onKeyDown={e => {
                      if (e.key === "Enter") commitRename(category.id)
                      if (e.key === "Escape") setEditingId(null)
                    }}
                    className="h-8 flex-1"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => { setEditingId(category.id); setDraftName(category.name) }}
                    className="flex-1 text-left text-sm font-medium"
                  >
                    {category.name}
                  </button>
                )}
                <span className="text-xs text-zinc-400">{counts[category.id] ?? 0}</span>
                <button
                  type="button"
                  onClick={() => onDelete(category)}
                  aria-label={`Delete ${category.name}`}
                  className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ServiceCard({
  service,
  onEdit,
  onToggle,
  onDelete,
}: {
  service: Service
  onEdit: (s: Service) => void
  onToggle: (s: Service) => void
  onDelete: (s: Service) => void
}) {
  return (
    <div className={`group relative rounded-xl border bg-white p-5 transition-all duration-200 hover:shadow-md ${!service.active ? "opacity-60" : ""}`}>
      <div className="w-12 h-12 rounded-xl bg-violet-50 flex items-center justify-center mb-4">
        <Scissors className="w-6 h-6 text-violet-500" />
      </div>

      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold truncate">{service.name}</h3>
          {service.description && (
            <p className="text-xs text-zinc-400 mt-0.5 line-clamp-2">{service.description}</p>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(service)}>
              <Pencil className="w-4 h-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onToggle(service)}>
              <Power className="w-4 h-4" />
              {service.active ? "Deactivate" : "Activate"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(service)}
              className="text-red-600 focus:text-red-600 focus:bg-red-50"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-3 mt-4 pt-4 border-t">
        <span className="text-lg font-bold">{formatCurrency(service.price)}</span>
        <span className="text-zinc-400">·</span>
        <span className="text-sm text-zinc-500 flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" />
          {formatDuration(service.duration_minutes)}
        </span>
        <div className="ml-auto">
          <Badge variant={service.active ? "success" : "secondary"}>
            {service.active ? "Active" : "Inactive"}
          </Badge>
        </div>
      </div>
    </div>
  )
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="text-center py-20 border border-dashed rounded-xl bg-white">
      <div className="w-14 h-14 rounded-full bg-violet-50 flex items-center justify-center mx-auto mb-4">
        <Scissors className="w-7 h-7 text-violet-400" />
      </div>
      <h3 className="font-semibold text-zinc-700 mb-1">No services yet</h3>
      <p className="text-sm text-zinc-400 mb-5 max-w-xs mx-auto">
        Add your first service so clients can start booking with you
      </p>
      <Button variant="gradient" onClick={onAdd}>
        <Plus className="w-4 h-4" />
        Add your first service
      </Button>
    </div>
  )
}

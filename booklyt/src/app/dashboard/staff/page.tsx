"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Plus,
  Users,
  Pencil,
  Trash2,
  Loader2,
  MoreVertical,
  Power,
  Check,
  Scissors,
} from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { createClient } from "@/lib/supabase/client"
import type { Service, ServiceCategory, StaffMember, StaffService } from "@/types/database"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
import { getInitials } from "@/lib/utils"

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  role: z.string().optional(),
  bio: z.string().optional(),
  active: z.boolean().default(true),
})

type FormData = z.infer<typeof schema>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [categories, setCategories] = useState<ServiceCategory[]>([])
  const [links, setLinks] = useState<StaffService[]>([])
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<StaffMember | null>(null)
  const [saving, setSaving] = useState(false)
  const [businessId, setBusinessId] = useState("")

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { active: true },
  })

  const activeValue = watch("active")

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

    const [{ data }, { data: svc }, { data: cats }] = await Promise.all([
      supabase
        .from("staff_members")
        .select("*")
        .eq("business_id", biz.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("services")
        .select("*")
        .eq("business_id", biz.id)
        .order("name"),
      supabase
        .from("service_categories")
        .select("*")
        .eq("business_id", biz.id)
        .order("sort_order")
        .order("name"),
    ])

    const members = (data as StaffMember[]) ?? []
    setStaff(members)
    setServices((svc as Service[]) ?? [])
    setCategories((cats as ServiceCategory[]) ?? [])

    if (members.length) {
      const { data: assignments } = await supabase
        .from("staff_services")
        .select("*")
        .in("staff_member_id", members.map(m => m.id))
      setLinks((assignments as StaffService[]) ?? [])
    } else {
      setLinks([])
    }
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const openCreate = () => {
    setEditingMember(null)
    reset({ active: true })
    // A new member starts able to do everything, matching the "no rows = all" rule.
    setSelectedServiceIds(services.map(s => s.id))
    setDialogOpen(true)
  }

  const openEdit = (member: StaffMember) => {
    setEditingMember(member)
    reset({
      name: member.name,
      role: member.role ?? "",
      bio: member.bio ?? "",
      active: member.active,
    })
    const assigned = links.filter(l => l.staff_member_id === member.id).map(l => l.service_id)
    // No stored rows means "performs everything" — show that as all selected.
    setSelectedServiceIds(assigned.length ? assigned : services.map(s => s.id))
    setDialogOpen(true)
  }

  // Assignments are stored as an explicit set, except when a member does every
  // service — then the rows are cleared, which the booking page reads as "all".
  const saveAssignments = async (supabase: AnySupabase, staffMemberId: string) => {
    await supabase.from("staff_services").delete().eq("staff_member_id", staffMemberId)
    const doesEverything = services.length > 0 && selectedServiceIds.length === services.length
    if (doesEverything || selectedServiceIds.length === 0) return
    await supabase.from("staff_services").insert(
      selectedServiceIds.map(service_id => ({ staff_member_id: staffMemberId, service_id }))
    )
  }

  const onSubmit = async (data: FormData) => {
    setSaving(true)
    const supabase = createClient() as AnySupabase

    if (editingMember) {
      const { error } = await supabase
        .from("staff_members")
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq("id", editingMember.id)

      if (error) {
        toast({ variant: "destructive", title: "Error", description: error.message })
      } else {
        await saveAssignments(supabase, editingMember.id)
        toast({ title: "Staff member updated" })
        setDialogOpen(false)
        loadData()
      }
    } else {
      const { data: created, error } = await supabase
        .from("staff_members")
        .insert({ ...data, business_id: businessId })
        .select("id")
        .single()

      if (error) {
        toast({ variant: "destructive", title: "Error", description: error.message })
      } else {
        if (created?.id) await saveAssignments(supabase, created.id)
        toast({ title: "Staff member added" })
        setDialogOpen(false)
        loadData()
      }
    }
    setSaving(false)
  }

  const toggleService = (serviceId: string) => {
    setSelectedServiceIds(prev =>
      prev.includes(serviceId) ? prev.filter(id => id !== serviceId) : [...prev, serviceId]
    )
  }

  // Service picker rows, grouped the same way the services page groups them.
  const serviceGroups = [
    ...categories.map(c => ({ id: c.id, name: c.name, services: services.filter(s => s.category_id === c.id) })),
    { id: "none", name: "Uncategorised", services: services.filter(s => !s.category_id) },
  ].filter(group => group.services.length > 0)

  const servicesForMember = (member: StaffMember) => {
    const assigned = links.filter(l => l.staff_member_id === member.id)
    if (assigned.length === 0) return null
    return services.filter(s => assigned.some(l => l.service_id === s.id))
  }

  const toggleActive = async (member: StaffMember) => {
    const supabase = createClient() as AnySupabase
    await supabase
      .from("staff_members")
      .update({ active: !member.active, updated_at: new Date().toISOString() })
      .eq("id", member.id)
    loadData()
  }

  const deleteMember = async (member: StaffMember) => {
    if (!confirm(`Remove "${member.name}" from your team?`)) return
    const supabase = createClient() as AnySupabase
    await supabase.from("staff_members").delete().eq("id", member.id)
    toast({ title: "Staff member removed" })
    loadData()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Staff</h1>
          <p className="text-zinc-500 mt-1">Manage your team members and their profiles</p>
        </div>
        <Button variant="gradient" onClick={openCreate}>
          <Plus className="w-4 h-4" />
          Add staff
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      ) : staff.length === 0 ? (
        <EmptyState onAdd={openCreate} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          <AnimatePresence>
            {staff.map((member, i) => (
              <motion.div
                key={member.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <StaffCard
                  member={member}
                  assignedServices={servicesForMember(member)}
                  onEdit={openEdit}
                  onToggle={toggleActive}
                  onDelete={deleteMember}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingMember ? "Edit staff member" : "Add team member"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Full name *</Label>
              <Input placeholder="e.g. Jamie Smith" {...register("name")} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Role / title</Label>
              <Input placeholder="e.g. Senior Barber, Lead Therapist" {...register("role")} />
            </div>

            <div className="space-y-1.5">
              <Label>Bio</Label>
              <Textarea
                placeholder="Brief description about this team member…"
                rows={3}
                {...register("bio")}
              />
            </div>

            {services.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Services they perform</Label>
                  <button
                    type="button"
                    onClick={() => setSelectedServiceIds(
                      selectedServiceIds.length === services.length ? [] : services.map(s => s.id)
                    )}
                    className="text-xs font-medium text-violet-600 hover:text-violet-700"
                  >
                    {selectedServiceIds.length === services.length ? "Clear all" : "Select all"}
                  </button>
                </div>
                <div className="max-h-48 space-y-3 overflow-y-auto rounded-lg border border-zinc-100 p-3">
                  {serviceGroups.map(group => (
                    <div key={group.id}>
                      {serviceGroups.length > 1 && (
                        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
                          {group.name}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-1.5">
                        {group.services.map(service => {
                          const on = selectedServiceIds.includes(service.id)
                          return (
                            <button
                              key={service.id}
                              type="button"
                              onClick={() => toggleService(service.id)}
                              aria-pressed={on}
                              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                                on
                                  ? "border-violet-600 bg-violet-600 text-white"
                                  : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                              }`}
                            >
                              {on && <Check className="h-3 w-3" />}
                              {service.name}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-zinc-400">
                  {selectedServiceIds.length === 0
                    ? "No services selected — this member will not be offered for any booking."
                    : selectedServiceIds.length === services.length
                      ? "Performs every service."
                      : `Offered for ${selectedServiceIds.length} of ${services.length} services.`}
                </p>
              </div>
            )}

            <div className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg">
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-xs text-zinc-400">Visible on booking page</p>
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
                {editingMember ? "Save changes" : "Add member"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function StaffCard({
  member,
  assignedServices,
  onEdit,
  onToggle,
  onDelete,
}: {
  member: StaffMember
  assignedServices: Service[] | null
  onEdit: (m: StaffMember) => void
  onToggle: (m: StaffMember) => void
  onDelete: (m: StaffMember) => void
}) {
  return (
    <div
      className={`group relative rounded-xl border bg-white p-5 transition-all duration-200 hover:shadow-md ${
        !member.active ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-start gap-4">
        <Avatar className="w-14 h-14 shrink-0">
          <AvatarImage src={member.avatar_url ?? undefined} />
          <AvatarFallback className="text-lg">{getInitials(member.name)}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-semibold truncate">{member.name}</h3>
              {member.role && (
                <p className="text-sm text-zinc-500 truncate">{member.role}</p>
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 shrink-0">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(member)}>
                  <Pencil className="w-4 h-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onToggle(member)}>
                  <Power className="w-4 h-4" />
                  {member.active ? "Deactivate" : "Activate"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onDelete(member)}
                  className="text-red-600 focus:text-red-600 focus:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                  Remove
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {member.bio && (
            <p className="text-xs text-zinc-400 mt-1.5 line-clamp-2">{member.bio}</p>
          )}

          {/* null means no stored rows, i.e. this member performs everything. */}
          <p className="mt-2 flex items-center gap-1.5 text-xs text-zinc-400">
            <Scissors className="h-3 w-3 shrink-0" />
            {assignedServices === null
              ? "All services"
              : assignedServices.length === 0
                ? "No services assigned"
                : assignedServices.length <= 2
                  ? assignedServices.map(s => s.name).join(", ")
                  : `${assignedServices[0].name} +${assignedServices.length - 1} more`}
          </p>

          <div className="mt-3">
            <Badge variant={member.active ? "success" : "secondary"}>
              {member.active ? "Active" : "Inactive"}
            </Badge>
          </div>
        </div>
      </div>
    </div>
  )
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="text-center py-20 border border-dashed rounded-xl bg-white">
      <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4">
        <Users className="w-7 h-7 text-blue-400" />
      </div>
      <h3 className="font-semibold text-zinc-700 mb-1">No team members yet</h3>
      <p className="text-sm text-zinc-400 mb-5 max-w-xs mx-auto">
        Add your staff so clients can choose who they book with
      </p>
      <Button variant="gradient" onClick={onAdd}>
        <Plus className="w-4 h-4" />
        Add your first team member
      </Button>
    </div>
  )
}

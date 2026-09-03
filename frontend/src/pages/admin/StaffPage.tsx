import { useState } from 'react'
import {
  useStaffList, useStaffSchedules, useLeaveRequests, useRoles, useCreateStaff,
} from '@/hooks/useApi'
import { api } from '@/lib/api'
import { useQueryClient } from '@tanstack/react-query'
import type { User, Role, StaffSchedule, LeaveRequest } from '@/types'
import { formatDateDisplay } from '@/lib/format'
import { stripPhoneInput } from '@/lib/phone'
import { useAuthStore } from '@/stores/authStore'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { RowActions, RowActionButton } from '@/components/shared/RowActions'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import { DatePicker } from '@/components/ui/date-picker'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/toast'
import {
  Plus, Edit, Search, Eye, Calendar, Save, Check, X, AlertCircle, Inbox, Loader2,
  UserPlus, UserCog, UserRound, CalendarPlus, CalendarOff, Trash2, Mail, Phone, ShieldCheck, Building2, Lock, Users,
} from 'lucide-react'

const ASSIGNABLE_ROLES: Record<string, string[]> = {
  super_admin: ['super_admin', 'admin', 'hotel_manager', 'receptionist', 'housekeeping', 'cashier', 'staff'],
  admin: ['admin', 'hotel_manager', 'receptionist', 'housekeeping', 'cashier', 'staff'],
  hotel_manager: ['receptionist', 'housekeeping', 'cashier', 'staff'],
}

const ROLE_BADGE_VARIANT: Record<string, 'danger' | 'gold' | 'info' | 'success' | 'warning' | 'default'> = {
  super_admin: 'danger',
  admin: 'gold',
  hotel_manager: 'info',
  receptionist: 'success',
  housekeeping: 'warning',
  cashier: 'default',
  staff: 'default',
}

function StaffAvatar({ name }: { name: string }) {
  const initials = (name || '?')
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
      {initials}
    </div>
  )
}

const STAFF_TABS = ['All Staff', 'Schedules', 'Leave Requests'] as const

const LEAVE_TYPE_CONFIG: Record<string, { variant: 'info' | 'danger' | 'warning' | 'default'; label: string }> = {
  annual: { variant: 'info', label: 'Annual' },
  sick: { variant: 'danger', label: 'Sick' },
  personal: { variant: 'warning', label: 'Personal' },
  other: { variant: 'default', label: 'Other' },
}

const LEAVE_STATUS_CONFIG: Record<string, { variant: 'warning' | 'success' | 'danger' | 'default'; label: string }> = {
  pending: { variant: 'warning', label: 'Pending' },
  approved: { variant: 'success', label: 'Approved' },
  rejected: { variant: 'danger', label: 'Rejected' },
  cancelled: { variant: 'default', label: 'Cancelled' },
}

function formatDate(dateStr: string) {
  if (!dateStr) return '-'
  return formatDateDisplay(dateStr)
}



export default function StaffPage() {
  const [activeTab, setActiveTab] = useState<string>('All Staff')
  const queryClient = useQueryClient()
  const { addToast } = useToast()
  const { user: authUser, token: authToken, setAuth } = useAuthStore()
  const currentUserRole = authUser?.role ?? ''

  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')

  const [viewStaffId, setViewStaffId] = useState<number | null>(null)
  const [editStaff, setEditStaff] = useState<User | null>(null)
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', role_id: '', is_active: true, password: '', password_confirmation: '' })
  const [editFormErrors, setEditFormErrors] = useState<Record<string, string>>({})

  const [showAddStaff, setShowAddStaff] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', email: '', password: '', role_id: '', phone: '', is_active: true })
  const [addFormErrors, setAddFormErrors] = useState<Record<string, string>>({})

  const [scheduleDateFilter, setScheduleDateFilter] = useState('')
  const [scheduleStaffFilter, setScheduleStaffFilter] = useState('')
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<StaffSchedule | null>(null)
  const [scheduleForm, setScheduleForm] = useState({ staff_id: '', date: '', start_time: '', end_time: '', notes: '' })
  const [scheduleFormErrors, setScheduleFormErrors] = useState<Record<string, string>>({})
  const [deleteScheduleId, setDeleteScheduleId] = useState<number | null>(null)

  const [showAddLeave, setShowAddLeave] = useState(false)
  const [leaveForm, setLeaveForm] = useState({ user_id: '', type: 'annual', start_date: '', end_date: '', reason: '' })
  const [leaveFormErrors, setLeaveFormErrors] = useState<Record<string, string>>({})


  const { data: staffList, isLoading: staffLoading, error: staffError, refetch: refetchStaff } = useStaffList()
  const { data: rolesData } = useRoles()
  const createStaff = useCreateStaff()
  const { data: schedulesData, isLoading: schedulesLoading, error: schedulesError, refetch: refetchSchedules } = useStaffSchedules(
    scheduleDateFilter || scheduleStaffFilter
      ? { date: scheduleDateFilter || undefined, user_id: scheduleStaffFilter || undefined }
      : undefined,
  )
  const { data: leaveRequestsData, isLoading: leaveLoading, error: leaveError, refetch: refetchLeaves } = useLeaveRequests()

  const staff = (staffList?.data ?? []) as User[]
  const roles = (rolesData ?? []) as Role[]
  const scheduleList = (schedulesData?.data ?? []) as StaffSchedule[]
  const leaveList = (leaveRequestsData?.data ?? []) as LeaveRequest[]

  const canAddStaff = ['super_admin', 'admin', 'hotel_manager'].includes(currentUserRole)
  const assignableRoleIds = roles.filter((r) => (ASSIGNABLE_ROLES[currentUserRole] ?? []).includes(r.slug)).map((r) => r.id)
  const canResetStaffPassword = editStaff ? assignableRoleIds.includes(editStaff.role?.id ?? -1) : false

  const filteredStaff = staff.filter((s) => {
    const q = search.toLowerCase()
    if (q && !s.name.toLowerCase().includes(q) && !s.email.toLowerCase().includes(q)) return false
    if (roleFilter && String(s.role?.id ?? '') !== roleFilter) return false
    return true
  })

  const staffHasActiveFilters = Boolean(search || roleFilter)

  function clearStaffFilters() {
    setSearch('')
    setRoleFilter('')
  }

  const staffColumns: Column<User>[] = [
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      render: (s) => (
        <div className="flex items-center gap-2.5">
          <StaffAvatar name={s.name} />
          <div className="min-w-0">
            <span className="block truncate text-sm font-medium text-foreground">{s.name}</span>
            <span className="block truncate text-xs text-muted">{s.email}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      label: 'Role',
      render: (s) => {
        const variant = ROLE_BADGE_VARIANT[s.role?.slug ?? ''] ?? 'info'
        return <Badge variant={variant}>{s.role?.name ?? '-'}</Badge>
      },
    },
    {
      key: 'phone',
      label: 'Phone',
      render: (s) => <span className="text-muted">{s.phone || '-'}</span>,
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (s) => <StatusBadge status={s.is_active ? 'active' : 'inactive'} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (s) => (
        <RowActions>
          <RowActionButton
            tone="neutral"
            title="View"
            icon={<Eye className="h-4 w-4" />}
            onClick={() => setViewStaffId(s.id)}
          />
          <RowActionButton
            tone="neutral"
            title="Edit"
            icon={<Edit className="h-4 w-4" />}
            onClick={() => openEditModal(s)}
          />
        </RowActions>
      ),
    },
  ]

  function openEditModal(staff: User) {
    setEditStaff(staff)
    setEditForm({
      name: staff.name,
      email: staff.email,
      phone: staff.phone ?? '',
      role_id: staff.role?.id ? String(staff.role.id) : '',
      is_active: staff.is_active,
      password: '',
      password_confirmation: '',
    })
    setEditFormErrors({})
  }

  function closeEditModal() {
    setEditStaff(null)
    setEditForm({ name: '', email: '', phone: '', role_id: '', is_active: true, password: '', password_confirmation: '' })
    setEditFormErrors({})
  }

  function validateEditForm() {
    const errors: Record<string, string> = {}
    if (!editForm.name.trim()) errors.name = 'Name is required'
    if (!editForm.email.trim()) errors.email = 'Email is required'
    const passwordFilled = editForm.password.trim().length > 0
    const confirmationFilled = editForm.password_confirmation.trim().length > 0
    if (passwordFilled || confirmationFilled) {
      if (!passwordFilled) errors.password = 'New password is required'
      else if (editForm.password.length < 8) errors.password = 'Password must be at least 8 characters'
      if (!confirmationFilled) errors.password_confirmation = 'Please confirm the new password'
      else if (editForm.password !== editForm.password_confirmation) errors.password_confirmation = 'Passwords do not match'
    }
    setEditFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validateEditForm() || !editStaff) return
    const payload: Record<string, unknown> = {
      ...editForm,
      role_id: editForm.role_id ? Number(editForm.role_id) : undefined,
    }
    if (!editForm.password.trim()) {
      delete payload.password
      delete payload.password_confirmation
    }
    api.put(`/staff/${editStaff.id}`, payload).then(() => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
      if (editStaff.id === authUser?.id && authToken) {
        setAuth(authToken, { ...authUser, name: payload.name as string })
      }
      closeEditModal()
      addToast('Staff updated successfully', 'success')
    }).catch(() => {
      addToast('Failed to update staff', 'error')
    })
  }

  function handleAddStaff() {
    const errors: Record<string, string> = {}
    if (!addForm.name.trim()) errors.name = 'Name is required'
    if (!addForm.email.trim()) errors.email = 'Email is required'
    if (!addForm.password) errors.password = 'Password is required'
    else if (addForm.password.length < 8) errors.password = 'Password must be at least 8 characters'
    if (!addForm.role_id) errors.role_id = 'Role is required'
    setAddFormErrors(errors)
    if (Object.keys(errors).length > 0) return

    createStaff.mutate(
      {
        name: addForm.name,
        email: addForm.email,
        password: addForm.password,
        role_id: Number(addForm.role_id),
        phone: addForm.phone || undefined,
        is_active: addForm.is_active,
      },
      {
        onSuccess: () => {
          addToast('Staff account created successfully', 'success')
          setShowAddStaff(false)
          setAddForm({ name: '', email: '', password: '', role_id: '', phone: '', is_active: true })
          setAddFormErrors({})
        },
        onError: (err: Error) => {
          addToast(err.message || 'Failed to create staff account', 'error')
        },
      },
    )
  }

  function closeAddStaff() {
    setShowAddStaff(false)
    setAddForm({ name: '', email: '', password: '', role_id: '', phone: '', is_active: true })
    setAddFormErrors({})
  }

  function handleApproveLeave(id: number) {
    api.put(`/leave-requests/${id}`, { status: 'approved' }).then(() => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] })
      addToast('Leave request approved', 'success')
    }).catch(() => addToast('Failed to approve leave request', 'error'))
  }

  function handleRejectLeave(id: number) {
    api.put(`/leave-requests/${id}`, { status: 'rejected' }).then(() => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] })
      addToast('Leave request rejected', 'success')
    }).catch(() => addToast('Failed to reject leave request', 'error'))
  }

  function openAddSchedule() {
    setEditingSchedule(null)
    setScheduleForm({ staff_id: '', date: '', start_time: '', end_time: '', notes: '' })
    setScheduleFormErrors({})
    setShowScheduleModal(true)
  }

  function openEditSchedule(schedule: StaffSchedule) {
    setEditingSchedule(schedule)
    setScheduleForm({
      staff_id: String(schedule.user_id),
      date: schedule.date,
      start_time: schedule.start_time,
      end_time: schedule.end_time,
      notes: schedule.notes ?? '',
    })
    setScheduleFormErrors({})
    setShowScheduleModal(true)
  }

  function closeScheduleModal() {
    setShowScheduleModal(false)
    setEditingSchedule(null)
    setScheduleForm({ staff_id: '', date: '', start_time: '', end_time: '', notes: '' })
    setScheduleFormErrors({})
  }

  function validateScheduleForm() {
    const errors: Record<string, string> = {}
    if (!scheduleForm.staff_id) errors.staff_id = 'Staff is required'
    if (!scheduleForm.date) errors.date = 'Date is required'
    if (!scheduleForm.start_time) errors.start_time = 'Start time is required'
    if (!scheduleForm.end_time) errors.end_time = 'End time is required'
    if (scheduleForm.start_time && scheduleForm.end_time && scheduleForm.end_time <= scheduleForm.start_time) {
      errors.end_time = 'End time must be after start time'
    }
    setScheduleFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  function handleScheduleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validateScheduleForm()) return

    const payload = {
      user_id: scheduleForm.staff_id,
      date: scheduleForm.date,
      start_time: scheduleForm.start_time,
      end_time: scheduleForm.end_time,
      notes: scheduleForm.notes || undefined,
    }

    if (editingSchedule) {
      api.put(`/staff-schedules/${editingSchedule.id}`, payload).then(() => {
        queryClient.invalidateQueries({ queryKey: ['staff-schedules'] })
        closeScheduleModal()
        addToast('Schedule updated successfully', 'success')
      }).catch(() => addToast('Failed to update schedule', 'error'))
    } else {
      api.post('/staff-schedules', payload).then(() => {
        queryClient.invalidateQueries({ queryKey: ['staff-schedules'] })
        closeScheduleModal()
        addToast('Schedule added successfully', 'success')
      }).catch(() => addToast('Failed to add schedule', 'error'))
    }
  }

  function handleDeleteSchedule() {
    if (deleteScheduleId === null) return
    api.delete(`/staff-schedules/${deleteScheduleId}`).then(() => {
      queryClient.invalidateQueries({ queryKey: ['staff-schedules'] })
      setDeleteScheduleId(null)
      addToast('Schedule removed successfully', 'success')
    }).catch(() => {
      setDeleteScheduleId(null)
      addToast('Failed to remove schedule', 'error')
    })
  }

  function validateLeaveForm() {
    const errors: Record<string, string> = {}
    if (!leaveForm.user_id) errors.user_id = 'Staff is required'
    if (!leaveForm.type) errors.type = 'Leave type is required'
    if (!leaveForm.start_date) errors.start_date = 'Start date is required'
    if (!leaveForm.end_date) errors.end_date = 'End date is required'
    if (leaveForm.start_date && leaveForm.end_date && leaveForm.end_date < leaveForm.start_date) {
      errors.end_date = 'End date must be on or after start date'
    }
    setLeaveFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  function closeLeaveModal() {
    setShowAddLeave(false)
    setLeaveForm({ user_id: '', type: 'annual', start_date: '', end_date: '', reason: '' })
    setLeaveFormErrors({})
  }

  function handleAddLeave(e: React.FormEvent) {
    e.preventDefault()
    if (!validateLeaveForm()) return
    const payload = {
      user_id: leaveForm.user_id,
      type: leaveForm.type,
      start_date: leaveForm.start_date,
      end_date: leaveForm.end_date,
      reason: leaveForm.reason || undefined,
    }
    api.post('/leave-requests', payload).then(() => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] })
      closeLeaveModal()
      addToast('Leave request created successfully', 'success')
    }).catch(() => addToast('Failed to create leave request', 'error'))
  }

  const leaveColumns: Column<LeaveRequest>[] = [
    {
      key: 'staff_name',
      label: 'Staff Name',
      render: (l) => (
        <div className="flex items-center gap-2.5">
          <StaffAvatar name={l.user?.name ?? '?'} />
          <span className="truncate text-sm font-medium text-foreground">{l.user?.name ?? '-'}</span>
        </div>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      render: (l) => {
        const cfg = LEAVE_TYPE_CONFIG[l.type] ?? { variant: 'default' as const, label: l.type }
        return <Badge variant={cfg.variant}>{cfg.label}</Badge>
      },
    },
    {
      key: 'start_date',
      label: 'Dates',
      className: 'whitespace-nowrap',
      render: (l) => {
        const days = Math.round((new Date(l.end_date).getTime() - new Date(l.start_date).getTime()) / 86400000) + 1
        return (
          <div>
            <span className="font-medium text-foreground">{formatDate(l.start_date)} <span className="text-muted">→</span> {formatDate(l.end_date)}</span>
            <span className="block text-xs text-muted">{days} day{days !== 1 ? 's' : ''}</span>
          </div>
        )
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (l) => {
        const cfg = LEAVE_STATUS_CONFIG[l.status] ?? { variant: 'default' as const, label: l.status }
        return <Badge variant={cfg.variant}>{cfg.label}</Badge>
      },
    },
    {
      key: 'reason',
      label: 'Reason',
      render: (l) => <span className="text-muted max-w-[200px] truncate">{l.reason || '-'}</span>,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (l) => (
        <RowActions>
          {l.status === 'pending' && (
            <>
              <RowActionButton
                tone="success"
                title="Approve"
                icon={<Check className="h-4 w-4" />}
                onClick={() => handleApproveLeave(l.id)}
              />
              <RowActionButton
                tone="danger"
                title="Reject"
                icon={<X className="h-4 w-4" />}
                onClick={() => handleRejectLeave(l.id)}
              />
            </>
          )}
        </RowActions>
      ),
    },
  ]

  const scheduleColumns: Column<StaffSchedule>[] = [
    {
      key: 'staff_name',
      label: 'Staff Name',
      render: (s) => (
        <div className="flex items-center gap-2.5">
          <StaffAvatar name={s.user?.name ?? '?'} />
          <span className="truncate text-sm font-medium text-foreground">{s.user?.name ?? '-'}</span>
        </div>
      ),
    },
    {
      key: 'date',
      label: 'Shift',
      className: 'whitespace-nowrap',
      render: (s) => (
        <div>
          <span className="font-medium text-foreground">{formatDate(s.date)}</span>
          <span className="block text-xs text-muted">{s.start_time || '-'} – {s.end_time || '-'}</span>
        </div>
      ),
    },
    {
      key: 'notes',
      label: 'Notes',
      render: (s) => <span className="text-muted max-w-[200px] truncate">{s.notes || '-'}</span>,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (s) => (
        <RowActions>
          <RowActionButton
            tone="neutral"
            title="Edit"
            icon={<Edit className="h-4 w-4" />}
            onClick={() => openEditSchedule(s)}
          />
          <RowActionButton
            tone="danger"
            title="Delete"
            icon={<Trash2 className="h-4 w-4" />}
            onClick={() => setDeleteScheduleId(s.id)}
          />
        </RowActions>
      ),
    },
  ]

  const viewStaff = viewStaffId ? staff.find((s) => s.id === viewStaffId) : null

  return (
    <div>
      <PageHeader title="Staff Management" />

      <div className="mb-6 flex gap-1 rounded-lg bg-border/50 p-0.5 w-fit">
        {STAFF_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-card text-primary shadow-sm'
                : 'text-muted hover:text-foreground'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'All Staff' && (
        <Card>
          <CardContent className="pt-6">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="relative max-w-xs flex-1">
                <Input
                  placeholder="Search by name or email..."
                  icon={<Search className="h-4 w-4" />}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-[160px]"
              >
                <option value="">All Roles</option>
                {roles.map((r) => (
                  <option key={r.id} value={String(r.id)}>{r.name}</option>
                ))}
              </Select>
              {canAddStaff && (
                <Button variant="primary" className="ml-auto" onClick={() => setShowAddStaff(true)}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Add Staff
                </Button>
              )}
            </div>

            {/* Active Filter Bar */}
            {staffHasActiveFilters && (
              <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-muted">
                <span>Active filters:</span>
                {search && (
                  <Badge variant="secondary" className="gap-1">
                    Search: {search}
                    <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => setSearch('')}>
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                )}
                {roleFilter && (
                  <Badge variant="secondary" className="gap-1">
                    Role: {roles.find((r) => String(r.id) === roleFilter)?.name}
                    <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => setRoleFilter('')}>
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                )}
                <Button variant="ghost" size="sm" onClick={clearStaffFilters}>
                  Clear all
                </Button>
              </div>
            )}

            <DataTable
              columns={staffColumns}
              data={filteredStaff}
              loading={staffLoading}
              error={staffError ? (staffError as Error).message : null}
              onRetry={() => refetchStaff()}
              keyExtractor={(s) => s.id}
              emptyState={
                <div className="flex flex-col items-center justify-center py-12">
                  <Users className="mb-3 h-10 w-10 text-muted/50" />
                  <p className="text-sm font-medium text-foreground">No staff match your filters</p>
                  <p className="text-sm text-muted">Try adjusting your search or role filter.</p>
                  {staffHasActiveFilters && (
                    <Button variant="outline" className="mt-4" onClick={clearStaffFilters}>
                      Clear all filters
                    </Button>
                  )}
                </div>
              }
            />
          </CardContent>
        </Card>
      )}

      {activeTab === 'Schedules' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Staff Schedules</CardTitle>
            <Button variant="primary" size="sm" onClick={openAddSchedule}>
              <Plus className="h-4 w-4" />
              Add Schedule
            </Button>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="w-44">
                <DatePicker
                  value={scheduleDateFilter}
                  onChange={(v) => setScheduleDateFilter(v)}
                  clearable
                />
              </div>
              <Select
                value={scheduleStaffFilter}
                onChange={(e) => setScheduleStaffFilter(e.target.value)}
                className="w-44"
              >
                <option value="">All Staff</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            </div>

            {schedulesLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : schedulesError ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-border py-12">
                <AlertCircle className="mb-3 h-10 w-10 text-danger" />
                <p className="mb-2 text-sm font-medium text-foreground">Something went wrong</p>
                <p className="mb-4 text-sm text-muted">{(schedulesError as Error).message}</p>
                <Button variant="outline" onClick={() => refetchSchedules()}>
                  Retry
                </Button>
              </div>
            ) : scheduleList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Calendar className="mb-3 h-10 w-10 text-muted/50" />
                <p className="text-sm font-medium text-foreground">No schedules for this period</p>
              </div>
            ) : (
              <DataTable
                columns={scheduleColumns}
                data={scheduleList}
                keyExtractor={(s: any) => s.id}
              />
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'Leave Requests' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Leave Requests</CardTitle>
            <Button variant="primary" size="sm" onClick={() => setShowAddLeave(true)}>
              <Plus className="h-4 w-4" />
              Request Leave
            </Button>
          </CardHeader>
          <CardContent className="pt-6">
            {leaveLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : leaveError ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-border py-12">
                <AlertCircle className="mb-3 h-10 w-10 text-danger" />
                <p className="mb-2 text-sm font-medium text-foreground">Something went wrong</p>
                <p className="mb-4 text-sm text-muted">{(leaveError as Error).message}</p>
                <Button variant="outline" onClick={() => refetchLeaves()}>
                  Retry
                </Button>
              </div>
            ) : leaveList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Inbox className="mb-3 h-10 w-10 text-muted/50" />
                <p className="text-sm font-medium text-foreground">No leave requests found</p>
              </div>
            ) : (
              <DataTable
                columns={leaveColumns}
                data={leaveList}
                keyExtractor={(l: any) => l.id}
              />
            )}
          </CardContent>
        </Card>
      )}

      <Modal
        isOpen={viewStaffId !== null}
        onClose={() => setViewStaffId(null)}
        title="Staff Details"
        size="xl"
        footer={
          <Button variant="outline" onClick={() => setViewStaffId(null)}>Close</Button>
        }
      >
        {viewStaff ? (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-lg font-bold text-primary">
                {viewStaff.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
              </div>
              <div className="min-w-0">
                <h3 className="truncate text-lg font-semibold text-foreground">{viewStaff.name}</h3>
                <p className="truncate text-sm text-muted">{viewStaff.email}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <Badge variant="info">{viewStaff.role?.name ?? '-'}</Badge>
                  <StatusBadge status={viewStaff.is_active ? 'active' : 'inactive'} />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <UserRound className="h-4 w-4" />
                </div>
                <h4 className="text-sm font-semibold text-foreground">Profile</h4>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-bg p-3">
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted">
                    <UserRound className="h-3.5 w-3.5" /> Full Name
                  </p>
                  <p className="text-sm font-semibold text-foreground">{viewStaff.name}</p>
                </div>
                <div className="rounded-xl bg-bg p-3">
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted">
                    <Mail className="h-3.5 w-3.5" /> Email
                  </p>
                  <a href={`mailto:${viewStaff.email}`} className="break-all text-sm font-semibold text-primary hover:underline">
                    {viewStaff.email}
                  </a>
                </div>
                <div className="rounded-xl bg-bg p-3">
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted">
                    <Phone className="h-3.5 w-3.5" /> Phone
                  </p>
                  <p className="text-sm font-semibold text-foreground">{viewStaff.phone || '—'}</p>
                </div>
                <div className="rounded-xl bg-bg p-3">
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted">
                    <Calendar className="h-3.5 w-3.5" /> Member Since
                  </p>
                  <p className="text-sm font-semibold text-foreground">{formatDate(viewStaff.created_at)}</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold/15 text-gold-dark">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <h4 className="text-sm font-semibold text-foreground">Role & Access</h4>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-bg p-3">
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted">
                    <ShieldCheck className="h-3.5 w-3.5" /> Role
                  </p>
                  <Badge variant="info">{viewStaff.role?.name ?? '—'}</Badge>
                </div>
                <div className="rounded-xl bg-bg p-3">
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted">
                    <Building2 className="h-3.5 w-3.5" /> Status
                  </p>
                  <StatusBadge status={viewStaff.is_active ? 'active' : 'inactive'} />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center py-8 text-center">
            <AlertCircle className="mb-2 h-8 w-8 text-muted" />
            <p className="text-sm text-muted">Could not load staff details.</p>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={showAddStaff}
        onClose={closeAddStaff}
        title="Add Staff"
        size="lg"
        footer={
          <div className="flex gap-3">
            <Button variant="outline" onClick={closeAddStaff} disabled={createStaff.isPending}>Cancel</Button>
            <Button variant="primary" onClick={handleAddStaff} disabled={createStaff.isPending}>
              {createStaff.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Account
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold/15 text-gold-dark">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground">Add Staff</h4>
              <p className="text-xs text-muted">Create a new staff account and assign a role.</p>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <UserRound className="h-4 w-4" />
              </div>
              <h4 className="text-sm font-semibold text-foreground">Account Details</h4>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Name"
                placeholder="Full name"
                value={addForm.name}
                onChange={(e) => setAddForm((p) => ({ ...p, name: e.target.value }))}
                error={addFormErrors.name}
              />
              <Input
                label="Email"
                type="email"
                placeholder="name@hotel.com"
                value={addForm.email}
                onChange={(e) => setAddForm((p) => ({ ...p, email: e.target.value }))}
                error={addFormErrors.email}
              />
              <Select
                label="Role"
                placeholder="Select role"
                value={addForm.role_id}
                onChange={(e) => setAddForm((p) => ({ ...p, role_id: e.target.value }))}
                error={addFormErrors.role_id}
              >
                {roles.filter((r) => assignableRoleIds.includes(r.id)).map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </Select>
              <Input
                label="Phone"
                placeholder="0917 123 4567 (optional)"
                value={addForm.phone}
                onChange={(e) => setAddForm((p) => ({ ...p, phone: stripPhoneInput(e.target.value) }))}
                maxLength={15}
              />
            </div>
            <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary/50"
                checked={addForm.is_active}
                onChange={(e) => setAddForm((p) => ({ ...p, is_active: e.target.checked }))}
              />
              Active
            </label>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-warning/10 text-warning">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <h4 className="text-sm font-semibold text-foreground">Security</h4>
            </div>
            <Input
              label="Password"
              type="password"
              placeholder="Minimum 8 characters"
              value={addForm.password}
              onChange={(e) => setAddForm((p) => ({ ...p, password: e.target.value }))}
              error={addFormErrors.password}
            />
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={editStaff !== null}
        onClose={closeEditModal}
        title="Edit Staff"
        size="lg"
        footer={
          <div className="flex gap-3">
            <Button variant="outline" onClick={closeEditModal}>Cancel</Button>
            <Button variant="primary" onClick={handleEditSubmit}>
              <Save className="h-4 w-4" /> Save
            </Button>
          </div>
        }
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold/15 text-gold-dark">
              <UserCog className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground">Edit Staff</h4>
              <p className="text-xs text-muted">Update the staff account details.</p>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <UserRound className="h-4 w-4" />
              </div>
              <h4 className="text-sm font-semibold text-foreground">Account Details</h4>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Name"
                value={editForm.name}
                onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                error={editFormErrors.name}
              />
              <Input
                label="Email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
                error={editFormErrors.email}
              />
              <Input
                label="Phone"
                placeholder="0917 123 4567 (optional)"
                value={editForm.phone}
                onChange={(e) => setEditForm((p) => ({ ...p, phone: stripPhoneInput(e.target.value) }))}
                maxLength={15}
              />
              <Select
                label="Role"
                value={editForm.role_id}
                onChange={(e) => setEditForm((p) => ({ ...p, role_id: e.target.value }))}
              >
                <option value="">Select role</option>
                {roles.filter((r) => assignableRoleIds.includes(r.id)).map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </Select>
            </div>
            <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary/50"
                checked={editForm.is_active}
                onChange={(e) => setEditForm((p) => ({ ...p, is_active: e.target.checked }))}
              />
              Active
            </label>
          </div>

          {canResetStaffPassword && (
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Lock className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground">Reset Password</h4>
                  <p className="text-xs text-muted">Leave blank to keep the current password.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label="New Password"
                  type="password"
                  placeholder="Enter new password"
                  value={editForm.password}
                  onChange={(e) => setEditForm((p) => ({ ...p, password: e.target.value }))}
                  error={editFormErrors.password}
                />
                <Input
                  label="Confirm Password"
                  type="password"
                  placeholder="Confirm new password"
                  value={editForm.password_confirmation}
                  onChange={(e) => setEditForm((p) => ({ ...p, password_confirmation: e.target.value }))}
                  error={editFormErrors.password_confirmation}
                />
              </div>
            </div>
          )}
        </form>
      </Modal>

      <Modal
        isOpen={showScheduleModal}
        onClose={closeScheduleModal}
        title={editingSchedule ? 'Edit Schedule' : 'Add Schedule'}
        size="lg"
        footer={
          <div className="flex gap-3">
            <Button variant="outline" onClick={closeScheduleModal}>Cancel</Button>
            <Button variant="primary" onClick={handleScheduleSubmit}>
              <Save className="h-4 w-4" /> Save
            </Button>
          </div>
        }
      >
        <form onSubmit={handleScheduleSubmit} className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold/15 text-gold-dark">
              <CalendarPlus className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground">
                {editingSchedule ? 'Edit Schedule' : 'Add Schedule'}
              </h4>
              <p className="text-xs text-muted">
                {editingSchedule ? 'Update the shift details for this staff member.' : 'Assign a shift to a staff member.'}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Calendar className="h-4 w-4" />
              </div>
              <h4 className="text-sm font-semibold text-foreground">Shift Details</h4>
            </div>
            <Select
              label="Staff"
              placeholder="Select staff"
              value={scheduleForm.staff_id}
              onChange={(e) => setScheduleForm((p) => ({ ...p, staff_id: e.target.value }))}
              error={scheduleFormErrors.staff_id}
            >
              {staff.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
            <div className="mt-4">
              <DatePicker
                label="Date"
                value={scheduleForm.date}
                onChange={(v) => setScheduleForm((p) => ({ ...p, date: v }))}
                error={scheduleFormErrors.date}
              />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Start Time"
                type="time"
                value={scheduleForm.start_time}
                onChange={(e) => setScheduleForm((p) => ({ ...p, start_time: e.target.value }))}
                error={scheduleFormErrors.start_time}
              />
              <Input
                label="End Time"
                type="time"
                value={scheduleForm.end_time}
                onChange={(e) => setScheduleForm((p) => ({ ...p, end_time: e.target.value }))}
                error={scheduleFormErrors.end_time}
              />
            </div>
            <div className="mt-4 space-y-1">
              <label className="text-sm font-medium text-foreground">Notes</label>
              <textarea
                className="flex min-h-[80px] w-full rounded-lg border border-border bg-card px-3 py-2 text-sm ring-offset-card placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary"
                placeholder="Notes..."
                value={scheduleForm.notes}
                onChange={(e) => setScheduleForm((p) => ({ ...p, notes: e.target.value }))}
              />
            </div>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={showAddLeave}
        onClose={closeLeaveModal}
        title="Request Leave"
        size="lg"
        footer={
          <div className="flex gap-3">
            <Button variant="outline" onClick={closeLeaveModal}>Cancel</Button>
            <Button variant="primary" onClick={handleAddLeave}>
              <Save className="h-4 w-4" /> Save
            </Button>
          </div>
        }
      >
        <form onSubmit={handleAddLeave} className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold/15 text-gold-dark">
              <CalendarOff className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground">Request Leave</h4>
              <p className="text-xs text-muted">Submit a leave request for a staff member.</p>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-warning/10 text-warning">
                <Calendar className="h-4 w-4" />
              </div>
              <h4 className="text-sm font-semibold text-foreground">Leave Details</h4>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Select
                label="Staff"
                placeholder="Select staff"
                value={leaveForm.user_id}
                onChange={(e) => setLeaveForm((p) => ({ ...p, user_id: e.target.value }))}
                error={leaveFormErrors.user_id}
              >
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
              <Select
                label="Leave Type"
                value={leaveForm.type}
                onChange={(e) => setLeaveForm((p) => ({ ...p, type: e.target.value }))}
                error={leaveFormErrors.type}
              >
                <option value="annual">Annual</option>
                <option value="sick">Sick</option>
                <option value="personal">Personal</option>
                <option value="other">Other</option>
              </Select>
              <DatePicker
                label="Start Date"
                value={leaveForm.start_date}
                onChange={(v) => setLeaveForm((p) => ({ ...p, start_date: v }))}
                error={leaveFormErrors.start_date}
              />
              <DatePicker
                label="End Date"
                value={leaveForm.end_date}
                onChange={(v) => setLeaveForm((p) => ({ ...p, end_date: v }))}
                error={leaveFormErrors.end_date}
              />
            </div>
            <div className="mt-4 space-y-1">
              <label className="text-sm font-medium text-foreground">Reason</label>
              <textarea
                className="flex min-h-[80px] w-full rounded-lg border border-border bg-card px-3 py-2 text-sm ring-offset-card placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary"
                placeholder="Reason..."
                value={leaveForm.reason}
                onChange={(e) => setLeaveForm((p) => ({ ...p, reason: e.target.value }))}
              />
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={deleteScheduleId !== null}
        onClose={() => setDeleteScheduleId(null)}
        onConfirm={handleDeleteSchedule}
        title="Delete Schedule"
        message="This will permanently remove this shift schedule."
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  )
}


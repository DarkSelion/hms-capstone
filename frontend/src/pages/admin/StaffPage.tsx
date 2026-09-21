import { useState } from 'react'
import {
  useStaffList, useStaffSchedules, useLeaveRequests, useRoles, useCreateStaff,
  useRevokeStaffSessions,
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
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Modal } from '@/components/ui/modal'
import { DatePicker } from '@/components/ui/date-picker'
import { useToast } from '@/components/ui/toast'
import {
  Plus, Edit, Search, Eye, Calendar, Save, Check, X, AlertCircle, Inbox, Loader2,
  UserPlus, UserCog, UserRound, CalendarPlus, CalendarOff, Trash2, Mail, Phone, ShieldCheck, Building2, Lock, Users,
  ShieldAlert, LogOut, Clock, Globe, ChevronDown, CheckCircle,
} from 'lucide-react'

const ASSIGNABLE_ROLES: Record<string, string[]> = {
  super_admin: ['super_admin', 'admin', 'hotel_manager', 'receptionist', 'housekeeping', 'cashier', 'staff'],
  admin: ['admin', 'hotel_manager', 'receptionist', 'housekeeping', 'cashier', 'staff'],
  hotel_manager: ['receptionist', 'housekeeping', 'cashier', 'staff'],
}

const ROLE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  super_admin: { bg: 'bg-indigo-50', text: 'text-indigo-700', label: 'Super Admin' },
  admin: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Admin' },
  hotel_manager: { bg: 'bg-sky-50', text: 'text-sky-700', label: 'Hotel Manager' },
  receptionist: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Receptionist' },
  housekeeping: { bg: 'bg-orange-50', text: 'text-orange-700', label: 'Housekeeping' },
  cashier: { bg: 'bg-purple-50', text: 'text-purple-700', label: 'Cashier' },
  staff: { bg: 'bg-slate-50', text: 'text-slate-700', label: 'Staff' },
}

function StaffAvatar({ name, size = 'sm' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const initials = (name || '?')
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  const sizeClasses = size === 'lg'
    ? 'h-14 w-14 text-lg'
    : size === 'md'
      ? 'h-11 w-11 text-sm'
      : 'h-9 w-9 text-xs'
  return (
    <div className={`flex ${sizeClasses} shrink-0 items-center justify-center rounded-xl bg-slate-100 font-semibold text-slate-700`}>
      {initials}
    </div>
  )
}

function RoleBadge({ slug }: { slug: string }) {
  const style = ROLE_STYLES[slug] ?? ROLE_STYLES.staff
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  )
}

function ActiveStatus({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
      active ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
    }`}>
      <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-500 animate-pulse' : 'bg-rose-400'}`} />
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}

const STAFF_TABS = ['All Staff', 'Schedules', 'Leave Requests'] as const

const LEAVE_TYPE_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  annual: { bg: 'bg-sky-50', text: 'text-sky-700', label: 'Annual' },
  sick: { bg: 'bg-rose-50', text: 'text-rose-700', label: 'Sick' },
  personal: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Personal' },
  other: { bg: 'bg-slate-50', text: 'text-slate-700', label: 'Other' },
}

const LEAVE_STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Pending' },
  approved: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Approved' },
  rejected: { bg: 'bg-rose-50', text: 'text-rose-700', label: 'Rejected' },
  cancelled: { bg: 'bg-slate-50', text: 'text-slate-700', label: 'Cancelled' },
}

function formatDate(dateStr: string) {
  if (!dateStr) return 'Not provided'
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

  const [showRevokeSessionsConfirm, setShowRevokeSessionsConfirm] = useState(false)
  const [revokeSessionsUserId, setRevokeSessionsUserId] = useState<number | null>(null)
  const revokeStaffSessions = useRevokeStaffSessions()

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

  const activeCount = staff.filter((s) => s.is_active).length
  const pendingLeaveCount = leaveList.filter((l) => l.status === 'pending').length
  const today = new Date().toISOString().split('T')[0]
  const onLeaveCount = leaveList.filter((l) => l.status === 'approved' && l.start_date <= today && l.end_date >= today).length

  const filteredStaff = staff.filter((s) => {
    const q = search.toLowerCase()
    if (q && !s.name.toLowerCase().includes(q) && !s.email.toLowerCase().includes(q) && !(s.role?.name ?? '').toLowerCase().includes(q)) return false
    if (roleFilter && String(s.role?.id ?? '') !== roleFilter) return false
    return true
  })

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
        <div className="flex items-center gap-3">
          <StaffAvatar name={s.name} />
          <div className="min-w-0">
            <span className="block truncate text-sm font-medium text-foreground">{s.name}</span>
            <span className="block truncate text-xs text-slate-500">{s.email}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      label: 'Role',
      render: (s) => <RoleBadge slug={s.role?.slug ?? ''} />,
    },
    {
      key: 'phone',
      label: 'Phone',
      render: (s) => <span className="text-sm text-slate-500">{s.phone || 'Not provided'}</span>,
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (s) => <ActiveStatus active={s.is_active} />,
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
      else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(editForm.password)) errors.password = 'Password must contain uppercase, lowercase, and a number'
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
    else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(addForm.password)) errors.password = 'Password must contain uppercase, lowercase, and a number'
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
        <div className="flex items-center gap-3">
          <StaffAvatar name={l.user?.name ?? '?'} />
          <span className="truncate text-sm font-medium text-foreground">{l.user?.name ?? 'Unknown'}</span>
        </div>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      render: (l) => {
        const cfg = LEAVE_TYPE_CONFIG[l.type] ?? LEAVE_TYPE_CONFIG.other
        return (
          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${cfg.bg} ${cfg.text}`}>
            {cfg.label}
          </span>
        )
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
            <span className="font-medium text-foreground">{formatDate(l.start_date)} <span className="text-slate-400">→</span> {formatDate(l.end_date)}</span>
            <span className="block text-xs text-slate-500">{days} day{days !== 1 ? 's' : ''}</span>
          </div>
        )
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (l) => {
        const cfg = LEAVE_STATUS_CONFIG[l.status] ?? LEAVE_STATUS_CONFIG.pending
        return (
          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${cfg.bg} ${cfg.text}`}>
            {cfg.label}
          </span>
        )
      },
    },
    {
      key: 'reason',
      label: 'Reason',
      render: (l) => <span className="text-sm text-slate-500 max-w-[200px] truncate">{l.reason || 'Not provided'}</span>,
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
        <div className="flex items-center gap-3">
          <StaffAvatar name={s.user?.name ?? '?'} />
          <span className="truncate text-sm font-medium text-foreground">{s.user?.name ?? 'Unknown'}</span>
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
          <span className="block text-xs text-slate-500">{s.start_time || '—'} – {s.end_time || '—'}</span>
        </div>
      ),
    },
    {
      key: 'notes',
      label: 'Notes',
      render: (s) => <span className="text-sm text-slate-500 max-w-[200px] truncate">{s.notes || 'Not provided'}</span>,
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
      <PageHeader
        title="Staff Management"
        description="Manage team members, roles, shift schedules, and leave requests."
      />

      {/* ── Segmented Tab Control ── */}
      <div className="mb-6 inline-flex items-center gap-0.5 rounded-xl bg-slate-100 p-1">
        {STAFF_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
              activeTab === tab
                ? 'bg-[#1A2238] text-white shadow-sm'
                : 'bg-transparent text-slate-600 hover:bg-white/80 hover:text-slate-900'
            }`}
          >
            {tab === 'All Staff' && <Users className="h-3.5 w-3.5" />}
            {tab === 'Schedules' && <Calendar className="h-3.5 w-3.5" />}
            {tab === 'Leave Requests' && <CalendarOff className="h-3.5 w-3.5" />}
            {tab}
          </button>
        ))}
      </div>

      {/* ── Summary Metric Cards ── */}
      {activeTab === 'All Staff' && (
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <Users className="h-4 w-4" />
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total Staff</span>
            </div>
            <p className="mt-2.5 text-2xl font-bold tabular-nums text-foreground">{staff.length}</p>
          </div>
          <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <CheckCircle className="h-4 w-4" />
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Active On Duty</span>
            </div>
            <p className="mt-2.5 text-2xl font-bold tabular-nums text-emerald-600">{activeCount}</p>
          </div>
          <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                <CalendarOff className="h-4 w-4" />
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">On Leave</span>
            </div>
            <p className="mt-2.5 text-2xl font-bold tabular-nums text-amber-600">{onLeaveCount}</p>
          </div>
          <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
                <Clock className="h-4 w-4" />
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Pending Requests</span>
            </div>
            <p className="mt-2.5 text-2xl font-bold tabular-nums text-sky-600">{pendingLeaveCount}</p>
          </div>
        </div>
      )}

      {activeTab === 'All Staff' && (
        <div className="rounded-xl border border-slate-200/80 bg-white shadow-sm">
          <div className="p-6">
            {/* ── Toolbar ── */}
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <input
                  id="staff-search"
                  name="staffSearch"
                  aria-label="Search staff by name, email, or role"
                  type="text"
                  placeholder="Search staff by name, email, or role..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-11 pl-10 pr-4 rounded-lg border border-slate-200 bg-white text-sm text-foreground placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50 transition-colors"
                />
              </div>

              <div className="relative">
                <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <select
                  id="staff-role-filter"
                  name="roleFilter"
                  aria-label="Filter by role"
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="h-11 pl-9 pr-10 rounded-lg border border-slate-200 bg-white text-sm text-foreground appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50 transition-colors"
                >
                  <option value="">All Roles</option>
                  {roles.map((r) => (
                    <option key={r.id} value={String(r.id)}>{r.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              </div>

              {canAddStaff && (
                <button
                  onClick={() => setShowAddStaff(true)}
                  className="h-11 px-5 rounded-lg bg-[#1A2238] text-white text-sm font-semibold inline-flex items-center gap-2 hover:bg-[#1A2238]/90 transition-colors shadow-sm"
                >
                  <UserPlus className="h-4 w-4" />
                  Add Staff
                </button>
              )}

              {(search || roleFilter) && (
                <button
                  onClick={clearStaffFilters}
                  className="h-11 px-4 rounded-lg text-xs font-semibold text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-all inline-flex items-center gap-1.5"
                >
                  <X className="h-3.5 w-3.5" />
                  Clear all
                </button>
              )}
            </div>

            {/* ── Active Filter Badges ── */}
            {(search || roleFilter) && (
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-400 font-medium">Active filters:</span>
                {search && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-xs font-medium text-slate-600">
                    Search: {search}
                    <button onClick={() => setSearch('')} className="hover:text-rose-500 transition-colors">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                {roleFilter && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-xs font-medium text-slate-600">
                    Role: {roles.find((r) => String(r.id) === roleFilter)?.name}
                    <button onClick={() => setRoleFilter('')} className="hover:text-rose-500 transition-colors">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
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
                  <Users className="mb-3 h-10 w-10 text-slate-300" />
                  <p className="text-sm font-medium text-foreground">No staff match your filters</p>
                  <p className="text-sm text-slate-500">Try adjusting your search or role filter.</p>
                  {(search || roleFilter) && (
                    <button onClick={clearStaffFilters} className="mt-4 text-sm font-medium text-slate-600 hover:text-foreground underline">
                      Clear all filters
                    </button>
                  )}
                </div>
              }
            />
          </div>
        </div>
      )}

      {activeTab === 'Schedules' && (
        <div className="rounded-xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex items-center justify-between p-6 pb-0">
            <h3 className="text-sm font-semibold text-foreground">Staff Schedules</h3>
            <button
              onClick={openAddSchedule}
              className="h-9 px-4 rounded-lg bg-[#1A2238] text-white text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-[#1A2238]/90 transition-colors shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Schedule
            </button>
          </div>
          <div className="p-6">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="w-44">
                <DatePicker
                  value={scheduleDateFilter}
                  onChange={(v) => setScheduleDateFilter(v)}
                  clearable
                />
              </div>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <select
                  id="schedule-staff-filter"
                  name="scheduleStaffFilter"
                  aria-label="Filter schedule by staff member"
                  value={scheduleStaffFilter}
                  onChange={(e) => setScheduleStaffFilter(e.target.value)}
                  className="h-11 pl-9 pr-10 rounded-lg border border-slate-200 bg-white text-sm text-foreground appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50 transition-colors"
                >
                  <option value="">All Staff</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {schedulesLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-12 w-full animate-pulse rounded-lg bg-slate-100" />
                ))}
              </div>
            ) : schedulesError ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 py-12">
                <AlertCircle className="mb-3 h-10 w-10 text-rose-400" />
                <p className="mb-2 text-sm font-medium text-foreground">Something went wrong</p>
                <p className="mb-4 text-sm text-slate-500">{(schedulesError as Error).message}</p>
                <button onClick={() => refetchSchedules()} className="text-sm font-medium text-slate-600 hover:text-foreground underline">Retry</button>
              </div>
            ) : scheduleList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Calendar className="mb-3 h-10 w-10 text-slate-300" />
                <p className="text-sm font-medium text-foreground">No schedules for this period</p>
              </div>
            ) : (
              <DataTable
                columns={scheduleColumns}
                data={scheduleList}
                keyExtractor={(s: any) => s.id}
              />
            )}
          </div>
        </div>
      )}

      {activeTab === 'Leave Requests' && (
        <div className="rounded-xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex items-center justify-between p-6 pb-0">
            <h3 className="text-sm font-semibold text-foreground">Leave Requests</h3>
            <button
              onClick={() => setShowAddLeave(true)}
              className="h-9 px-4 rounded-lg bg-[#1A2238] text-white text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-[#1A2238]/90 transition-colors shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              Request Leave
            </button>
          </div>
          <div className="p-6">
            {leaveLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-12 w-full animate-pulse rounded-lg bg-slate-100" />
                ))}
              </div>
            ) : leaveError ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 py-12">
                <AlertCircle className="mb-3 h-10 w-10 text-rose-400" />
                <p className="mb-2 text-sm font-medium text-foreground">Something went wrong</p>
                <p className="mb-4 text-sm text-slate-500">{(leaveError as Error).message}</p>
                <button onClick={() => refetchLeaves()} className="text-sm font-medium text-slate-600 hover:text-foreground underline">Retry</button>
              </div>
            ) : leaveList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Inbox className="mb-3 h-10 w-10 text-slate-300" />
                <p className="text-sm font-medium text-foreground">No leave requests found</p>
              </div>
            ) : (
              <DataTable
                columns={leaveColumns}
                data={leaveList}
                keyExtractor={(l: any) => l.id}
              />
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/*  MODALS                                                    */}
      {/* ═══════════════════════════════════════════════════════════ */}

      {/* ── Staff Details Modal ── */}
      <Modal
        isOpen={viewStaffId !== null}
        onClose={() => setViewStaffId(null)}
        title="Staff Details"
        size="xl"
        footer={
          <button
            onClick={() => setViewStaffId(null)}
            className="h-10 px-5 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Close
          </button>
        }
      >
        {viewStaff ? (
          <div className="space-y-4">
            {/* Header Profile */}
            <div className="flex items-center gap-4">
              <StaffAvatar name={viewStaff.name} size="lg" />
              <div className="min-w-0">
                <h3 className="truncate text-lg font-semibold text-foreground">{viewStaff.name}</h3>
                <p className="truncate text-sm text-slate-500">{viewStaff.email}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <RoleBadge slug={viewStaff.role?.slug ?? ''} />
                  <ActiveStatus active={viewStaff.is_active} />
                </div>
              </div>
            </div>

            {/* Profile Card */}
            <div className="rounded-xl border border-slate-200/80 bg-white p-4">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-[#1A2238]">
                  <UserRound className="h-4 w-4" />
                </div>
                <h4 className="text-sm font-semibold text-foreground">Profile</h4>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-100 p-3">
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-400">
                    <UserRound className="h-3.5 w-3.5" /> Full Name
                  </p>
                  <p className="text-sm font-medium text-foreground">{viewStaff.name}</p>
                </div>
                <div className="rounded-lg border border-slate-100 p-3">
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-400">
                    <Mail className="h-3.5 w-3.5" /> Email
                  </p>
                  <a href={`mailto:${viewStaff.email}`} className="break-all text-sm font-medium text-[#1A2238] hover:underline">
                    {viewStaff.email}
                  </a>
                </div>
                <div className="rounded-lg border border-slate-100 p-3">
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-400">
                    <Phone className="h-3.5 w-3.5" /> Phone
                  </p>
                  <p className="text-sm font-medium text-foreground">{viewStaff.phone || 'Not provided'}</p>
                </div>
                <div className="rounded-lg border border-slate-100 p-3">
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-400">
                    <Calendar className="h-3.5 w-3.5" /> Member Since
                  </p>
                  <p className="text-sm font-medium text-foreground">{formatDate(viewStaff.created_at)}</p>
                </div>
              </div>
            </div>

            {/* Role & Access Card */}
            <div className="rounded-xl border border-slate-200/80 bg-white p-4">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-[#1A2238]">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <h4 className="text-sm font-semibold text-foreground">Role & Access</h4>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-100 p-3">
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-400">
                    <ShieldCheck className="h-3.5 w-3.5" /> Role
                  </p>
                  <RoleBadge slug={viewStaff.role?.slug ?? ''} />
                </div>
                <div className="rounded-lg border border-slate-100 p-3">
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-400">
                    <Building2 className="h-3.5 w-3.5" /> Status
                  </p>
                  <ActiveStatus active={viewStaff.is_active} />
                </div>
              </div>
            </div>

            {/* Security Card */}
            <div className="rounded-xl border border-slate-200/80 bg-white p-4">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-[#1A2238]">
                  <ShieldAlert className="h-4 w-4" />
                </div>
                <h4 className="text-sm font-semibold text-foreground">Security</h4>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-100 p-3">
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-400">
                    <Clock className="h-3.5 w-3.5" /> Last Login
                  </p>
                  <p className="text-sm font-medium text-foreground">
                    {viewStaff.last_login_at ? formatDateDisplay(viewStaff.last_login_at) : 'No active sessions'}
                  </p>
                  {viewStaff.last_login_ip && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      IP: <span className="font-mono">{viewStaff.last_login_ip}</span>
                    </p>
                  )}
                </div>
                <div className="rounded-lg border border-slate-100 p-3">
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-400">
                    <Globe className="h-3.5 w-3.5" /> Device
                  </p>
                  <p className="text-sm font-medium text-foreground truncate" title={viewStaff.last_login_user_agent ?? ''}>
                    {viewStaff.last_login_user_agent
                      ? viewStaff.last_login_user_agent.includes('Chrome') ? 'Chrome'
                        : viewStaff.last_login_user_agent.includes('Firefox') ? 'Firefox'
                        : viewStaff.last_login_user_agent.includes('Safari') ? 'Safari'
                        : viewStaff.last_login_user_agent.includes('Edge') ? 'Edge'
                        : 'Other browser'
                      : 'No active sessions'}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  onClick={() => {
                    setRevokeSessionsUserId(viewStaff.id)
                    setShowRevokeSessionsConfirm(true)
                  }}
                  className="h-9 px-4 rounded-lg border border-rose-200 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors inline-flex items-center gap-1.5"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Revoke All Sessions
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center py-8 text-center">
            <AlertCircle className="mb-2 h-8 w-8 text-slate-400" />
            <p className="text-sm text-slate-500">Could not load staff details.</p>
          </div>
        )}
      </Modal>

      {/* ── Add Staff Modal ── */}
      <Modal
        isOpen={showAddStaff}
        onClose={closeAddStaff}
        title="Add Staff"
        size="lg"
        footer={
          <div className="flex gap-3">
            <button
              onClick={closeAddStaff}
              disabled={createStaff.isPending}
              className="h-10 px-5 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleAddStaff}
              disabled={createStaff.isPending}
              className="h-10 px-5 rounded-lg bg-[#1A2238] text-white text-sm font-semibold inline-flex items-center gap-2 hover:bg-[#1A2238]/90 transition-colors disabled:opacity-50 shadow-sm"
            >
              {createStaff.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Account
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-[#1A2238]">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground">Add Staff</h4>
              <p className="text-xs text-slate-500">Create a new staff account and assign a role.</p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-white p-4">
            <div className="mb-3 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-[#1A2238]">
                <UserRound className="h-4 w-4" />
              </div>
              <h4 className="text-sm font-semibold text-foreground">Account Details</h4>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="add-name" className="text-sm font-medium text-foreground">Name</label>
                <input
                  id="add-name"
                  type="text"
                  placeholder="Full name"
                  value={addForm.name}
                  onChange={(e) => setAddForm((p) => ({ ...p, name: e.target.value }))}
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-foreground placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50 transition-colors"
                />
                {addFormErrors.name && <p className="text-xs text-rose-500">{addFormErrors.name}</p>}
              </div>
              <div className="space-y-1.5">
                <label htmlFor="add-email" className="text-sm font-medium text-foreground">Email</label>
                <input
                  id="add-email"
                  type="email"
                  placeholder="name@hotel.com"
                  value={addForm.email}
                  onChange={(e) => setAddForm((p) => ({ ...p, email: e.target.value }))}
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-foreground placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50 transition-colors"
                />
                {addFormErrors.email && <p className="text-xs text-rose-500">{addFormErrors.email}</p>}
              </div>
              <div className="space-y-1.5">
                <label htmlFor="add-role" className="text-sm font-medium text-foreground">Role</label>
                <div className="relative">
                  <select
                    id="add-role"
                    value={addForm.role_id}
                    onChange={(e) => setAddForm((p) => ({ ...p, role_id: e.target.value }))}
                    className="h-11 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 pr-10 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50 transition-colors"
                  >
                    <option value="">Select role</option>
                    {roles.filter((r) => assignableRoleIds.includes(r.id)).map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
                {addFormErrors.role_id && <p className="text-xs text-rose-500">{addFormErrors.role_id}</p>}
              </div>
              <div className="space-y-1.5">
                <label htmlFor="add-phone" className="text-sm font-medium text-foreground">Phone</label>
                <input
                  id="add-phone"
                  type="text"
                  placeholder="0917 123 4567 (optional)"
                  value={addForm.phone}
                  onChange={(e) => setAddForm((p) => ({ ...p, phone: stripPhoneInput(e.target.value) }))}
                  maxLength={15}
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-foreground placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50 transition-colors"
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="relative inline-flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={addForm.is_active}
                  onChange={(e) => setAddForm((p) => ({ ...p, is_active: e.target.checked }))}
                />
                <div className="h-6 w-11 rounded-full bg-slate-200 transition-colors peer-checked:bg-emerald-500 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-all peer-checked:after:translate-x-full" />
                <span className="text-sm font-medium text-foreground">Active</span>
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-white p-4">
            <div className="mb-3 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-[#1A2238]">
                <Lock className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground">Security</h4>
                <p className="text-xs text-slate-500">Set the initial password for this account.</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="add-password" className="text-sm font-medium text-foreground">Password</label>
              <input
                id="add-password"
                type="password"
                placeholder="Minimum 8 characters"
                value={addForm.password}
                onChange={(e) => setAddForm((p) => ({ ...p, password: e.target.value }))}
                className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-foreground placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50 transition-colors"
              />
              {addFormErrors.password && <p className="text-xs text-rose-500">{addFormErrors.password}</p>}
            </div>
          </div>
        </div>
      </Modal>

      {/* ── Edit Staff Modal ── */}
      <Modal
        isOpen={editStaff !== null}
        onClose={closeEditModal}
        title="Edit Staff"
        size="lg"
        footer={
          <div className="flex gap-3">
            <button
              onClick={closeEditModal}
              className="h-10 px-5 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleEditSubmit}
              className="h-10 px-5 rounded-lg bg-[#1A2238] text-white text-sm font-semibold inline-flex items-center gap-2 hover:bg-[#1A2238]/90 transition-colors shadow-sm"
            >
              <Save className="h-4 w-4" />
              Save Changes
            </button>
          </div>
        }
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-[#1A2238]">
              <UserCog className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground">Edit Staff</h4>
              <p className="text-xs text-slate-500">Update the staff account details.</p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-white p-4">
            <div className="mb-3 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-[#1A2238]">
                <UserRound className="h-4 w-4" />
              </div>
              <h4 className="text-sm font-semibold text-foreground">Account Details</h4>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="edit-name" className="text-sm font-medium text-foreground">Name</label>
                <input
                  id="edit-name"
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-foreground placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50 transition-colors"
                />
                {editFormErrors.name && <p className="text-xs text-rose-500">{editFormErrors.name}</p>}
              </div>
              <div className="space-y-1.5">
                <label htmlFor="edit-email" className="text-sm font-medium text-foreground">Email</label>
                <input
                  id="edit-email"
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-foreground placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50 transition-colors"
                />
                {editFormErrors.email && <p className="text-xs text-rose-500">{editFormErrors.email}</p>}
              </div>
              <div className="space-y-1.5">
                <label htmlFor="edit-phone" className="text-sm font-medium text-foreground">Phone</label>
                <input
                  id="edit-phone"
                  type="text"
                  placeholder="0917 123 4567 (optional)"
                  value={editForm.phone}
                  onChange={(e) => setEditForm((p) => ({ ...p, phone: stripPhoneInput(e.target.value) }))}
                  maxLength={15}
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-foreground placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50 transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="edit-role" className="text-sm font-medium text-foreground">Role</label>
                <div className="relative">
                  <select
                    id="edit-role"
                    value={editForm.role_id}
                    onChange={(e) => setEditForm((p) => ({ ...p, role_id: e.target.value }))}
                    className="h-11 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 pr-10 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50 transition-colors"
                  >
                    <option value="">Select role</option>
                    {roles.filter((r) => assignableRoleIds.includes(r.id)).map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>
            <div className="mt-4">
              <label className="relative inline-flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={editForm.is_active}
                  onChange={(e) => setEditForm((p) => ({ ...p, is_active: e.target.checked }))}
                />
                <div className="h-6 w-11 rounded-full bg-slate-200 transition-colors peer-checked:bg-emerald-500 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-all peer-checked:after:translate-x-full" />
                <span className="text-sm font-medium text-foreground">Active</span>
              </label>
            </div>
          </div>

          {canResetStaffPassword && (
            <div className="rounded-xl border border-slate-200/80 bg-white p-4">
              <div className="mb-3 flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-[#1A2238]">
                  <Lock className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground">Reset Password</h4>
                  <p className="text-xs text-slate-500">Leave blank to keep the current password.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="edit-new-password" className="text-sm font-medium text-foreground">New Password</label>
                  <input
                    id="edit-new-password"
                    type="password"
                    placeholder="Enter new password"
                    value={editForm.password}
                    onChange={(e) => setEditForm((p) => ({ ...p, password: e.target.value }))}
                    className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-foreground placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50 transition-colors"
                  />
                  {editFormErrors.password && <p className="text-xs text-rose-500">{editFormErrors.password}</p>}
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="edit-confirm-password" className="text-sm font-medium text-foreground">Confirm Password</label>
                  <input
                    id="edit-confirm-password"
                    type="password"
                    placeholder="Confirm new password"
                    value={editForm.password_confirmation}
                    onChange={(e) => setEditForm((p) => ({ ...p, password_confirmation: e.target.value }))}
                    className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-foreground placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50 transition-colors"
                  />
                  {editFormErrors.password_confirmation && <p className="text-xs text-rose-500">{editFormErrors.password_confirmation}</p>}
                </div>
              </div>
            </div>
          )}
        </form>
      </Modal>

      {/* ── Schedule Modal ── */}
      <Modal
        isOpen={showScheduleModal}
        onClose={closeScheduleModal}
        title={editingSchedule ? 'Edit Schedule' : 'Add Schedule'}
        size="lg"
        footer={
          <div className="flex gap-3">
            <button
              onClick={closeScheduleModal}
              className="h-10 px-5 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleScheduleSubmit}
              className="h-10 px-5 rounded-lg bg-[#1A2238] text-white text-sm font-semibold inline-flex items-center gap-2 hover:bg-[#1A2238]/90 transition-colors shadow-sm"
            >
              <Save className="h-4 w-4" />
              Save
            </button>
          </div>
        }
      >
        <form onSubmit={handleScheduleSubmit} className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-[#1A2238]">
              <CalendarPlus className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground">
                {editingSchedule ? 'Edit Schedule' : 'Add Schedule'}
              </h4>
              <p className="text-xs text-slate-500">
                {editingSchedule ? 'Update the shift details for this staff member.' : 'Assign a shift to a staff member.'}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-white p-4">
            <div className="mb-3 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-[#1A2238]">
                <Calendar className="h-4 w-4" />
              </div>
              <h4 className="text-sm font-semibold text-foreground">Shift Details</h4>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="schedule-staff" className="text-sm font-medium text-foreground">Staff</label>
              <div className="relative">
                <select
                  id="schedule-staff"
                  value={scheduleForm.staff_id}
                  onChange={(e) => setScheduleForm((p) => ({ ...p, staff_id: e.target.value }))}
                  className="h-11 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 pr-10 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50 transition-colors"
                >
                  <option value="">Select staff</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              </div>
              {scheduleFormErrors.staff_id && <p className="text-xs text-rose-500">{scheduleFormErrors.staff_id}</p>}
            </div>
            <div className="mt-4">
              <DatePicker
                label="Date"
                value={scheduleForm.date}
                onChange={(v) => setScheduleForm((p) => ({ ...p, date: v }))}
                error={scheduleFormErrors.date}
              />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="schedule-start-time" className="text-sm font-medium text-foreground">Start Time</label>
                <input
                  id="schedule-start-time"
                  type="time"
                  value={scheduleForm.start_time}
                  onChange={(e) => setScheduleForm((p) => ({ ...p, start_time: e.target.value }))}
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50 transition-colors"
                />
                {scheduleFormErrors.start_time && <p className="text-xs text-rose-500">{scheduleFormErrors.start_time}</p>}
              </div>
              <div className="space-y-1.5">
                <label htmlFor="schedule-end-time" className="text-sm font-medium text-foreground">End Time</label>
                <input
                  id="schedule-end-time"
                  type="time"
                  value={scheduleForm.end_time}
                  onChange={(e) => setScheduleForm((p) => ({ ...p, end_time: e.target.value }))}
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50 transition-colors"
                />
                {scheduleFormErrors.end_time && <p className="text-xs text-rose-500">{scheduleFormErrors.end_time}</p>}
              </div>
            </div>
            <div className="mt-4 space-y-1.5">
              <label htmlFor="schedule-notes" className="text-sm font-medium text-foreground">Notes</label>
              <textarea
                id="schedule-notes"
                className="flex min-h-[80px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-foreground placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50 transition-colors resize-none"
                placeholder="Notes..."
                value={scheduleForm.notes}
                onChange={(e) => setScheduleForm((p) => ({ ...p, notes: e.target.value }))}
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* ── Request Leave Modal ── */}
      <Modal
        isOpen={showAddLeave}
        onClose={closeLeaveModal}
        title="Request Leave"
        size="lg"
        footer={
          <div className="flex gap-3">
            <button
              onClick={closeLeaveModal}
              className="h-10 px-5 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAddLeave}
              className="h-10 px-5 rounded-lg bg-[#1A2238] text-white text-sm font-semibold inline-flex items-center gap-2 hover:bg-[#1A2238]/90 transition-colors shadow-sm"
            >
              <Save className="h-4 w-4" />
              Save
            </button>
          </div>
        }
      >
        <form onSubmit={handleAddLeave} className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-[#1A2238]">
              <CalendarOff className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground">Request Leave</h4>
              <p className="text-xs text-slate-500">Submit a leave request for a staff member.</p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-white p-4">
            <div className="mb-3 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-[#1A2238]">
                <Calendar className="h-4 w-4" />
              </div>
              <h4 className="text-sm font-semibold text-foreground">Leave Details</h4>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="leave-staff" className="text-sm font-medium text-foreground">Staff</label>
                <div className="relative">
                  <select
                    id="leave-staff"
                    value={leaveForm.user_id}
                    onChange={(e) => setLeaveForm((p) => ({ ...p, user_id: e.target.value }))}
                    className="h-11 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 pr-10 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50 transition-colors"
                  >
                    <option value="">Select staff</option>
                    {staff.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
                {leaveFormErrors.user_id && <p className="text-xs text-rose-500">{leaveFormErrors.user_id}</p>}
              </div>
              <div className="space-y-1.5">
                <label htmlFor="leave-type" className="text-sm font-medium text-foreground">Leave Type</label>
                <div className="relative">
                  <select
                    id="leave-type"
                    value={leaveForm.type}
                    onChange={(e) => setLeaveForm((p) => ({ ...p, type: e.target.value }))}
                    className="h-11 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 pr-10 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50 transition-colors"
                  >
                    <option value="annual">Annual</option>
                    <option value="sick">Sick</option>
                    <option value="personal">Personal</option>
                    <option value="other">Other</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
                {leaveFormErrors.type && <p className="text-xs text-rose-500">{leaveFormErrors.type}</p>}
              </div>
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
            <div className="mt-4 space-y-1.5">
              <label htmlFor="leave-reason" className="text-sm font-medium text-foreground">Reason</label>
              <textarea
                id="leave-reason"
                className="flex min-h-[80px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-foreground placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50 transition-colors resize-none"
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

      <ConfirmDialog
        isOpen={showRevokeSessionsConfirm}
        onClose={() => { setShowRevokeSessionsConfirm(false); setRevokeSessionsUserId(null) }}
        onConfirm={() => {
          if (revokeSessionsUserId) {
            revokeStaffSessions.mutate(revokeSessionsUserId, {
              onSuccess: () => {
                addToast('All sessions revoked for this staff member.', 'success')
                setShowRevokeSessionsConfirm(false)
                setRevokeSessionsUserId(null)
              },
              onError: () => addToast('Failed to revoke sessions.', 'error'),
            })
          }
        }}
        title="Revoke All Sessions"
        message="This will immediately log out this staff member from all active devices and sessions. They will need to log in again."
        confirmLabel="Revoke All Sessions"
        variant="danger"
      />
    </div>
  )
}

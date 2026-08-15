import { useState, useMemo } from 'react'
import {
  useHousekeepingTasks, useCreateHousekeepingTask, useUpdateHousekeepingStatus,
  useAssignHousekeepingTask, useUpdateHousekeepingTask, useDeleteHousekeepingTask,
  useStaffAssignable, useRooms,
} from '@/hooks/useApi'
import type { HousekeepingTask } from '@/types'
import { formatDateDisplay } from '@/lib/format'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { RowActions, RowActionButton } from '@/components/shared/RowActions'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { DatePicker } from '@/components/ui/date-picker'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/toast'
import { useAuthStore } from '@/stores/authStore'
import { isAdminRole } from '@/lib/permissions'
import { Plus, List, LayoutGrid, Search, SprayCan, RotateCcw, AlertCircle, Clock, User, Edit, Trash2, Loader2, BedDouble, UserRound, MessageSquareText } from 'lucide-react'

const TASK_TYPES = [
  { value: 'Daily Cleaning', label: 'Daily Cleaning' },
  { value: 'Deep Clean', label: 'Deep Clean' },
  { value: 'Turn Down', label: 'Turn Down' },
  { value: 'Linen Change', label: 'Linen Change' },
  { value: 'Restock', label: 'Restock' },
  { value: 'Check-out Cleaning', label: 'Check-out Cleaning' },
]

const PRIORITY_OPTIONS = [
  { value: '', label: 'All Priorities' },
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'inspected', label: 'Inspected' },
]

const STATUS_BOARD_COLUMNS = [
  { key: 'pending', label: 'Pending', color: 'border-t-yellow-500' },
  { key: 'in_progress', label: 'In Progress', color: 'border-t-blue-500' },
  { key: 'completed', label: 'Completed', color: 'border-t-green-500' },
]

function getTimeSince(dateStr: string): string {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function HousekeepingPage() {
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [dateFilter, setDateFilter] = useState('')

  const role = useAuthStore((s) => s.user?.role ?? '')
  const isAdmin = isAdminRole(role)

  const [showNewTaskModal, setShowNewTaskModal] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [selectedTask, setSelectedTask] = useState<HousekeepingTask | null>(null)
  const [editTask, setEditTask] = useState<HousekeepingTask | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
  const { addToast } = useToast()

  const [taskForm, setTaskForm] = useState({
    room_id: '',
    task_type: '',
    priority: 'normal',
    scheduled_date: '',
    assigned_to: '',
    notes: '',
  })

  const [assignStaffId, setAssignStaffId] = useState('')

  const params: Record<string, string | number | undefined> = {
    search: search || undefined,
    status: statusFilter || undefined,
    priority: priorityFilter || undefined,
    date: dateFilter || undefined,
  }

  const { data: tasksData, isLoading, error, refetch } = useHousekeepingTasks(params)
  const { data: staffData } = useStaffAssignable('housekeeping')
  const { data: roomsData } = useRooms({ all: 'true' })

  const createTask = useCreateHousekeepingTask()
  const updateStatus = useUpdateHousekeepingStatus()
  const assignTask = useAssignHousekeepingTask()
  const updateTask = useUpdateHousekeepingTask()
  const deleteTask = useDeleteHousekeepingTask()

  const tasks = tasksData?.data ?? []
  const staff = staffData ?? []
  const rooms = roomsData?.data ?? []
  const dirtyRooms = rooms.filter(r => r.cleaning_status !== 'clean' || r.status === 'dirty')

  const isSaving = createTask.isPending || updateTask.isPending

  const selectedRoom = dirtyRooms.find(r => r.id === Number(taskForm.room_id)) ?? null
  const selectedTaskLabel = TASK_TYPES.find(t => t.value === taskForm.task_type)?.label ?? ''
  const selectedPriorityLabel = PRIORITY_OPTIONS.find(o => o.value === taskForm.priority)?.label ?? ''
  const selectedStaffName = staff.find(s => s.id === Number(taskForm.assigned_to))?.name ?? ''

  const tasksByStatus = useMemo(() => {
    const map: Record<string, HousekeepingTask[]> = { pending: [], in_progress: [], completed: [] }
    tasks.forEach(t => {
      if (map[t.status]) map[t.status].push(t)
      else if (t.status === 'inspected') map.completed.push(t)
    })
    return map
  }, [tasks])

  function openNewTaskModal() {
    setTaskForm({ room_id: '', task_type: '', priority: 'normal', scheduled_date: '', assigned_to: '', notes: '' })
    setShowNewTaskModal(true)
  }

  function openAssignModal(task: HousekeepingTask) {
    setSelectedTask(task)
    setAssignStaffId(task.assigned_to?.id?.toString() ?? '')
    setShowAssignModal(true)
  }

  function handleCreateTask() {
    const payload: Record<string, unknown> = {
      task_type: taskForm.task_type,
      priority: taskForm.priority,
      scheduled_date: taskForm.scheduled_date,
    }
    if (taskForm.room_id) payload.room_id = Number(taskForm.room_id)
    if (taskForm.assigned_to) payload.assigned_to = Number(taskForm.assigned_to)
    if (taskForm.notes) payload.notes = taskForm.notes
    createTask.mutate(payload, {
      onSuccess: () => setShowNewTaskModal(false),
      onError: () => addToast('Failed to create task', 'error'),
    })
  }

  function handleAssignStaff() {
    if (!selectedTask || !assignStaffId) return
    assignTask.mutate(
      { id: selectedTask.id, assigned_to: Number(assignStaffId) },
      { onSuccess: () => setShowAssignModal(false) },
    )
  }

  function handleQuickAction(taskId: number, status: string) {
    updateStatus.mutate({ id: taskId, status }, {
      onError: () => addToast('Failed to update task', 'error'),
    })
  }

  function openEditModal(task: HousekeepingTask) {
    setEditTask(task)
    setTaskForm({
      room_id: task.room ? String(task.room.id) : '',
      task_type: task.task_type,
      priority: task.priority,
      scheduled_date: task.scheduled_date,
      assigned_to: task.assigned_to?.id?.toString() ?? '',
      notes: task.notes ?? '',
    })
    setShowNewTaskModal(true)
  }

  function handleUpdateTask() {
    if (!editTask) return
    const payload: Record<string, unknown> = {
      task_type: taskForm.task_type,
      priority: taskForm.priority,
      scheduled_date: taskForm.scheduled_date,
    }
    if (taskForm.assigned_to) payload.assigned_to = Number(taskForm.assigned_to)
    if (taskForm.notes) payload.notes = taskForm.notes
    updateTask.mutate(
      { id: editTask.id, data: payload },
      {
        onSuccess: () => {
          addToast('Task updated successfully', 'success')
          setShowNewTaskModal(false)
          setEditTask(null)
        },
        onError: () => addToast('Failed to update task', 'error'),
      },
    )
  }

  function handleDeleteTask() {
    if (!deleteConfirmId) return
    deleteTask.mutate(deleteConfirmId, {
      onSuccess: () => {
        addToast('Task deleted successfully', 'success')
        setDeleteConfirmId(null)
      },
      onError: () => addToast('Failed to delete task', 'error'),
    })
  }

  const boardColumns: Column<HousekeepingTask>[] = [
    {
      key: 'room_number',
      label: 'Room #',
      render: (t) => <span className="font-semibold">{t.room ? t.room.room_number : '—'}</span>,
    },
    {
      key: 'task_type',
      label: 'Task Type',
      render: (t) => <Badge variant="default">{t.task_type}</Badge>,
    },
    {
      key: 'priority',
      label: 'Priority',
      render: (t) => <StatusBadge status={t.priority} />,
    },
    {
      key: 'assigned_to',
      label: 'Assigned To',
      render: (t) => (
        <span className="text-muted">{t.assigned_to ? t.assigned_to.name : '—'}</span>
      ),
    },
    {
      key: 'scheduled_date',
      label: 'Scheduled Date',
      render: (t) => {
        const d = t.scheduled_date ? formatDateDisplay(t.scheduled_date) : '—'
        return <span>{d}</span>
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (t) => <StatusBadge status={t.status} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (t) => (
        <RowActions>
          {t.status === 'pending' && (
            <>
              <RowActionButton
                tone="info"
                title="Assign"
                label="Assign"
                icon={<User className="h-4 w-4" />}
                onClick={() => openAssignModal(t)}
              />
              <RowActionButton
                tone="success"
                title="Start"
                label="Start"
                onClick={() => handleQuickAction(t.id, 'in_progress')}
              />
            </>
          )}
          {t.status === 'in_progress' && (
            <RowActionButton
              tone="success"
              title="Complete"
              label="Complete"
              onClick={() => handleQuickAction(t.id, 'completed')}
            />
          )}
          {t.status === 'completed' && (
            <RowActionButton
              tone="info"
              title="Inspect"
              label="Inspect"
              onClick={() => handleQuickAction(t.id, 'inspected')}
            />
          )}
          <RowActionButton
            tone="neutral"
            title="Edit"
            icon={<Edit className="h-4 w-4" />}
            onClick={() => openEditModal(t)}
          />
          {isAdmin && t.status === 'pending' && (
            <RowActionButton
              tone="danger"
              title="Delete"
              icon={<Trash2 className="h-4 w-4" />}
              onClick={() => setDeleteConfirmId(t.id)}
            />
          )}
        </RowActions>
      ),
    },
  ]

  function renderBoard() {
    if (isLoading) {
      return (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, ci) => (
            <div key={ci} className="space-y-3">
              <Skeleton className="h-6 w-24" />
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <Skeleton className="mb-2 h-5 w-16" />
                    <Skeleton className="mb-1 h-4 w-24" />
                    <Skeleton className="mb-1 h-4 w-20" />
                    <Skeleton className="h-4 w-28" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ))}
        </div>
      )
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border py-12">
          <AlertCircle className="mb-3 h-10 w-10 text-danger" />
          <p className="mb-2 text-sm font-medium text-foreground">Something went wrong</p>
          <p className="mb-4 text-sm text-muted">{(error as Error).message}</p>
          <Button variant="outline" onClick={() => refetch()}>
            <RotateCcw className="h-4 w-4" /> Retry
          </Button>
        </div>
      )
    }

    if (tasks.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border py-12">
          <SprayCan className="mb-3 h-10 w-10 text-muted/50" />
          <p className="mb-1 text-sm font-medium text-foreground">No tasks found for this date</p>
          <p className="text-sm text-muted">Try adjusting your search or filters.</p>
        </div>
      )
    }

    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {STATUS_BOARD_COLUMNS.map(col => (
          <div key={col.key}>
            <h3 className={`mb-3 border-t-4 pt-2 text-sm font-semibold text-foreground ${col.color}`}>
              {col.label}
              <span className="ml-2 text-muted">({tasksByStatus[col.key]?.length ?? 0})</span>
            </h3>
            <div className="space-y-3">
              {(tasksByStatus[col.key] ?? []).map(task => (
                <Card key={task.id}>
                  <CardContent className="p-4">
                    <div className="mb-2 flex items-start justify-between">
                      <div>
                        <p className="text-lg font-bold text-foreground">{task.room ? task.room.room_number : 'General Task'}</p>
                        <Badge variant="default" size="sm">{task.task_type}</Badge>
                      </div>
                      <StatusBadge status={task.priority} />
                    </div>
                    {task.assigned_to && (
                      <div className="mb-1 flex items-center gap-1 text-xs text-muted">
                        <User className="h-3 w-3" />
                        {task.assigned_to.name}
                      </div>
                    )}
                    <div className="mb-1 text-xs text-muted">
                      {task.scheduled_date ? formatDateDisplay(task.scheduled_date) : '—'}
                    </div>
                    <div className="mb-3 flex items-center gap-1 text-xs text-muted">
                      <Clock className="h-3 w-3" />
                      {getTimeSince(task.scheduled_date)}
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      {task.status === 'pending' && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => openAssignModal(task)}>
                            <User className="h-3.5 w-3.5" /> Assign
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleQuickAction(task.id, 'in_progress')}>
                            Start
                          </Button>
                        </>
                      )}
                      {task.status === 'in_progress' && (
                        <Button variant="ghost" size="sm" onClick={() => handleQuickAction(task.id, 'completed')}>
                          Complete
                        </Button>
                      )}
                      {task.status === 'completed' && (
                        <Button variant="ghost" size="sm" onClick={() => handleQuickAction(task.id, 'inspected')}>
                          Inspect
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" square onClick={() => openEditModal(task)}>
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      {isAdmin && task.status === 'pending' && (
                        <Button variant="ghost" size="sm" square onClick={() => setDeleteConfirmId(task.id)} className="text-danger hover:text-danger">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Housekeeping"
        description="Manage housekeeping tasks and room cleaning schedules."
        actions={
          <div className="flex items-center gap-2">
            <div className="flex overflow-hidden rounded-lg border border-border">
              <Button
                variant={viewMode === 'board' ? 'default' : 'ghost'}
                size="sm"
                square
                onClick={() => setViewMode('board')}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                square
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
            <Button variant="gold" onClick={openNewTaskModal}>
              <Plus className="h-4 w-4" />
              New Task
            </Button>
          </div>
        }
      />

      <Card>
        <CardContent className="pt-6">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative max-w-[200px] flex-1">
              <Input
                placeholder="Search room..."
                icon={<Search className="h-4 w-4" />}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-[140px]">
              {STATUS_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
            <Select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="w-[130px]">
              {PRIORITY_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
            <div className="w-44">
              <DatePicker value={dateFilter} onChange={(v) => setDateFilter(v)} placeholder="Filter by date" clearable />
            </div>
          </div>

          {viewMode === 'board' ? renderBoard() : (
            <DataTable
              columns={boardColumns}
              data={tasks}
              loading={isLoading}
              error={error ? (error as Error).message : null}
              onRetry={() => refetch()}
              keyExtractor={(t) => t.id}
            />
          )}
        </CardContent>
      </Card>

      <Modal
        isOpen={showNewTaskModal}
        onClose={() => { setShowNewTaskModal(false); setEditTask(null) }}
        title={editTask ? 'Edit Housekeeping Task' : 'New Housekeeping Task'}
        size="lg"
        footer={
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => { setShowNewTaskModal(false); setEditTask(null) }} disabled={isSaving}>
              Cancel
            </Button>
            <Button variant="gold" onClick={editTask ? handleUpdateTask : handleCreateTask} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editTask ? 'Update Task' : 'Create Task'}
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold/15 text-gold-dark">
              <SprayCan className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground">
                {editTask ? 'Update Housekeeping Task' : 'Create a New Task'}
              </h4>
              <p className="text-xs text-muted">
                {editTask ? 'Adjust the details for this cleaning task.' : 'Schedule cleaning for a room or a general task.'}
              </p>
            </div>
          </div>

          {(selectedRoom || selectedTaskLabel) && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gold/20 bg-gold/5 px-3.5 py-2.5">
              {selectedRoom && (
                <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <BedDouble className="h-3.5 w-3.5 text-gold-dark" />
                  Room {selectedRoom.room_number}
                  <span className="text-xs font-normal text-muted">
                    {selectedRoom.room_type?.name ?? ''}
                    {selectedRoom.cleaning_status ? ` · ${selectedRoom.cleaning_status.replace('_', ' ')}` : ''}
                  </span>
                </span>
              )}
              {selectedRoom && selectedTaskLabel && <span className="text-gold-dark">·</span>}
              {selectedTaskLabel && (
                <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-foreground ring-1 ring-gray-200">
                  {selectedTaskLabel}
                </span>
              )}
              {selectedPriorityLabel && (
                <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-foreground ring-1 ring-gray-200 capitalize">
                  {selectedPriorityLabel} priority
                </span>
              )}
              {selectedStaffName && (
                <span className="flex items-center gap-1 text-xs text-muted">
                  <UserRound className="h-3 w-3" />
                  {selectedStaffName}
                </span>
              )}
            </div>
          )}

          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <BedDouble className="h-4 w-4" />
              </div>
              <h4 className="text-sm font-semibold text-foreground">Task Details</h4>
            </div>
            <div className="space-y-4">
              <Select
                label="Room"
                placeholder="Select a room"
                value={taskForm.room_id}
                onChange={(e) => setTaskForm(f => ({ ...f, room_id: e.target.value }))}
              >
                <option value="">No room (general task)</option>
                {dirtyRooms.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.room_number} — {r.room_type?.name ?? ''} ({r.cleaning_status})
                  </option>
                ))}
              </Select>
              <Select
                label="Task Type"
                placeholder="Select task type"
                value={taskForm.task_type}
                onChange={(e) => setTaskForm(f => ({ ...f, task_type: e.target.value }))}
              >
                {TASK_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </Select>
              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Priority"
                  value={taskForm.priority}
                  onChange={(e) => setTaskForm(f => ({ ...f, priority: e.target.value }))}
                >
                  {PRIORITY_OPTIONS.filter(o => o.value).map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>
                <DatePicker
                  label="Scheduled Date"
                  value={taskForm.scheduled_date}
                  onChange={(v) => setTaskForm(f => ({ ...f, scheduled_date: v }))}
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success/10 text-success">
                <UserRound className="h-4 w-4" />
              </div>
              <h4 className="text-sm font-semibold text-foreground">Assignment</h4>
            </div>
            <div className="space-y-4">
              <Select
                label="Assigned To"
                placeholder="Select staff"
                value={taskForm.assigned_to}
                onChange={(e) => setTaskForm(f => ({ ...f, assigned_to: e.target.value }))}
              >
                {staff.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
              <div>
                <label htmlFor="task-notes" className="mb-1 flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <MessageSquareText className="h-3.5 w-3.5 text-muted" />
                  Notes
                </label>
                <textarea
                  id="task-notes"
                  className="flex min-h-[80px] w-full rounded-lg border border-border bg-card px-3 py-2 text-sm ring-offset-card placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary"
                  placeholder="Additional notes..."
                  value={taskForm.notes}
                  onChange={(e) => setTaskForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        title="Assign Staff"
        size="sm"
        footer={
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setShowAssignModal(false)}>
              Cancel
            </Button>
            <Button variant="gold" onClick={handleAssignStaff} disabled={!assignStaffId}>
              Confirm
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Assign staff to {selectedTask?.room ? `Room ${selectedTask?.room.room_number} — ` : ''}{selectedTask?.task_type}
          </p>
          <Select
            label="Staff Member"
            placeholder="Select staff"
            value={assignStaffId}
            onChange={(e) => setAssignStaffId(e.target.value)}
          >
            {staff.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
        </div>
      </Modal>
      <ConfirmDialog
        isOpen={deleteConfirmId !== null}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={handleDeleteTask}
        title="Delete Task"
        message="Are you sure you want to delete this housekeeping task? Only pending tasks can be deleted."
        confirmLabel="Delete"
        isLoading={deleteTask.isPending}
      />
    </div>
  )
}

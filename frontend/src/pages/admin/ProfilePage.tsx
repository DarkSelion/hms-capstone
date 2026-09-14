import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { formatDateDisplay } from '@/lib/format'
import { stripPhoneInput } from '@/lib/phone'
import {
  useTrustedDevices, useRevokeTrustedDevice,
} from '@/hooks/useApi'
import {
  Save, Loader2, UserCircle, Mail, Phone, Shield, Calendar, Key, Clock, Monitor, Globe,
  Smartphone, Trash2, ShieldAlert, ShieldOff, AlertTriangle,
} from 'lucide-react'

interface MeUser {
  id: number
  name: string
  email: string
  phone?: string
  avatar?: string
  role: { name: string; slug: string }
  is_active: boolean
  created_at: string
}

interface AuthEvent {
  action: string
  description: string
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  hotel_manager: 'Hotel Manager',
  receptionist: 'Receptionist',
  housekeeping: 'Housekeeping',
  cashier: 'Cashier',
  staff: 'Staff',
}

function formatDate(dateStr: string) {
  return formatDateDisplay(dateStr)
}

function formatLongDateTime(dateStr: string | null) {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
    })
  } catch { return dateStr }
}

export default function ProfilePage() {
  const { user: authUser, setAuth } = useAuthStore()
  const { addToast } = useToast()
  const queryClient = useQueryClient()

  const { data: meData, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get<MeUser>('/me'),
  })

  const { data: loginHistory } = useQuery({
    queryKey: ['login-history'],
    queryFn: () => api.get<AuthEvent[]>('/auth/login-history'),
  })

  const { data: devices } = useTrustedDevices()
  const revokeDevice = useRevokeTrustedDevice()

  const me = meData

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [showRevokeAll, setShowRevokeAll] = useState(false)

  useEffect(() => {
    if (me) {
      setName(me.name)
      setEmail(me.email)
      setPhone(me.phone ?? '')
    }
  }, [me])

  const updateProfile = useMutation({
    mutationFn: (data: { name: string; email: string; phone?: string }) =>
      api.put<MeUser>('/profile', data),
    onSuccess: (updated) => {
      addToast('Profile updated successfully', 'success')
      if (authUser) {
        setAuth(useAuthStore.getState().token!, {
          ...authUser,
          name: updated.name,
          email: updated.email,
        })
      }
      queryClient.invalidateQueries({ queryKey: ['me'] })
    },
    onError: () => addToast('Failed to update profile', 'error'),
  })

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const updatePassword = useMutation({
    mutationFn: (data: { current_password: string; password: string; password_confirmation: string }) =>
      api.put<{ message: string }>('/password', data),
    onSuccess: () => {
      addToast('Password updated successfully', 'success')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    },
    onError: () => addToast('Failed to update password', 'error'),
  })

  const revokeAllSessions = useMutation({
    mutationFn: () => api.post('/auth/revoke-all-sessions'),
    onSuccess: () => {
      addToast('All sessions revoked. You will need to log in again on other devices.', 'success')
      queryClient.invalidateQueries({ queryKey: ['trusted-devices'] })
      queryClient.invalidateQueries({ queryKey: ['login-history'] })
    },
    onError: () => addToast('Failed to revoke sessions', 'error'),
  })

  function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault()
    updateProfile.mutate({ name, email, phone: phone || undefined })
  }

  function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      addToast('Passwords do not match', 'error')
      return
    }
    updatePassword.mutate({
      current_password: currentPassword,
      password: newPassword,
      password_confirmation: confirmPassword,
    })
  }

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Profile" />
        <div className="space-y-6">
          <Card><CardContent className="pt-6"><div className="h-48 animate-pulse rounded bg-border/50" /></CardContent></Card>
        </div>
      </div>
    )
  }

  const activeDevices = devices?.filter(d => !d.revoked_at) ?? []
  const loginEvents = Array.isArray(loginHistory) ? loginHistory : []

  return (
    <div>
      <PageHeader title="Profile" />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* User Info Card */}
        <Card className="lg:col-span-1 lg:sticky lg:top-10 lg:self-start">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary">
                <UserCircle className="h-12 w-12" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">{me?.name}</h3>
              <span className="mt-1 inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                {ROLE_LABELS[me?.role?.slug ?? ''] ?? me?.role?.name ?? 'User'}
              </span>
              <div className="mt-4 w-full space-y-3 text-left text-sm text-muted">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted" />
                  <span>{me?.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted" />
                  <span>{me?.phone || 'Not set'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-muted" />
                  <span>{me?.role?.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted" />
                  <span>Joined {me?.created_at ? formatDate(me.created_at) : '-'}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Edit Profile + Password + Security */}
        <div className="space-y-6 lg:col-span-2">
          {/* Edit Profile */}
          <Card>
            <CardContent className="pt-6">
              <h4 className="mb-4 text-sm font-semibold text-foreground">Edit Profile</h4>
              <form onSubmit={handleProfileSubmit} className="space-y-4">
                <Input
                  label="Full Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
                <Input
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <Input
                  label="Phone"
                  value={phone}
                  onChange={(e) => setPhone(stripPhoneInput(e.target.value))}
                  placeholder="0917 123 4567 (optional)"
                  maxLength={15}
                />
                <div className="flex justify-end">
                  <Button type="submit" disabled={updateProfile.isPending}>
                    {updateProfile.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save Changes
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Change Password */}
          <Card>
            <CardContent className="pt-6">
              <h4 className="mb-4 text-sm font-semibold text-foreground">Change Password</h4>
              <p className="mb-4 text-xs text-muted">Changing your password will sign you out from all other devices.</p>
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <Input
                  label="Current Password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
                <Input
                  label="New Password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
                <Input
                  label="Confirm New Password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
                <div className="flex justify-end">
                  <Button type="submit" disabled={updatePassword.isPending}>
                    {updatePassword.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Key className="h-4 w-4" />
                    )}
                    Update Password
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Security — Trusted Devices */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-gold" />
                  <h4 className="text-sm font-semibold text-foreground">Trusted Devices</h4>
                  {activeDevices.length > 0 && (
                    <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {activeDevices.length}
                    </span>
                  )}
                </div>
                {activeDevices.length > 0 && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setShowRevokeAll(true)}
                  >
                    <ShieldOff className="mr-1.5 h-3.5 w-3.5" />
                    Revoke All ({activeDevices.length})
                  </Button>
                )}
              </div>

              {activeDevices.length === 0 ? (
                <p className="text-sm text-muted">No trusted devices. You'll be asked to verify on each new login.</p>
              ) : (
                <div className="space-y-3">
                  {activeDevices.map((device) => (
                    <div key={device.id} className="flex items-center gap-3 rounded-xl bg-bg p-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        {device.browser?.includes('Chrome') ? <Globe className="h-4 w-4" /> :
                         device.browser?.includes('Firefox') ? <Smartphone className="h-4 w-4" /> :
                         <Monitor className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{device.device_name}</p>
                        <p className="text-xs text-muted">
                          Last used: {formatLongDateTime(device.last_used_at)}
                          {device.ip_address && <> · IP: <span className="font-mono">{device.ip_address}</span></>}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => revokeDevice.mutate(device.id)}
                        disabled={revokeDevice.isPending}
                        className="text-danger hover:bg-danger/10 shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Revoke All Sessions — Custom Modal */}
          <Modal isOpen={showRevokeAll} onClose={() => setShowRevokeAll(false)} size="md">
            {/* Header */}
            <div className="flex items-start gap-4 mb-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-danger/10 text-danger">
                <ShieldOff className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">Revoke All Sessions</h3>
                <p className="text-sm text-muted mt-0.5">
                  {activeDevices.length} active device{activeDevices.length !== 1 ? 's' : ''} will be signed out
                </p>
              </div>
            </div>

            {/* Warning callout */}
            <div className="flex items-start gap-3 rounded-xl bg-warning/5 border border-warning/20 p-4 mb-6">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-warning/10 text-warning">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div className="text-sm text-foreground">
                <p className="font-medium mb-1">What happens next:</p>
                <ul className="space-y-1 text-muted">
                  <li className="flex items-start gap-1.5">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted" />
                    All other devices will be immediately signed out
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted" />
                    Your current session will remain active
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted" />
                    You'll need to verify your identity on each device again
                  </li>
                </ul>
              </div>
            </div>

            {/* Devices to be revoked */}
            <div className="mb-6">
              <p className="text-xs font-medium uppercase tracking-wider text-muted mb-3">Devices that will be signed out</p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {activeDevices.map((device) => (
                  <div key={device.id} className="flex items-center gap-3 rounded-xl bg-bg p-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-danger/5 text-danger/60">
                      {device.browser?.includes('Chrome') ? <Globe className="h-3.5 w-3.5" /> :
                       device.browser?.includes('Firefox') ? <Smartphone className="h-3.5 w-3.5" /> :
                       <Monitor className="h-3.5 w-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{device.device_name}</p>
                      <p className="text-xs text-muted">
                        {formatLongDateTime(device.last_used_at)}
                        {device.ip_address && <> · <span className="font-mono">{device.ip_address}</span></>}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3">
              <Button variant="outline" onClick={() => setShowRevokeAll(false)} disabled={revokeAllSessions.isPending}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() => { revokeAllSessions.mutate(); setShowRevokeAll(false) }}
                disabled={revokeAllSessions.isPending}
              >
                {revokeAllSessions.isPending ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <ShieldOff className="mr-1.5 h-4 w-4" />
                )}
                Revoke All Sessions
              </Button>
            </div>
          </Modal>

          {/* Login History */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="h-4 w-4 text-gold" />
                <h4 className="text-sm font-semibold text-foreground">Recent Login Activity</h4>
              </div>
              {loginEvents.length === 0 ? (
                <p className="text-sm text-muted">No login history available.</p>
              ) : (
                <div className="space-y-3">
                  {loginEvents.map((event, i) => (
                    <div key={i} className="flex items-start gap-3 rounded-xl bg-bg p-3">
                      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg
                        ${event.action === 'login' ? 'bg-success/10 text-success' : event.action === 'logout' ? 'bg-muted/10 text-muted' : 'bg-warning/10 text-warning'}`}>
                        {event.action === 'login' ? <Globe className="h-4 w-4" /> : event.action === 'logout' ? <Monitor className="h-4 w-4" /> : <Key className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground capitalize">{event.action}</p>
                        {event.ip_address && (
                          <p className="text-xs text-muted mt-0.5">
                            IP: <span className="font-mono text-foreground/70">{event.ip_address}</span>
                          </p>
                        )}
                        {event.user_agent && (
                          <p className="text-xs text-muted truncate mt-0.5" title={event.user_agent}>
                            {event.user_agent}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-muted whitespace-nowrap">
                        {formatDate(event.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

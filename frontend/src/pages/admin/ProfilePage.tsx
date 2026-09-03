import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { formatDateDisplay } from '@/lib/format'
import { stripPhoneInput } from '@/lib/phone'
import {
  Save, Loader2, UserCircle, Mail, Phone, Shield, Calendar, Key,
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

export default function ProfilePage() {
  const { user: authUser, setAuth } = useAuthStore()
  const { addToast } = useToast()
  const queryClient = useQueryClient()

  const { data: meData, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get<MeUser>('/me'),
  })

  const me = meData

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')

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

  return (
    <div>
      <PageHeader title="Profile" />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* User Info Card */}
        <Card className="lg:col-span-1">
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

        {/* Edit Profile + Password */}
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
        </div>
      </div>
    </div>
  )
}

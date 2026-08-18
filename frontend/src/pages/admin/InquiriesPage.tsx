import { useState, useMemo } from 'react'
import { useContactMessages, useDeleteContactMessage } from '@/hooks/useApi'
import type { ContactMessage } from '@/types'
import { formatDateDisplay } from '@/lib/format'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { RowActions, RowActionButton } from '@/components/shared/RowActions'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import {
  Eye, Trash2, AlertCircle, Mail, UserRound, Reply, MessageSquareText, Clock, Server,
} from 'lucide-react'

function formatLongDate(dateStr: string) {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return '-'
  const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  return `${formatDateDisplay(dateStr, 'long')} · ${time}`
}

function gmailReplyUrl(m: ContactMessage): string {
  const to = encodeURIComponent(m.email)
  const subject = encodeURIComponent(`Re: ${m.subject}`)
  const body = encodeURIComponent(`Hi ${m.name},\n\n--- Original message ---\n\n${m.message}`)
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${to}&su=${subject}&body=${body}`
}

export default function InquiriesPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<ContactMessage | null>(null)
  const [showDetail, setShowDetail] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)

  const queryParams = useMemo(() => {
    const params: Record<string, string | number | undefined> = { page }
    if (search) params.search = search
    return params
  }, [page, search])

  const { data: messagesData, isLoading, error, refetch } = useContactMessages(queryParams)
  const deleteMessage = useDeleteContactMessage()

  const messages = messagesData?.data ?? []
  const totalPages = messagesData?.last_page ?? 1

  function openDetail(message: ContactMessage) {
    setSelected(message)
    setShowDetail(true)
  }

  function handleDelete() {
    if (!deleteConfirmId) return
    deleteMessage.mutate(deleteConfirmId, {
      onSuccess: () => {
        setDeleteConfirmId(null)
        setSelected(null)
        setShowDetail(false)
      },
    })
  }

  const columns: Column<ContactMessage>[] = [
    {
      key: 'name',
      label: 'Name',
      render: (r) => <span className="font-medium text-foreground">{r.name}</span>,
    },
    {
      key: 'email',
      label: 'Email',
      render: (r) => <span className="text-muted">{r.email}</span>,
    },
    {
      key: 'subject',
      label: 'Subject',
      render: (r) => <span className="text-foreground">{r.subject}</span>,
    },
    {
      key: 'message',
      label: 'Message',
      render: (r) => (
        <span className="block max-w-[280px] truncate text-muted">{r.message}</span>
      ),
    },
    {
      key: 'created_at',
      label: 'Received',
      render: (r) => <span className="text-muted">{formatDateDisplay(r.created_at)}</span>,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (r) => (
        <RowActions>
          <RowActionButton
            tone="neutral"
            title="View"
            icon={<Eye className="h-4 w-4" />}
            onClick={() => openDetail(r)}
          />
          <RowActionButton
            tone="danger"
            title="Delete"
            icon={<Trash2 className="h-4 w-4" />}
            onClick={() => setDeleteConfirmId(r.id)}
          />
        </RowActions>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Inquiries"
        description="Messages submitted through the portal contact form."
      />

      <Card>
        <CardContent className="pt-6">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative max-w-sm flex-1">
              <Input
                placeholder="Search by name, email, subject..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              />
            </div>
          </div>

          <DataTable
            columns={columns}
            data={messages}
            loading={isLoading}
            error={error ? 'Failed to load inquiries' : null}
            pagination={messagesData ? {
              currentPage: page,
              lastPage: totalPages,
              total: messagesData.total,
              from: (messagesData.current_page - 1) * messagesData.per_page + 1,
              to: Math.min(messagesData.current_page * messagesData.per_page, messagesData.total),
              onPageChange: setPage,
            } : undefined}
            onRetry={() => refetch()}
            keyExtractor={(r) => r.id}
          />
        </CardContent>
      </Card>

      <Modal
        isOpen={showDetail}
        onClose={() => setShowDetail(false)}
        title="Message Details"
        size="xl"
        footer={
          <>
            <a
              href={selected ? gmailReplyUrl(selected) : '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-gold px-4 py-2 text-sm font-medium text-white hover:bg-gold-light"
            >
              <Reply className="h-4 w-4" /> Reply via Gmail
            </a>
            <Button variant="outline" onClick={() => setShowDetail(false)}>Close</Button>
            <Button
              variant="danger"
              onClick={() => selected && setDeleteConfirmId(selected.id)}
              disabled={deleteMessage.isPending}
            >
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </>
        }
      >
        {selected ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-gold-dark">
                  <Mail className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{selected.name}</p>
                  <p className="truncate text-xs text-muted">{selected.subject}</p>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <Badge variant="gold">Portal inquiry</Badge>
                <span className="text-xs text-muted">{formatDateDisplay(selected.created_at)}</span>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold/15 text-gold-dark">
                  <MessageSquareText className="h-4 w-4" />
                </div>
                <h4 className="text-sm font-semibold text-foreground">Message</h4>
                <span className="ml-auto truncate text-xs text-muted">{selected.email}</span>
              </div>
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
                {selected.message || '—'}
              </p>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-bg p-3">
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted">
                    <UserRound className="h-3.5 w-3.5" /> From
                  </p>
                  <p className="break-words text-sm font-semibold text-foreground">{selected.name}</p>
                </div>
                <div className="rounded-xl bg-bg p-3">
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted">
                    <Mail className="h-3.5 w-3.5" /> Email
                  </p>
                  <a
                    href={`mailto:${selected.email}`}
                    className="break-all text-sm font-semibold text-primary hover:underline"
                  >
                    {selected.email}
                  </a>
                </div>
                <div className="rounded-xl bg-bg p-3">
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted">
                    <Clock className="h-3.5 w-3.5" /> Received
                  </p>
                  <p className="text-sm font-semibold text-foreground">{formatLongDate(selected.created_at)}</p>
                </div>
                <div className="rounded-xl bg-bg p-3">
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted">
                    <Server className="h-3.5 w-3.5" /> IP Address
                  </p>
                  <p className="break-words text-sm font-semibold text-foreground">{selected.ip_address || '—'}</p>
                </div>
                <div className="rounded-xl bg-bg p-3 sm:col-span-2">
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted">
                    <MessageSquareText className="h-3.5 w-3.5" /> Subject
                  </p>
                  <p className="break-words text-sm font-semibold text-foreground">{selected.subject || '—'}</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center py-8 text-center">
            <AlertCircle className="mb-2 h-8 w-8 text-muted" />
            <p className="text-sm text-muted">Could not load message details.</p>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={deleteConfirmId !== null}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={handleDelete}
        title="Delete Message"
        message="Are you sure you want to delete this message? This action cannot be undone."
        confirmLabel="Delete"
        isLoading={deleteMessage.isPending}
      />
    </div>
  )
}

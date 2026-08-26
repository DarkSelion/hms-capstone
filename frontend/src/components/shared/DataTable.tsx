import { useState } from 'react'
import { cn } from '../../lib/utils'
import { TableContainer, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../ui/table'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { Search, ArrowUpDown, ArrowUp, ArrowDown, AlertCircle, RotateCcw, Inbox, ChevronLeft, ChevronRight } from 'lucide-react'

// eslint-disable-next-line @typescript-eslint/no-unused-vars

export interface Column<T> {
  key: string
  label: string
  sortable?: boolean
  render: (row: T) => React.ReactNode
  className?: string
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  loading?: boolean
  error?: string | null
  onSearch?: (value: string) => void
  sortBy?: string
  onSort?: (key: string) => void
  pagination?: {
    currentPage: number
    lastPage: number
    total: number
    from: number
    to: number
    onPageChange: (page: number) => void
  }
  onRetry?: () => void
  keyExtractor: (row: T) => string | number
  emptyState?: React.ReactNode
}

export function DataTable<T>({
  columns,
  data,
  loading,
  error,
  onSearch,
  sortBy,
  onSort,
  pagination,
  onRetry,
  keyExtractor,
  emptyState,
}: DataTableProps<T>) {
  const [localSearch, setLocalSearch] = useState('')

  const handleSearchChange = (value: string) => {
    setLocalSearch(value)
    onSearch?.(value)
  }

  function getPageNumbers(currentPage: number, lastPage: number): (number | '...')[] {
    const pages: (number | '...')[] = []
    const delta = 2
    const left = Math.max(2, currentPage - delta)
    const right = Math.min(lastPage - 1, currentPage + delta)

    pages.push(1)
    if (left > 2) pages.push('...')
    for (let i = left; i <= right; i++) pages.push(i)
    if (right < lastPage - 1) pages.push('...')
    if (lastPage > 1) pages.push(lastPage)

    return pages
  }

  function renderSortIcon(key: string) {
    if (!onSort) return null
    if (sortBy === key) {
      return <ArrowUp className="h-3.5 w-3.5" />
    }
    if (sortBy === `-${key}`) {
      return <ArrowDown className="h-3.5 w-3.5" />
    }
    return <ArrowUpDown className="h-3.5 w-3.5 text-muted/50" />
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-12">
        <AlertCircle className="mb-3 h-10 w-10 text-danger" />
        <p className="mb-2 text-sm font-medium text-foreground">Something went wrong</p>
        <p className="mb-4 text-sm text-muted">{error}</p>
        {onRetry && (
          <Button variant="outline" onClick={onRetry}>
            <RotateCcw className="h-4 w-4" />
            Retry
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {onSearch && (
        <div className="flex items-center gap-4">
          <div className="relative max-w-sm flex-1">
            <Input
              placeholder="Search..."
              icon={<Search className="h-4 w-4" />}
              value={localSearch}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </div>
        </div>
      )}

      <TableContainer>
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  className={cn(
                    col.sortable && 'cursor-pointer select-none',
                    col.className,
                  )}
                  onClick={() => col.sortable && onSort?.(col.key)}
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    {col.sortable && renderSortIcon(col.key)}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={`skeleton-${i}`}>
                  {columns.map((col) => (
                    <TableCell key={col.key}>
                      <div className="h-4 w-full animate-pulse rounded bg-bg" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length}>
                  {emptyState ? (
                    emptyState
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12">
                      <Inbox className="mb-3 h-10 w-10 text-muted/50" />
                      <p className="text-sm font-medium text-foreground">No data found</p>
                      <p className="text-sm text-muted">Try adjusting your search or filters.</p>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              data.map((row) => (
                <TableRow key={keyExtractor(row)}>
                  {columns.map((col) => (
                    <TableCell key={col.key} className={col.className}>
                      {col.render(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {pagination && !loading && pagination.lastPage > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted">
            Page {pagination.currentPage} of {pagination.lastPage}
          </p>
          <div className="inline-flex items-center rounded-lg border border-border bg-card">
            <button
              className="flex h-8 w-8 items-center justify-center rounded-l-lg text-muted transition-colors hover:bg-bg disabled:pointer-events-none disabled:opacity-50"
              onClick={() => pagination.onPageChange(pagination.currentPage - 1)}
              disabled={pagination.currentPage <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {getPageNumbers(pagination.currentPage, pagination.lastPage).map((page, i) =>
              page === '...' ? (
                <span key={`ellipsis-${i}`} className="flex h-8 w-8 items-center justify-center border-l border-border text-xs text-muted">
                  ...
                </span>
              ) : (
                <button
                  key={page}
                  onClick={() => pagination.onPageChange(page)}
                  className={`flex h-8 min-w-[2rem] items-center justify-center border-l border-border px-2 text-sm transition-colors ${
                    page === pagination.currentPage
                      ? 'z-10 mx-0.5 rounded-md border border-border bg-card text-foreground shadow-sm'
                      : 'text-muted hover:bg-bg hover:text-foreground'
                  }`}
                >
                  {page}
                </button>
              ),
            )}
            <button
              className="flex h-8 w-8 items-center justify-center rounded-r-lg border-l border-border text-muted transition-colors hover:bg-bg disabled:pointer-events-none disabled:opacity-50"
              onClick={() => pagination.onPageChange(pagination.currentPage + 1)}
              disabled={pagination.currentPage >= pagination.lastPage}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

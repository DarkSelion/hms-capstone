import { cn } from '../../lib/utils'

function TableContainer({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('w-full overflow-auto', className)} {...props} />
  )
}

function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <table className={cn('w-full caption-bottom text-sm', className)} {...props} />
  )
}

function TableHeader({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('[&_tr]:border-b', className)} {...props} />
}

function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('[&_tr:last-child]:border-0 [&_td]:h-16', className)} {...props} />
}

function TableRow({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        'border-b border-border transition-colors hover:bg-bg',
        className,
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ThHTMLAttributes<HTMLTableHeaderCellElement>) {
  return (
    <th
      className={cn(
        'h-12 px-4 text-left font-semibold text-xs uppercase tracking-wider text-muted bg-bg/60',
        className,
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.TdHTMLAttributes<HTMLTableDataCellElement>) {
  return (
    <td
      className={cn(
        'p-4 align-middle',
        className,
      )}
      {...props}
    />
  )
}

export { TableContainer, Table, TableHeader, TableBody, TableRow, TableHead, TableCell }

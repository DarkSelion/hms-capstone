import { COLUMN_WIDTHS } from './column-widths'

export interface HighlightColumn<T> {
  key: string
  label: string
  render: (row: T) => React.ReactNode
  className?: string
}

interface DailyHighlightTableProps<T> {
  columns: HighlightColumn<T>[]
  data: T[]
  rowKey: (row: T) => string | number
}

export function DailyHighlightTable<T>({
  columns,
  data,
  rowKey,
}: DailyHighlightTableProps<T>) {
  return (
    <div className="rounded-xl border border-amber-100 bg-amber-50/20 overflow-hidden">
      <table className="w-full table-fixed border-collapse text-sm">
        <colgroup>
          {columns.map((col) => (
            <col key={col.key} className={COLUMN_WIDTHS[col.key] ?? 'auto'} />
          ))}
        </colgroup>
        <thead>
          <tr className="border-b border-amber-200/40 text-left text-xs font-medium uppercase tracking-wider text-amber-600/70">
            {columns.map((col) => (
              <th key={col.key} className="px-2 h-10">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-amber-100/60">
          {data.map((row) => (
            <tr key={rowKey(row)} className="h-16 bg-amber-50/30 hover:bg-amber-50/60 transition-colors align-middle">
              {columns.map((col) => (
                <td key={col.key} className="px-2 py-3 align-middle">
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

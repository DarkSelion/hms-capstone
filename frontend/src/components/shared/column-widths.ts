/** Shared column width classes for operational tables (Reservations, Check-In, Check-Out).
 *  Ensures identical column proportions across all pages when used with table-fixed + colgroup. */
export const COLUMN_WIDTHS: Record<string, string> = {
  reservation_number: 'w-[15%]',
  guest: 'w-[20%]',
  room: 'w-[12%]',
  check_in: 'w-[15%]',
  check_out: 'w-[15%]',
  adults: 'w-[10%]',
  total_amount: 'w-[10%]',
  status: 'w-[10%]',
  alerts: 'w-[6%]',
  payment_status: 'w-[10%]',
  actions: 'w-[140px]',
}

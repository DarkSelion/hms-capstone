# Feature Specification: Date-Grouped Table Sections

## 1. Overview

**Feature**: Add visual date grouping to Check-In, Check-Out, and Reservations admin pages to separate "Today's" items from upcoming items.

**User Value**: Staff open a page and instantly see today's required actions — no scanning dates in a flat list.

**Target Users**: Receptionists, hotel managers, front-desk staff (admin role)

---

## 2. Functional Requirements

### DataTable Extension

| ID | Requirement |
|----|-------------|
| **FR-TBL-001** | While `groupByKey` prop is provided, DataTable shall render a full-width section header row (`colSpan={columns.length}`) before each group of rows sharing the same key |
| **FR-TBL-002** | DataTable shall accept `groupByKey?: (row: T) => string` prop |
| **FR-TBL-003** | DataTable shall accept `renderGroupHeader?: (groupKey: string, rows: T[], startIndex: number) => ReactNode` prop |
| **FR-TBL-004** | Where `groupByKey` is not provided, DataTable renders identically to current flat-list behavior |

### Date Grouping Logic

| ID | Requirement |
|----|-------------|
| **FR-GRP-001** | Check-In page: group by `check_in` date — "TODAY" if equals today, "UPCOMING" if after |
| **FR-GRP-002** | Check-Out page: group by `check_out` date — "TODAY" if equals today, "UPCOMING" if after |
| **FR-GRP-003** | Reservations page: group by `check_in` date — same logic |
| **FR-GRP-004** | Where no items exist for a group, that section header shall not render |

### Section Headers

| ID | Requirement |
|----|-------------|
| **FR-HDR-001** | Today header: `TODAY — {date} (N arrivals/departures/bookings)` — amber background (`bg-amber-50 border-y border-amber-200/60`) |
| **FR-HDR-002** | Upcoming header: `UPCOMING ARRIVALS/DEPARTURES/BOOKINGS` — neutral slate (`bg-slate-50 border-y border-border`) |
| **FR-HDR-003** | Header text: `text-xs uppercase tracking-wider font-semibold` |

### Row Highlighting & Badges

| ID | Requirement |
|----|-------------|
| **FR-ROW-001** | Today rows: subtle amber tint (`bg-amber-50/30`) |
| **FR-ROW-002** | Check-In: green "TODAY" badge pill (`bg-emerald-50 text-emerald-700 border-emerald-200/60`) in Arrival column |
| **FR-ROW-003** | Check-Out: blue "DEPARTING TODAY" badge pill (`bg-sky-50 text-sky-700 border-sky-200/60`) in Departure column |
| **FR-ROW-004** | Reservations: green "CHECK-IN TODAY" badge pill in Stay column |

### Sorting & Prioritization

| ID | Requirement |
|----|-------------|
| **FR-SRT-001** | Today group always appears above Upcoming group |
| **FR-SRT-002** | Column sort applies within each group (Today sorted among itself, Upcoming among itself) |
| **FR-SRT-003** | Groups never merge regardless of sort direction |

---

## 3. Non-Functional Requirements

- **NFR-PERF**: Date grouping calculation < 5ms for 500 rows (client-side)
- **NFR-UI**: Group headers visually distinct (no hover, no click, different bg)
- **NFR-A11Y**: Section headers use `role="row"` + `aria-label` for screen readers

---

## 4. Acceptance Criteria

| AC | Given | When | Then |
|----|-------|------|------|
| **AC-001** | 3 today + 5 upcoming reservations on Check-In page | Staff opens page | "TODAY — 17 SEPT 2026 (3 arrivals)" header at top, 3 amber-tinted rows with green "TODAY" badge, then "UPCOMING ARRIVALS" header with 5 rows |
| **AC-002** | 2 today + 4 upcoming departures on Check-Out page | Staff opens page | "TODAY — 17 SEPT 2026 (2 departures)" header, blue "DEPARTING TODAY" badges, then "UPCOMING DEPARTURES" |
| **AC-003** | All reservations are upcoming (none today) | Staff opens Check-In | Only "UPCOMING ARRIVALS" header — no "Today" section |
| **AC-004** | All reservations are today (none upcoming) | Staff opens Check-In | Only "TODAY" header — no "Upcoming" section |
| **AC-005** | Today + upcoming items exist | Staff searches matching 1 today + 2 upcoming | Groups still separated, counts update in headers |
| **AC-006** | Today + upcoming items exist | Staff clicks column sort header | Sort applies within each group, Today stays above Upcoming |
| **AC-007** | Today + upcoming items exist | Staff searches for non-matching term | Empty state shown, no section headers |
| **AC-008** | 15 today reservations, page size 10 | Staff views page 1 | All 10 rows under "TODAY" header; upcoming starts after |
| **AC-009** | Any page without `groupByKey` (Expenses, Staff, etc.) | Data renders | Flat list, no headers — no regression |

---

## 5. Error Handling

| Scenario | Behavior |
|----------|----------|
| `check_in`/`check_out` is null | Classify as "UPCOMING" (safe fallback) |
| All rows same group | Single section header rendered |
| User changes date filter (Reservations) | Groups recalculate client-side immediately |
| Timezone mismatch (server vs client) | Use local client `Date` for "today" comparison |

---

## 6. Implementation TODO

### Phase 1 — Extend DataTable
- [ ] Add `groupByKey` + `renderGroupHeader` props to `DataTableProps<T>`
- [ ] Modify `<TableBody>` loop to detect group boundaries, inject separator `<tr>` with `colSpan`
- [ ] No regression when `groupByKey` absent

### Phase 2 — Shared Helpers
- [ ] Create `lib/date-group.ts` — `isSameDay(dateStr, today)`, `isAfterDay(dateStr, today)`
- [ ] Create `TodayBadge` component (variant: `arrival` | `departure`)

### Phase 3 — Check-In Page
- [ ] `groupByKey`: `check_in === today ? 'today' : 'upcoming'`
- [ ] Section headers + row tint + "TODAY" badge

### Phase 4 — Check-Out Page
- [ ] `groupByKey`: `check_out === today ? 'today' : 'upcoming'`
- [ ] Section headers + row tint + "DEPARTING TODAY" badge

### Phase 5 — Reservations Page
- [ ] `groupByKey`: `check_in === today ? 'today' : 'upcoming'`
- [ ] Section headers + row tint + "CHECK-IN TODAY" badge

### Phase 6 — Testing
- [ ] Test: today-only, upcoming-only, mixed, empty, filtered, sorted, paginated
- [ ] Run vitest suite — no regressions
- [ ] Accessibility check

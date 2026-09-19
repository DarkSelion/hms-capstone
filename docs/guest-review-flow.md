# Guest Review System — Full Flow & Build Documentation

## Overview

Guests can leave a 1–5 star review with an optional title and comment after checking out of a reservation. Reviews are displayed publicly on room detail pages. Admins can reply to reviews and manage them via a dedicated Reviews page.

---

## Database Schema

### `reviews` table (migration `2026_09_15_000003`)

| Column | Type | Notes |
|---|---|---|
| `id` | bigint PK | auto |
| `guest_id` | FK → `guests` | cascade delete |
| `reservation_id` | FK → `reservations` | cascade delete |
| `room_type_id` | FK → `room_types` | cascade delete |
| `rating` | tinyInteger | 1–5 |
| `title` | string, nullable | max 200 chars |
| `comment` | text, nullable | max 2000 chars |
| `is_approved` | boolean | default `false` |
| `admin_reply` | text, nullable | |
| `admin_replied_at` | timestamp, nullable | |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

**Unique constraint:** `(guest_id, reservation_id)` — one review per guest per reservation.

### `room_types` table additions (migration `2026_09_15_000004`)

| Column | Type | Notes |
|---|---|---|
| `avg_rating` | decimal(3,2) | default 0, denormalized |
| `review_count` | integer | default 0, denormalized |

---

## Backend

### Model: `Review.php`

```php
class Review extends Model
{
    protected $fillable = [
        'guest_id', 'reservation_id', 'room_type_id',
        'rating', 'title', 'comment',
        'is_approved', 'admin_reply', 'admin_replied_at',
    ];

    protected function casts(): array
    {
        return [
            'rating' => 'integer',
            'is_approved' => 'boolean',
            'admin_replied_at' => 'datetime',
        ];
    }

    public function guest(): BelongsTo { return $this->belongsTo(Guest::class); }
    public function reservation(): BelongsTo { return $this->belongsTo(Reservation::class); }
    public function roomType(): BelongsTo { return $this->belongsTo(RoomType::class); }

    public function approve(): void
    {
        $this->update(['is_approved' => true]);
        $this->recalculateRoomTypeStats();
    }

    public function reject(): void
    {
        $this->delete();
        $this->roomType->recalculateReviewStats();
    }

    public function recalculateRoomTypeStats(): void
    {
        $this->roomType->recalculateReviewStats();
    }
}
```

### RoomType Stats Recalculation

```php
// RoomType.php
public function recalculateReviewStats(): void
{
    $stats = $this->reviews()->where('is_approved', true)
        ->selectRaw('AVG(rating) as avg, COUNT(*) as count')
        ->first();

    $this->update([
        'avg_rating' => round($stats->avg ?? 0, 2),
        'review_count' => $stats->count ?? 0,
    ]);
}
```

Called on every approve, delete, or reject.

### Controller: `ReviewController.php`

| Method | HTTP | Auth | Description |
|---|---|---|---|
| `store()` | `POST /api/public/reviews` | Guest | Create review after checkout |
| `myReviews()` | `GET /api/public/reviews` | Guest | List own reviews (paginated) |
| `publicRoomReviews()` | `GET /api/public/rooms/{slug}/reviews` | Public | Approved reviews for a room type |
| `index()` | `GET /api/reviews` | Admin | All reviews with filters |
| `approve()` | `PUT /api/reviews/{review}/approve` | Admin | Approve + recalculate stats |
| `destroy()` | `DELETE /api/reviews/{review}` | Admin | Delete + recalculate stats |
| `reply()` | `POST /api/reviews/{review}/reply` | Admin | Add admin reply |

### Validation (inline, no FormRequest)

**Store:**
```php
$request->validate([
    'reservation_id' => 'required|exists:reservations,id',
    'rating' => 'required|integer|min:1|max:5',
    'title' => 'nullable|string|max:200',
    'comment' => 'nullable|string|max:2000',
]);
```

**Business rules:**
- `reservation->guest_id === auth guest id` (else 404)
- `reservation->status === 'checked_out'` (else 422)
- No duplicate `(guest_id, reservation_id)` (else 422)

**Reply:**
```php
$request->validate([
    'reply' => 'required|string|max:2000',
]);
```

### Route Map

| Method | URI | Auth | Handler |
|---|---|---|---|
| `POST` | `/api/public/reviews` | Guest | `store` |
| `GET` | `/api/public/reviews` | Guest | `myReviews` |
| `GET` | `/api/public/rooms/{slug}/reviews` | Public | `publicRoomReviews` |
| `GET` | `/api/reviews` | Admin | `index` |
| `PUT` | `/api/reviews/{review}/approve` | Admin | `approve` |
| `DELETE` | `/api/reviews/{review}` | Admin | `destroy` |
| `POST` | `/api/reviews/{review}/reply` | Admin | `reply` |

---

## Frontend

### TypeScript Types

```typescript
export interface Review {
  id: number
  guest_id: number
  reservation_id: number
  room_type_id: number
  rating: number
  title?: string
  comment?: string
  is_approved: boolean
  admin_reply?: string
  admin_replied_at?: string
  guest?: Guest
  room_type?: RoomType
  reservation?: Reservation
  created_at: string
}

export interface PublicReview {
  id: number
  rating: number
  title?: string
  comment?: string
  guest?: { first_name: string; last_name: string; full_name: string }
  admin_reply?: string
  created_at: string
}
```

### React Query Hooks

| Hook | Endpoint | Used By |
|---|---|---|
| `useSubmitReview()` | `POST /public/reviews` | PublicWriteReviewPage |
| `usePublicRoomReviews(slug)` | `GET /public/rooms/{slug}/reviews` | PublicRoomDetailPage |
| `useReviews(params)` | `GET /reviews` | ReviewsPage (admin) |
| `useApproveReview()` | `PUT /reviews/{id}/approve` | ReviewsPage |
| `useDeleteReview()` | `DELETE /reviews/{id}` | ReviewsPage |
| `useReplyToReview()` | `POST /reviews/{id}/reply` | ReviewsPage |

### Guest Journey Flow

```
My Reservations page (PublicMyReservationsPage.tsx)
    │
    │  status === "checked_out" → shows "Write Review" button
    │
    ▼  Links to /public/write-review/:id
    │
PublicWriteReviewPage.tsx
    │
    ├── Guard: fetches reservation by ID, checks status is "checked_out"
    │   (else shows "not eligible" message)
    │
    ├── Form: star rating (1-5 with sentiment labels) + title + comment
    │
    └── On submit → useSubmitReview mutation
         │
         ▼  POST /api/public/reviews { reservation_id, rating, title, comment }
         │
         ▼  On success → success confirmation screen
```

### Public Room Detail Reviews Display

```
PublicRoomDetailPage.tsx → Room Detail page
    │
    ▼  Fetches: GET /api/public/rooms/{slug}/reviews
    │
    ▼  usePublicRoomReviews(slug) hook
    │
    ▼  Renders:
         - avg_rating + review_count header
         - 3-column grid of approved reviews
         - Each review: star rating, title, comment, guest name, date
         - "Hotel Reply" section when admin_reply exists
         - Empty state: "No reviews yet"
```

### Admin Management

```
Sidebar → Reviews (/admin/reviews)
    │
    ▼  ReviewsPage.tsx
    │
    ├── DataTable: columns = Guest, Room Type, Rating (stars), Title, Status, Date
    ├── Filters: search (title/comment), approved toggle
    │
    ├── Actions:
    │   ├── Approve → PUT /api/reviews/{id}/approve
    │   ├── Reply → modal → POST /api/reviews/{id}/reply
    │   └── Delete → DELETE /api/reviews/{id}
    │
    └── All mutations invalidate ['reviews'] query cache
```

### Frontend Routes (`App.tsx`)

```tsx
// Admin
<Route path="reviews" element={<RequireRole><ReviewsPage /></RequireRole>} />

// Portal
<Route path="write-review/:id" element={
  <ProtectedPublicRoute><PublicWriteReviewPage /></ProtectedPublicRoute>
} />
```

### Sidebar Entry

```tsx
{ label: 'Reviews', icon: <Star size={20} />, path: '/admin/reviews', adminOnly: true }
```

Located under the "Reports" section.

---

## Tests

### Backend: `ReviewCancellationTierTest.php` (14 tests)

- `test_guest_can_submit_review_after_checkout`
- `test_guest_cannot_review_twice_same_reservation`
- `test_guest_cannot_review_non_checked_out_reservation`
- `test_guest_cannot_review_other_guests_reservation`
- `test_admin_can_approve_review`
- `test_admin_can_delete_review`
- `test_admin_can_reply_to_review`
- `test_public_reviews_endpoint_returns_approved_only`
- `test_guest_can_list_own_reviews`
- `test_admin_can_list_all_reviews`
- `test_non_admin_cannot_approve_review`
- `test_review_recuplicates_stats_across_multiple_reviews`

### Frontend

- `ReviewsPage.test.tsx` — 5 tests (renders rows, action buttons, approve mutation, reply modal, empty state)
- `PublicWriteReviewPage.test.tsx` — 4 tests (form render, loading skeleton, not-eligible guard, submit with rating)

---

## Key Design Decisions

1. **Auto-approval** — reviews are approved on creation (`is_approved = true`), so they appear immediately on room detail pages. The admin approve/reject flow exists but isn't gating publication.
2. **One review per guest per reservation** — enforced by unique DB constraint + controller check.
3. **Check-out gate** — reviews can only be submitted after `checked_out` status.
4. **Denormalized stats** — `room_types.avg_rating` and `review_count` are recalculated on every approve/delete/reject for fast reads on room listing/detail pages.
5. **HTML stripping** — `strip_tags()` on title, comment, and admin_reply to prevent XSS.
6. **No seeder / no factory** — reviews are only created through the API or tests.

---

## Files Inventory

| Layer | File |
|---|---|
| **Model** | `backend/app/Models/Review.php` |
| **Stats on RoomType** | `backend/app/Models/RoomType.php` (`recalculateReviewStats`) |
| **Controller** | `backend/app/Http/Controllers/Api/ReviewController.php` |
| **Migrations** | `database/migrations/2026_09_15_000003_create_reviews_table.php` |
| | `database/migrations/2026_09_15_000004_add_review_stats_to_room_types.php` |
| **Routes** | `backend/routes/api.php` (lines 177-181, 216, 237-238) |
| **Backend tests** | `tests/Feature/ReviewCancellationTierTest.php` |
| **TS types** | `frontend/src/types/index.ts` (lines 434-459) |
| **Admin hooks** | `frontend/src/hooks/useApi.ts` (lines 1168-1204) |
| **Portal hooks** | `frontend/src/hooks/usePublicApi.ts` (lines 240-257) |
| **Admin page** | `frontend/src/pages/admin/ReviewsPage.tsx` |
| **Write review page** | `frontend/src/pages/public/PublicWriteReviewPage.tsx` |
| **Room detail (reviews)** | `frontend/src/pages/public/PublicRoomDetailPage.tsx` (lines 361-419) |
| **My Reservations (write button)** | `frontend/src/pages/public/PublicMyReservationsPage.tsx` (lines 689, 851-858) |
| **Frontend routes** | `frontend/src/App.tsx` (lines 151, 170-172) |
| **Sidebar** | `frontend/src/components/layout/Sidebar.tsx` (line 95) |
| **Admin tests** | `ReviewsPage.test.tsx` |
| **Portal tests** | `PublicWriteReviewPage.test.tsx` |

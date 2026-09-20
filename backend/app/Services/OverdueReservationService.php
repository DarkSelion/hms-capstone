<?php

namespace App\Services;

use App\Models\Reservation;
use App\Models\ActivityLog;
use Illuminate\Support\Facades\Auth;

class OverdueReservationService
{
    public function detectAndFlagOverdue(): array
    {
        $today = now()->startOfDay();
        $flaggedIds = [];

        // Phase 1: Detect unchecked-in no-shows (confirmed + check_in < today)
        $noShows = Reservation::where('status', 'confirmed')
            ->whereDate('check_in', '<', $today)
            ->where('is_overdue', false)
            ->get();

        foreach ($noShows as $reservation) {
            $reservation->update([
                'is_overdue' => true,
                'overdue_at' => now()->parse($reservation->check_in)->startOfDay(),
            ]);

            ActivityLog::create([
                'user_id' => null,
                'action' => 'flagged_overdue',
                'module' => 'reservations',
                'model_type' => 'Reservation',
                'model_id' => $reservation->id,
                'description' => "Overdue reservation #{$reservation->reservation_number} flagged for No Show review",
            ]);

            $flaggedIds[] = $reservation->id;
        }

        // Phase 2: Detect overstay guests (checked_in + check_out < today)
        $overstays = Reservation::where('status', 'checked_in')
            ->whereDate('check_out', '<', $today)
            ->where('is_overdue', false)
            ->get();

        foreach ($overstays as $reservation) {
            $reservation->update([
                'is_overdue' => true,
                'overdue_at' => now()->parse($reservation->check_out)->startOfDay(),
            ]);

            ActivityLog::create([
                'user_id' => null,
                'action' => 'flagged_overdue',
                'module' => 'reservations',
                'model_type' => 'Reservation',
                'model_id' => $reservation->id,
                'description' => "Overstay guest on reservation #{$reservation->reservation_number} — guest has passed scheduled check-out",
            ]);

            $flaggedIds[] = $reservation->id;
        }

        if (!empty($flaggedIds)) {
            $this->notifyStaffOfOverdue($flaggedIds);
        }

        return [
            'count' => count($flaggedIds),
            'reservation_ids' => $flaggedIds,
        ];
    }

    public function clearOverdue(int $reservationId): bool
    {
        $reservation = Reservation::find($reservationId);

        if (!$reservation) {
            return false;
        }

        $reservation->update([
            'is_overdue' => false,
            'overdue_at' => null,
        ]);

        ActivityLog::create([
            'user_id' => Auth::id(),
            'action' => 'cleared_overdue',
            'module' => 'reservations',
            'model_type' => 'Reservation',
            'model_id' => $reservation->id,
            'description' => "Cleared overdue flag for reservation #{$reservation->reservation_number}",
        ]);

        return true;
    }

    protected function notifyStaffOfOverdue(array $reservationIds): void
    {
        $users = \App\Models\User::whereHas('role', function ($q) {
            $q->whereIn('slug', ['admin', 'hotel_manager']);
        })->get();

        if ($users->isEmpty()) {
            return;
        }

        $reservations = Reservation::whereIn('id', $reservationIds)->get();

        foreach ($users as $user) {
            ActivityLog::create([
                'user_id' => $user->id,
                'action' => 'notified_overdue',
                'module' => 'reservations',
                'model_type' => 'Reservation',
                'description' => "Notification: " . count($reservations) . " overdue reservation(s) require review",
            ]);
        }
    }
}
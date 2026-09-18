<?php

namespace App\Console\Commands;

use App\Models\Reservation;
use App\Models\Setting;
use App\Models\ActivityLog;
use App\Mail\AutoCancelledMail;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;

class CancelOverdueReservations extends Command
{
    protected $signature = 'app:cancel-overdue-reservations';
    protected $description = 'Auto-cancel unpaid confirmed reservations past the grace period and mark paid no-shows after checkout date';

    public function handle(): int
    {
        $graceHours = $this->getGraceHours();
        $now = now();

        $cancelled = $this->cancelUnpaidOverdue($now, $graceHours);
        $noShows = $this->markPaidNoShows($now);

        $this->info("Auto-cancel: {$cancelled} unpaid reservation(s) cancelled.");
        $this->info("No-show: {$noShows} paid reservation(s) marked as no-show.");

        return self::SUCCESS;
    }

    private function getGraceHours(): int
    {
        $setting = Setting::where('key', 'auto_cancel_grace_hours')->first();
        $hours = $setting ? (int) $setting->getRawOriginal('value') : 24;

        return max(1, $hours);
    }

    private function cancelUnpaidOverdue(\Carbon\Carbon $now, int $graceHours): int
    {
        $cutoff = $now->copy()->subHours($graceHours);

        $reservations = Reservation::where('status', 'confirmed')
            ->where('payment_status', 'unpaid')
            ->where(function ($q) use ($cutoff) {
                // check_in date + grace period has passed
                $q->whereRaw("DATE_ADD(check_in, INTERVAL {$graceHours} HOUR) <= ?", [$cutoff]);
            })
            ->with(['guest', 'room'])
            ->get();

        $count = 0;

        foreach ($reservations as $reservation) {
            DB::transaction(function () use ($reservation, &$count) {
                $reservation->update([
                    'status' => 'cancelled',
                    'cancellation_reason' => 'Auto-cancelled: Unpaid no-show past grace period',
                ]);

                // Revert room status
                if ($reservation->room) {
                    $reservation->room->reconcileStatus();
                }

                ActivityLog::create([
                    'user_id' => null,
                    'action' => 'cancelled',
                    'module' => 'reservations',
                    'model_type' => 'Reservation',
                    'model_id' => $reservation->id,
                    'description' => "Auto-cancelled unpaid reservation #{$reservation->reservation_number}: past grace period without payment",
                ]);

                // Send cancellation email
                if ($reservation->guest?->email) {
                    try {
                        Mail::to($reservation->guest->email)->send(
                            new AutoCancelledMail($reservation)
                        );
                    } catch (\Throwable $e) {
                        \Log::warning('Failed to send auto-cancellation email', [
                            'reservation_id' => $reservation->id,
                            'error' => $e->getMessage(),
                        ]);
                    }
                }

                $count++;
            });
        }

        return $count;
    }

    private function markPaidNoShows(\Carbon\Carbon $now): int
    {
        // Mark as no-show ONLY after the final departure date + check-out time has passed
        $checkOutTime = $this->getCheckOutTime();
        $cutoffDateTime = $now->copy()->subDay()->hour((int) substr($checkOutTime, 0, 2))->minute((int) substr($checkOutTime, 3, 2));

        $reservations = Reservation::where('status', 'confirmed')
            ->where('check_out', '<', $now->toDateString())
            ->whereRaw("DATE_ADD(check_out, INTERVAL ? HOUR) <= ?", [
                (int) substr($checkOutTime, 0, 2),
                $cutoffDateTime,
            ])
            ->with(['guest', 'room'])
            ->get();

        $count = 0;

        foreach ($reservations as $reservation) {
            DB::transaction(function () use ($reservation, &$count) {
                $reservation->update([
                    'status' => 'no_show',
                    'is_overdue' => false,
                    'cancellation_reason' => 'Auto no-show: guest did not arrive before departure date',
                ]);

                // Set room to dirty for housekeeping
                if ($reservation->room) {
                    $reservation->room->update(['status' => 'dirty', 'cleaning_status' => 'dirty']);
                }

                ActivityLog::create([
                    'user_id' => null,
                    'action' => 'no_show',
                    'module' => 'reservations',
                    'model_type' => 'Reservation',
                    'model_id' => $reservation->id,
                    'description' => "Auto no-show for reservation #{$reservation->reservation_number}. Payment retained per hotel policy.",
                ]);

                $count++;
            });
        }

        return $count;
    }

    private function getCheckOutTime(): string
    {
        $setting = Setting::where('key', 'check_out_time')->first();

        return $setting ? $setting->getRawOriginal('value') : '11:00';
    }
}

<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Reservation;
use App\Models\Room;
use App\Models\Setting;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ReportController extends Controller
{
    public function revenue(Request $request)
    {
        $data = $request->validate([
            'from' => 'required|date',
            'to' => 'required|date|after_or_equal:from',
            'group_by' => 'sometimes|in:day,week,month',
        ]);

        $from = now()->parse($data['from'])->startOfDay();
        $to = now()->parse($data['to'])->endOfDay();
        $days = $from->diffInDays($to->copy()->startOfDay());
        $dates = collect(range(0, $days))->map(fn ($day) => $from->copy()->addDays($day)->format('Y-m-d'));

        $revenueByDate = Payment::where('status', 'completed')
            ->whereBetween('created_at', [$data['from'] . ' 00:00:00', $data['to'] . ' 23:59:59'])
            ->get(['created_at', 'amount'])
            ->groupBy(fn ($p) => $p->created_at->format('Y-m-d'))
            ->map(fn ($group) => round($group->sum('amount'), 2));

        $invoiceRevenueByDate = Invoice::where('status', 'paid')
            ->whereNotNull('paid_at')
            ->whereBetween('paid_at', [$data['from'] . ' 00:00:00', $data['to'] . ' 23:59:59'])
            ->get(['paid_at', 'total_amount'])
            ->groupBy(fn ($i) => $i->paid_at->format('Y-m-d'))
            ->map(fn ($group) => round($group->sum('total_amount'), 2));

        foreach ($invoiceRevenueByDate as $date => $amount) {
            $revenueByDate[$date] = round((float) ($revenueByDate[$date] ?? 0) + (float) $amount, 2);
        }

        $bookingsByDate = Reservation::whereBetween('created_at', [$data['from'] . ' 00:00:00', $data['to'] . ' 23:59:59'])
            ->get(['created_at'])
            ->groupBy(fn ($r) => $r->created_at->format('Y-m-d'))
            ->map->count();

        $occupiedByDate = $this->dailyOccupiedCounts($data['from'], $data['to']);
        $totalRooms = Room::where('is_active', true)->count();

        $results = $dates->map(function ($date) use ($revenueByDate, $bookingsByDate, $occupiedByDate, $totalRooms) {
            $revenue = (float) ($revenueByDate[$date] ?? 0);
            $bookings = (int) ($bookingsByDate[$date] ?? 0);
            $occupied = (int) ($occupiedByDate[$date] ?? 0);

            return [
                'date' => $date,
                'revenue' => $revenue,
                'bookings' => $bookings,
                'adr' => $bookings > 0 ? round($revenue / $bookings, 2) : 0,
                'occupancy_rate' => $totalRooms > 0 ? round(($occupied / $totalRooms) * 100, 2) : 0,
            ];
        });

        return response()->json($results);
    }

    public function occupancy(Request $request)
    {
        $data = $request->validate([
            'from' => 'required|date',
            'to' => 'required|date|after_or_equal:from',
        ]);

        $totalRooms = Room::where('is_active', true)->count();
        $from = now()->parse($data['from'])->startOfDay();
        $to = now()->parse($data['to'])->endOfDay();
        $days = $from->diffInDays($to->copy()->startOfDay());

        $dates = collect(range(0, $days))->map(fn ($day) => $from->copy()->addDays($day)->format('Y-m-d'));

        $occupiedByDate = $this->dailyOccupiedCounts($data['from'], $data['to']);

        $results = $dates->map(function ($date) use ($occupiedByDate, $totalRooms) {
            $occupied = (int) ($occupiedByDate[$date] ?? 0);

            return [
                'date' => $date,
                'available_rooms' => $totalRooms - $occupied,
                'booked_rooms' => $occupied,
                'rate' => $totalRooms > 0 ? round(($occupied / $totalRooms) * 100, 2) : 0,
            ];
        });

        return response()->json($results);
    }

    private function dailyOccupiedCounts(string $from, string $to): array
    {
        $start = now()->parse($from)->startOfDay();
        $end = now()->parse($to)->endOfDay();
        $days = $start->diffInDays($end->copy()->startOfDay());
        $dates = collect(range(0, $days))->map(fn ($day) => $start->copy()->addDays($day)->format('Y-m-d'));

        $reservations = Reservation::select('check_in', 'check_out', 'status')
            ->whereIn('status', ['checked_in', 'confirmed'])
            ->where('check_in', '<=', $end->format('Y-m-d'))
            ->where(function ($q) use ($start) {
                $q->where('check_out', '>=', $start->format('Y-m-d'))
                    ->orWhere('status', 'checked_in');
            })
            ->get();

        return $dates->mapWithKeys(function ($date) use ($reservations) {
            $occupied = $reservations->filter(fn ($r) => $r->check_in <= $date && ($r->status === 'checked_in' || $r->check_out > $date))->count();

            return [$date => $occupied];
        })->all();
    }

    public function reservations(Request $request)
    {
        $data = $request->validate([
            'from' => 'required|date',
            'to' => 'required|date|after_or_equal:from',
        ]);

        $total = Reservation::whereBetween('created_at', [$data['from'], $data['to'] . ' 23:59:59'])->count();

        $statusBreakdown = Reservation::whereBetween('created_at', [$data['from'], $data['to'] . ' 23:59:59'])
            ->select('status', DB::raw('COUNT(*) as total'))
            ->groupBy('status')
            ->get();

        $daily = Reservation::whereBetween('created_at', [$data['from'], $data['to'] . ' 23:59:59'])
            ->select(DB::raw('DATE(created_at) as date'), DB::raw('COUNT(*) as total'))
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        return response()->json([
            'total' => $total,
            'status_breakdown' => $statusBreakdown,
            'daily' => $daily,
        ]);
    }

    public function export(Request $request, string $type)
    {
        $allowed = ['revenue', 'occupancy', 'reservations'];
        if (!in_array($type, $allowed)) {
            return response()->json(['message' => 'Invalid report type.'], 422);
        }

        $format = $request->format ?? 'csv';
        if (!in_array($format, ['csv', 'pdf'])) {
            return response()->json(['message' => 'Invalid export format.'], 422);
        }

        $from = $request->from ?? now()->subMonth()->toDateString();
        $to = $request->to ?? now()->toDateString();

        if ($format === 'pdf') {
            return $this->exportPdf($type, $from, $to);
        }

        return $this->exportCsv($type, $from, $to);
    }

    protected function exportCsv(string $type, string $from, string $to)
    {
        [$headers, $rows] = $this->buildRows($type, $from, $to);

        $filename = storage_path('app/' . $type . '-report.csv');
        $handle = fopen($filename, 'w');
        fputcsv($handle, $headers);
        foreach ($rows as $row) {
            fputcsv($handle, $row);
        }
        fclose($handle);

        return response()->download($filename, basename($filename), [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="' . basename($filename) . '"',
        ])->deleteFileAfterSend(true);
    }

    protected function exportPdf(string $type, string $from, string $to)
    {
        [$headers, $rows] = $this->buildRows($type, $from, $to);

        $hotel = Setting::where('group', 'hotel')->pluck('value', 'key');

        $pdf = Pdf::loadView('reports.pdf', [
            'type' => $type,
            'from' => $from,
            'to' => $to,
            'headers' => $headers,
            'rows' => $rows,
            'hotel' => $hotel,
        ]);

        return $pdf->download($type . '-report.pdf');
    }

    protected function buildRows(string $type, string $from, string $to): array
    {
        switch ($type) {
            case 'revenue':
                $headers = ['Date', 'Amount', 'Payment Method', 'Reservation'];
                $rows = Payment::with('reservation')
                    ->where('status', 'completed')
                    ->whereBetween('created_at', [$from, $to . ' 23:59:59'])
                    ->orderBy('created_at')
                    ->get()
                    ->map(function ($p) {
                        return [
                            $p->created_at->format('Y-m-d'),
                            number_format((float) $p->amount, 2),
                            $p->payment_method,
                            $p->reservation?->reservation_number,
                        ];
                    })
                    ->toArray();

                $invoiceRows = Invoice::with('reservation')
                    ->where('status', 'paid')
                    ->whereNotNull('paid_at')
                    ->whereBetween('paid_at', [$from . ' 00:00:00', $to . ' 23:59:59'])
                    ->orderBy('paid_at')
                    ->get()
                    ->map(function ($i) {
                        return [
                            $i->paid_at->format('Y-m-d'),
                            number_format((float) $i->total_amount, 2),
                            'Invoice',
                            $i->reservation?->reservation_number,
                        ];
                    })
                    ->toArray();

                $rows = array_merge($rows, $invoiceRows);
                break;

            case 'occupancy':
                $headers = ['Date', 'Occupied', 'Available', 'Rate (%)'];
                $totalRooms = Room::where('is_active', true)->count();
                $rangeStart = now()->parse($from)->startOfDay();
                $rangeEnd = now()->parse($to)->endOfDay();
                $days = $rangeStart->diffInDays($rangeEnd->copy()->startOfDay());
                $dates = collect(range(0, $days))->map(fn ($d) => $rangeStart->copy()->addDays($d)->format('Y-m-d'));

                $reservations = Reservation::select('check_in', 'check_out', 'status')
                    ->whereIn('status', ['checked_in', 'confirmed'])
                    ->where('check_in', '<=', $rangeEnd->format('Y-m-d'))
                    ->where(function ($q) use ($rangeStart) {
                        $q->where('check_out', '>=', $rangeStart->format('Y-m-d'))
                            ->orWhere('status', 'checked_in');
                    })
                    ->get();

                $rows = $dates->map(function ($date) use ($reservations, $totalRooms) {
                    $occupied = $reservations->filter(fn ($r) => $r->check_in <= $date && ($r->status === 'checked_in' || $r->check_out > $date))->count();
                    return [
                        $date,
                        $occupied,
                        $totalRooms - $occupied,
                        $totalRooms > 0 ? round(($occupied / $totalRooms) * 100, 2) : 0,
                    ];
                })->toArray();
                break;

            case 'reservations':
                $headers = ['ID', 'Number', 'Guest', 'Room', 'Check In', 'Check Out', 'Status', 'Total', 'Created'];
                $rows = Reservation::with('guest', 'room')
                    ->whereBetween('created_at', [$from, $to . ' 23:59:59'])
                    ->orderBy('created_at')
                    ->get()
                    ->map(function ($r) {
                        return [
                            $r->id,
                            $r->reservation_number,
                            trim(($r->guest->first_name ?? '') . ' ' . ($r->guest->last_name ?? '')),
                            $r->room?->room_number,
                            $r->check_in,
                            $r->check_out,
                            $r->status,
                            number_format((float) $r->total_amount, 2),
                            $r->created_at->format('Y-m-d'),
                        ];
                    })
                    ->toArray();
                break;

            default:
                return [[], []];
        }

        return [$headers, $rows];
    }
}

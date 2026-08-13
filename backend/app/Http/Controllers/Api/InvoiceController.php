<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Models\Reservation;
use App\Models\Setting;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class InvoiceController extends Controller
{
    public function index(Request $request)
    {
        $query = Invoice::with(['reservation.guest', 'items']);

        if ($status = $request->status) {
            $query->where('status', $status);
        }

        if ($from = $request->date_from) {
            $query->where('issued_date', '>=', $from);
        }

        if ($to = $request->date_to) {
            $query->where('issued_date', '<=', $to);
        }

        return response()->json(
            $query->orderBy('created_at', 'desc')->paginate($request->per_page ?? 10)
        );
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'reservation_id' => 'required|exists:reservations,id',
            'items' => 'required|array',
            'items.*.description' => 'required|string',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.unit_price' => 'required|numeric|min:0',
            'subtotal' => 'required|numeric|min:0',
            'tax' => 'nullable|numeric|min:0',
            'discount' => 'nullable|numeric|min:0',
            'notes' => 'nullable|string',
            'issued_date' => 'nullable|date',
            'due_date' => 'nullable|date',
        ]);

        $invoice = DB::transaction(function () use ($data, $request) {
            $reservation = Reservation::findOrFail($data['reservation_id']);
            $year = now()->year;
            $lastId = Invoice::whereBetween('created_at', ["$year-01-01 00:00:00", "$year-12-31 23:59:59"])->max('id') ?? 0;

            $amount = (float) $data['subtotal'];
            $taxAmount = (float) ($data['tax'] ?? 0);
            $discountAmount = min((float) ($data['discount'] ?? 0), $amount + $taxAmount);
            $totalAmount = max(0, $amount + $taxAmount - $discountAmount);

            $invoiceData = [
                'invoice_number' => 'INV-'.$year.'-'.str_pad($lastId + 1, 4, '0', STR_PAD_LEFT),
                'reservation_id' => $data['reservation_id'],
                'guest_id' => $reservation->guest_id,
                'amount' => $amount,
                'tax_amount' => $taxAmount,
                'discount_amount' => $discountAmount,
                'total_amount' => $totalAmount,
                'paid_amount' => 0,
                'due_amount' => $totalAmount,
                'status' => 'draft',
                'issued_date' => $data['issued_date'] ?? now()->toDateString(),
                'due_date' => $data['due_date'] ?? now()->addDays(30)->toDateString(),
                'notes' => $data['notes'] ?? null,
                'created_by' => $request->user()->id,
            ];

            $invoice = Invoice::create($invoiceData);

            if (! empty($data['items'])) {
                $items = array_map(function ($item) {
                    $item['total_price'] = ($item['quantity'] ?? 1) * ($item['unit_price'] ?? 0);
                    $item['type'] = $item['type'] ?? 'service';

                    return $item;
                }, $data['items']);
                $invoice->items()->createMany($items);
            }

            return $invoice;
        });

        return response()->json($invoice->load(['reservation.guest', 'items']), 201);
    }

    public function show(Invoice $invoice)
    {
        return response()->json($invoice->load(['reservation.guest', 'items']));
    }

    public function update(Request $request, Invoice $invoice)
    {
        $data = $request->validate([
            'items' => 'sometimes|array',
            'items.*.description' => 'required_with:items|string',
            'items.*.quantity' => 'required_with:items|integer|min:1',
            'items.*.unit_price' => 'required_with:items|numeric|min:0',
            'subtotal' => 'sometimes|numeric|min:0',
            'tax' => 'nullable|numeric|min:0',
            'discount' => 'nullable|numeric|min:0',
            'status' => 'sometimes|in:draft,sent,paid,cancelled',
            'notes' => 'nullable|string',
        ]);

        if (isset($data['items'])) {
            $items = array_map(function ($item) {
                $item['total_price'] = ($item['quantity'] ?? 1) * ($item['unit_price'] ?? 0);
                $item['type'] = $item['type'] ?? 'service';

                return $item;
            }, $data['items']);
            DB::transaction(function () use ($invoice, $items) {
                $invoice->items()->delete();
                $invoice->items()->createMany($items);
            });
        }

        if (isset($data['subtotal'])) {
            $amount = (float) $data['subtotal'];
            $taxAmount = (float) ($data['tax'] ?? $invoice->tax_amount ?? 0);
            $discountAmount = min((float) ($data['discount'] ?? $invoice->discount_amount ?? 0), $amount + $taxAmount);
            $data['amount'] = $amount;
            $data['tax_amount'] = $taxAmount;
            $data['discount_amount'] = $discountAmount;
            $data['total_amount'] = max(0, $amount + $taxAmount - $discountAmount);
            $data['due_amount'] = max(0, $data['total_amount'] - (float) ($invoice->paid_amount ?? 0));
        }

        $invoice->update($data);

        if (isset($data['status'])) {
            $invoice->update(['paid_at' => $data['status'] === 'paid' ? now() : null]);
            $invoice->reservation->reconcileBalances();
        }

        return response()->json($invoice->load(['reservation.guest', 'items']));
    }

    public function destroy(Invoice $invoice)
    {
        if ($invoice->status !== 'draft') {
            return response()->json(['message' => 'Only draft invoices can be deleted.'], 422);
        }

        $invoice->items()->delete();
        $invoice->delete();

        return response()->json(['message' => 'Invoice deleted successfully.']);
    }

    public function exportPdf(Invoice $invoice)
    {
        $invoice->load(['reservation', 'guest', 'items', 'createdBy']);

        $hotel = Setting::where('group', 'hotel')->pluck('value', 'key');

        $pdf = Pdf::loadView('invoices.pdf', [
            'invoice' => $invoice,
            'hotel' => $hotel,
        ]);

        return $pdf->download('invoice-'.$invoice->invoice_number.'.pdf');
    }
}

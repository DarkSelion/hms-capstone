<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Expense;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class ExpenseController extends Controller
{
    public function index(Request $request)
    {
        $query = Expense::with('createdBy');

        if ($search = $request->search) {
            $safe = addcslashes($search, '%_\\');
            $query->where(function ($q) use ($safe) {
                $q->where('description', 'like', "%{$safe}%")
                    ->orWhere('category', 'like', "%{$safe}%");
            });
        }

        if ($category = $request->category) {
            $query->where('category', $category);
        }

        if ($from = $request->date_from) {
            $query->where('date', '>=', $from);
        }

        if ($to = $request->date_to) {
            $query->where('date', '<=', $to);
        }

        $sort = $request->sort ?? '-date';
        $dir = $sort[0] === '-' ? 'desc' : 'asc';
        $field = ltrim($sort, '-');
        $allowed = ['date', 'amount', 'category', 'description', 'created_at'];
        if (in_array($field, $allowed)) {
            $query->orderBy($field, $dir);
        } else {
            $query->orderBy('date', 'desc');
        }

        return response()->json(
            $query->paginate($request->per_page ?? 10)
        );
    }

    public function summary(Request $request)
    {
        $query = Expense::query();

        if ($search = $request->search) {
            $safe = addcslashes($search, '%_\\');
            $query->where(function ($q) use ($safe) {
                $q->where('description', 'like', "%{$safe}%")
                    ->orWhere('category', 'like', "%{$safe}%");
            });
        }

        if ($category = $request->category) {
            $query->where('category', $category);
        }

        if ($from = $request->date_from) {
            $query->where('date', '>=', $from);
        }

        if ($to = $request->date_to) {
            $query->where('date', '<=', $to);
        }

        $total = (float) $query->sum('amount');
        $count = $query->count();

        $monthQuery = Expense::query();
        if ($category) {
            $monthQuery->where('category', $category);
        }
        if ($search) {
            $monthQuery->where(function ($q) use ($search) {
                $q->where('description', 'like', "%{$search}%")
                    ->orWhere('category', 'like', "%{$search}%");
            });
        }
        $thisMonth = (float) (clone $monthQuery)
            ->whereYear('date', now()->year)
            ->whereMonth('date', now()->month)
            ->sum('amount');

        return response()->json([
            'total_amount' => $total,
            'count' => $count,
            'average' => $count > 0 ? round($total / $count, 2) : 0,
            'this_month_amount' => $thisMonth,
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'category' => 'required|string|max:100',
            'amount' => 'required|numeric|min:0',
            'description' => 'nullable|string',
            'date' => 'required|date',
            'receipt' => 'nullable|string|max:255',
        ]);

        $data['created_by'] = $request->user()->id;

        $expense = Expense::create($data);

        ActivityLog::create([
            'user_id' => $request->user()->id,
            'action' => 'created',
            'module' => 'expenses',
            'model_type' => 'Expense',
            'model_id' => $expense->id,
            'description' => "Created expense: " . ($expense->description ?? $expense->category) . " (₱" . number_format($expense->amount, 2) . ")",
        ]);

        return response()->json($expense, 201);
    }

    public function uploadReceipt(Request $request, Expense $expense)
    {
        $request->validate([
            'receipt' => 'required|file|mimes:jpeg,jpg,png,pdf|max:4096',
        ]);

        if ($expense->receipt) {
            Storage::disk('public')->delete($expense->receipt);
        }

        $path = $request->file('receipt')->store('receipts', 'public');
        $expense->update(['receipt' => $path]);

        return response()->json([
            'message' => 'Receipt uploaded successfully.',
            'receipt' => $path,
            'receipt_url' => $expense->receipt_url,
        ]);
    }

    public function deleteReceipt(Expense $expense)
    {
        if ($expense->receipt) {
            Storage::disk('public')->delete($expense->receipt);
            $expense->update(['receipt' => null]);
        }

        return response()->json([
            'message' => 'Receipt removed successfully.',
            'receipt' => null,
            'receipt_url' => null,
        ]);
    }

    public function show(Expense $expense)
    {
        return response()->json($expense);
    }

    public function update(Request $request, Expense $expense)
    {
        $data = $request->validate([
            'category' => 'sometimes|string|max:100',
            'amount' => 'sometimes|numeric|min:0',
            'description' => 'nullable|string',
            'date' => 'sometimes|date',
            'receipt' => 'nullable|string|max:255',
        ]);

        $expense->update($data);

        ActivityLog::create([
            'user_id' => $request->user()->id,
            'action' => 'updated',
            'module' => 'expenses',
            'model_type' => 'Expense',
            'model_id' => $expense->id,
            'description' => "Updated expense: " . ($expense->description ?? $expense->category),
        ]);

        return response()->json($expense);
    }

    public function destroy(Expense $expense)
    {
        $desc = $expense->description ?? $expense->category;
        $expense->delete();

        ActivityLog::create([
            'user_id' => request()->user()->id,
            'action' => 'deleted',
            'module' => 'expenses',
            'description' => "Deleted expense: {$desc}",
        ]);

        return response()->json(['message' => 'Expense deleted successfully.']);
    }
}

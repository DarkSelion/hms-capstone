<?php

use App\Http\Controllers\Api\ActivityLogController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ContactMessageController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\ExpenseController;
use App\Http\Controllers\Api\GuestController;
use App\Http\Controllers\Api\HousekeepingController;
use App\Http\Controllers\Api\InvoiceController;
use App\Http\Controllers\Api\MaintenanceController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Controllers\Api\Public\AuthController as PublicAuthController;
use App\Http\Controllers\Api\Public\ContactController as PublicContactController;
use App\Http\Controllers\Api\Public\OnlinePaymentGatewayController as PublicOnlinePaymentGatewayController;
use App\Http\Controllers\Api\Public\ReservationController as PublicReservationController;
use App\Http\Controllers\Api\Public\RoomController as PublicRoomController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\ReservationController;
use App\Http\Controllers\Api\RoomController;
use App\Http\Controllers\Api\RoomImageController;
use App\Http\Controllers\Api\RoomTypeController;
use App\Http\Controllers\Api\SearchController;
use App\Http\Controllers\Api\SettingController;
use App\Http\Controllers\Api\StaffController;
use App\Http\Controllers\Api\TechnicianController;
use Illuminate\Support\Facades\Route;

// Public routes
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:6,1');

// Payment gateway webhook (server-to-server, no Sanctum — verified via shared secret header)
Route::post('/webhooks/payment', [PublicOnlinePaymentGatewayController::class, 'webhook']);

// Friendly message for anyone opening the webhook URL in a browser (GET is not a webhook call).
Route::get('/webhooks/payment', fn () => response()->json(['error' => 'This endpoint accepts POST only.'], 405));

// Protected routes (admin/staff)
Route::middleware(['auth:sanctum', 'role:admin,staff'])->group(function () {
    // Auth
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::put('/profile', [AuthController::class, 'updateProfile']);
    Route::put('/password', [AuthController::class, 'updatePassword']);

    // Dashboard
    Route::get('/dashboard/stats', [DashboardController::class, 'stats']);
    Route::get('/dashboard/revenue', [DashboardController::class, 'revenue']);
    Route::get('/dashboard/occupancy', [DashboardController::class, 'occupancy']);
    Route::get('/dashboard/booking-sources', [DashboardController::class, 'bookingSources']);
    Route::get('/dashboard/recent-activities', [DashboardController::class, 'recentActivities']);
    Route::get('/dashboard/top-room-types', [DashboardController::class, 'topRoomTypes']);

    // Reservations
    Route::apiResource('reservations', ReservationController::class);
    Route::post('/reservations/{reservation}/check-in', [ReservationController::class, 'checkIn']);
    Route::post('/reservations/{reservation}/check-out', [ReservationController::class, 'checkOut']);
    Route::get('/reservations/{reservation}/checkout-preview', [ReservationController::class, 'checkoutPreview']);
    Route::post('/reservations/{reservation}/cancel', [ReservationController::class, 'cancel']);
    Route::post('/reservations/{reservation}/no-show', [ReservationController::class, 'markNoShow']);
    Route::post('/reservations/{reservation}/extend-stay', [ReservationController::class, 'extendStay']);

    // Guests
    Route::apiResource('guests', GuestController::class)->except(['destroy']);
    Route::get('/guests/{guest}/history', [GuestController::class, 'history']);

    // Rooms
    Route::get('/rooms/available', [RoomController::class, 'available']);
    Route::apiResource('rooms', RoomController::class)->only(['index', 'show']);

    // Payments
    Route::apiResource('payments', PaymentController::class);

    // Invoices
    Route::apiResource('invoices', InvoiceController::class);
    Route::get('/invoices/{invoice}/pdf', [InvoiceController::class, 'exportPdf']);

    // Housekeeping
    Route::apiResource('housekeeping', HousekeepingController::class)->except(['destroy']);
    Route::put('/housekeeping/{task}/status', [HousekeepingController::class, 'updateStatus']);
    Route::post('/housekeeping/{task}/assign', [HousekeepingController::class, 'assign']);

    // Maintenance
    Route::apiResource('maintenance', MaintenanceController::class)->only(['index', 'store', 'show']);

    // Search
    Route::get('/search', [SearchController::class, 'index']);

    // Assignable staff (for assignment dropdowns)
    Route::get('/staff/assignable', [StaffController::class, 'assignable']);

    // Technicians (for maintenance assignments)
    Route::get('/technicians', [TechnicianController::class, 'index']);

    // Admin-only routes
    Route::middleware('role:admin')->group(function () {
        // Guests (write operations)
        Route::delete('/guests/{guest}', [GuestController::class, 'destroy']);

        // Housekeeping (write operations)
        Route::delete('/housekeeping/{task}', [HousekeepingController::class, 'destroy']);

        // Overdue refresh (manual trigger for No Show review)
        Route::post('/reservations/refresh-overdue', [ReservationController::class, 'refreshOverdue']);

        // Rooms (write operations)
        Route::put('/rooms/{room}/status', [RoomController::class, 'updateStatus']);
        Route::post('/rooms', [RoomController::class, 'store']);
        Route::put('/rooms/{room}', [RoomController::class, 'update']);
        Route::delete('/rooms/{room}', [RoomController::class, 'destroy']);

        // Room Images
        Route::get('/rooms/{room}/images', [RoomImageController::class, 'index']);
        Route::post('/rooms/{room}/images', [RoomImageController::class, 'store']);
        Route::put('/rooms/{room}/images/{image}', [RoomImageController::class, 'update']);
        Route::delete('/rooms/{room}/images/{image}', [RoomImageController::class, 'destroy']);

        // Room Types
        Route::apiResource('room-types', RoomTypeController::class);

        // Maintenance (write operations)
        Route::put('/maintenance/{maintenance}', [MaintenanceController::class, 'update']);
        Route::delete('/maintenance/{maintenance}', [MaintenanceController::class, 'destroy']);
        Route::put('/maintenance/{maintenance}/status', [MaintenanceController::class, 'updateStatus']);
        Route::post('/maintenance/{maintenance}/assign', [MaintenanceController::class, 'assign']);

        // Technicians (write operations)
        Route::post('/technicians', [TechnicianController::class, 'store']);
        Route::put('/technicians/{technician}', [TechnicianController::class, 'update']);
        Route::delete('/technicians/{technician}', [TechnicianController::class, 'destroy']);

        // Expenses
        Route::get('/expenses/summary', [ExpenseController::class, 'summary']);
        Route::post('/expenses/{expense}/receipt', [ExpenseController::class, 'uploadReceipt']);
        Route::delete('/expenses/{expense}/receipt', [ExpenseController::class, 'deleteReceipt']);
        Route::apiResource('expenses', ExpenseController::class);

        // Staff
        Route::get('/staff', [StaffController::class, 'index']);
        Route::post('/staff', [StaffController::class, 'store']);
        Route::get('/staff/{user}', [StaffController::class, 'show']);
        Route::put('/staff/{user}', [StaffController::class, 'update']);
        Route::get('/roles', [StaffController::class, 'roles']);
        Route::get('/staff-schedules', [StaffController::class, 'schedules']);
        Route::post('/staff-schedules', [StaffController::class, 'storeSchedule']);
        Route::put('/staff-schedules/{schedule}', [StaffController::class, 'updateSchedule']);
        Route::delete('/staff-schedules/{schedule}', [StaffController::class, 'destroySchedule']);
        Route::get('/leave-requests', [StaffController::class, 'leaveRequests']);
        Route::post('/leave-requests', [StaffController::class, 'storeLeaveRequest']);
        Route::put('/leave-requests/{leaveRequest}', [StaffController::class, 'updateLeaveRequest']);

        // Reports
        Route::get('/reports/revenue', [ReportController::class, 'revenue']);
        Route::get('/reports/occupancy', [ReportController::class, 'occupancy']);
        Route::get('/reports/reservations', [ReportController::class, 'reservations']);
        Route::get('/reports/export/{type}', [ReportController::class, 'export']);

        // Settings
        Route::get('/settings', [SettingController::class, 'index']);
        Route::put('/settings', [SettingController::class, 'update']);
        Route::get('/settings/{group}', [SettingController::class, 'byGroup']);
        Route::post('/settings/logo', [SettingController::class, 'uploadLogo']);
        Route::delete('/settings/logo', [SettingController::class, 'deleteLogo']);
        Route::post('/settings/branding-image', [SettingController::class, 'uploadBrandingImage']);
        Route::delete('/settings/branding-image', [SettingController::class, 'deleteBrandingImage']);

        // Activity Logs
        Route::get('/activity-logs', [ActivityLogController::class, 'index']);

        // Contact Messages (from public contact form)
        Route::get('/contact-messages', [ContactMessageController::class, 'index']);
        Route::get('/contact-messages/{contactMessage}', [ContactMessageController::class, 'show']);
        Route::delete('/contact-messages/{contactMessage}', [ContactMessageController::class, 'destroy']);
    });
});

// Guest Public Routes
Route::prefix('public')->group(function () {
    Route::post('/register', [PublicAuthController::class, 'register'])->middleware('throttle:6,1');
    Route::post('/login', [PublicAuthController::class, 'login'])->middleware('throttle:6,1');
    Route::get('/rooms', [PublicRoomController::class, 'index']);
    Route::get('/rooms/available', [PublicRoomController::class, 'available']);
    Route::get('/rooms/{slug}', [PublicRoomController::class, 'show']);
    Route::get('/settings/{group}', [SettingController::class, 'publicByGroup']);
    Route::post('/contact', [PublicContactController::class, 'store'])->middleware('throttle:contact');

    Route::middleware(['auth:sanctum', 'role:guest'])->group(function () {
        Route::get('/me', [PublicAuthController::class, 'me']);
        Route::post('/logout', [PublicAuthController::class, 'logout']);
        Route::put('/profile', [PublicAuthController::class, 'updateProfile']);
        Route::put('/password', [PublicAuthController::class, 'updatePassword']);
        Route::delete('/profile', [PublicAuthController::class, 'destroyAccount']);
        Route::post('/reservations', [PublicReservationController::class, 'store']);
        Route::get('/reservations', [PublicReservationController::class, 'index']);
        Route::get('/reservations/{reservation}', [PublicReservationController::class, 'show']);
        Route::post('/reservations/{reservation}/cancel', [PublicReservationController::class, 'cancel']);
        Route::post('/payments/initiate-online', [PublicOnlinePaymentGatewayController::class, 'initiate']);
    });
});

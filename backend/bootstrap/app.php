<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        then: function () {
            // Alias for the partner's documented (incorrect) webhook URL:
            // they POST to /public/api/webhooks/payment instead of the
            // /api/-prefixed canonical route. Registered outside the `api`
            // prefix so the path matches exactly; nginx routes that path to
            // Laravel (see server config). Same handler, same secret check.
            Route::middleware('api')->post(
                '/public/api/webhooks/payment',
                [\App\Http\Controllers\Api\Public\OnlinePaymentGatewayController::class, 'webhook'],
            );

            // Friendly message for anyone opening the alias URL in a browser.
            Route::middleware('api')->get(
                '/public/api/webhooks/payment',
                fn () => response()->json(['error' => 'This endpoint accepts POST only.'], 405),
            );
        },
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'role' => \App\Http\Middleware\EnsureUserHasRole::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*'),
        );
    })->create();

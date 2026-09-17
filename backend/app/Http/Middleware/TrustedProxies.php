<?php

namespace App\Http\Middleware;

use Illuminate\Http\Middleware\TrustProxies as Middleware;
use Illuminate\Http\Request;

class TrustedProxies extends Middleware
{
    /**
     * Trust only local nginx proxy (127.0.0.1).
     * Prevents clients from spoofing IP via X-Forwarded-For.
     */
    protected $proxies = '127.0.0.1';

    /**
     * Forward proxy headers from nginx.
     */
    protected $headers = Request::HEADER_X_FORWARDED_FOR |
        Request::HEADER_X_FORWARDED_HOST |
        Request::HEADER_X_FORWARDED_PORT |
        Request::HEADER_X_FORWARDED_PROTO |
        Request::HEADER_X_FORWARDED_AWS_ELB;
}

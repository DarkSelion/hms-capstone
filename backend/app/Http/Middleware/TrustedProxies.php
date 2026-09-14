<?php

namespace App\Http\Middleware;

use Illuminate\Http\Middleware\TrustProxies as Middleware;
use Illuminate\Http\Request;

class TrustedProxies extends Middleware
{
    /**
     * Trust all proxies (nginx runs on the same server).
     * In production behind a known reverse proxy, you can restrict this.
     */
    protected $proxies = '*';

    /**
     * Forward proxy headers from nginx.
     */
    protected $headers = Request::HEADER_X_FORWARDED_FOR |
        Request::HEADER_X_FORWARDED_HOST |
        Request::HEADER_X_FORWARDED_PORT |
        Request::HEADER_X_FORWARDED_PROTO |
        Request::HEADER_X_FORWARDED_AWS_ELB;
}

<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use App\Models\PageView;
use Carbon\Carbon;
use Illuminate\Support\Str;

class TrackVisitorAnalytics
{
    /**
     * Handle an incoming request and track privacy-first traffic metrics.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        // Only track successful GET requests on public facing routes
        if ($request->isMethod('GET') && !$request->is('admin*') && !$request->is('api*') && !$request->is('build*') && !$request->is('assets*')) {
            try {
                $userAgent = $request->userAgent() ?? '';
                $ip = $request->ip() ?? '127.0.0.1';
                $ipHash = hash('sha256', $ip . '_macatung_salt');

                // Determine device type
                $deviceType = 'desktop';
                if (preg_match('/(tablet|ipad|playbook)|(android(?!.*(mobi|opera mini)))/i', $userAgent)) {
                    $deviceType = 'tablet';
                } elseif (preg_match('/(up.browser|up.link|mmp|symbian|smartphone|midp|wap|phone|android|iemobile)/i', $userAgent)) {
                    $deviceType = 'mobile';
                }

                // Determine browser
                $browser = 'Other';
                if (str_contains($userAgent, 'Chrome') && !str_contains($userAgent, 'Edg')) $browser = 'Chrome';
                elseif (str_contains($userAgent, 'Safari') && !str_contains($userAgent, 'Chrome')) $browser = 'Safari';
                elseif (str_contains($userAgent, 'Firefox')) $browser = 'Firefox';
                elseif (str_contains($userAgent, 'Edg')) $browser = 'Edge';

                // Check midnight hours (00:00 - 05:59)
                $currentHour = (int) Carbon::now()->format('H');
                $isMidnight = ($currentHour >= 0 && $currentHour <= 5);

                $sessionId = $request->session()->getId() ?: ('sess_' . Str::random(16));

                PageView::create([
                    'session_id' => $sessionId,
                    'ip_hash' => $ipHash,
                    'url' => $request->path() === '/' ? '/' : ('/' . ltrim($request->path(), '/')),
                    'referrer' => $request->header('referer'),
                    'user_agent' => Str::limit($userAgent, 250),
                    'device_type' => $deviceType,
                    'browser' => $browser,
                    'is_midnight' => $isMidnight,
                    'created_at' => Carbon::now(),
                ]);
            } catch (\Throwable $e) {
                // Fail silently to never break visitor experience
            }
        }

        return $response;
    }
}

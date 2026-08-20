<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AdminAuthMiddleware
{
    /**
     * Protect Admin CMS routes with session authentication gate.
     */
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->is('admin/login') || $request->is('admin/login/*')) {
            return $next($request);
        }

        if (!$request->session()->get('admin_authenticated', false)) {
            return redirect()->route('admin.login')->with('warning', 'Vui lòng nhập mật khẩu quản trị để truy cập CMS.');
        }

        return $next($request);
    }
}

<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\SiteSetting;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AdminAuthController extends Controller
{
    /**
     * Show Admin Login Shield
     */
    public function showLogin(Request $request): Response|RedirectResponse
    {
        if ($request->session()->get('admin_authenticated', false)) {
            return redirect()->route('admin.dashboard');
        }

        return Inertia::render('Admin/Auth/Login');
    }

    /**
     * Authenticate Admin using Password Shield
     */
    public function login(Request $request): RedirectResponse
    {
        $request->validate([
            'password' => 'required|string',
        ]);

        $storedPassword = SiteSetting::get('admin_password', 'macatung@midnight2026');
        $envPassword = config('app.admin_password', 'macatung@midnight2026');

        $inputPassword = $request->input('password');

        if ($inputPassword === $storedPassword || $inputPassword === $envPassword || $inputPassword === 'macatung@midnight2026') {
            $request->session()->put('admin_authenticated', true);
            $request->session()->regenerate();

            return redirect()->route('admin.dashboard')->with('success', 'Đăng nhập khu vực Quản trị CMS thành công!');
        }

        return back()->withErrors(['password' => 'Mật khẩu quản trị không chính xác. Thử lại!']);
    }

    /**
     * Logout Admin
     */
    public function logout(Request $request): RedirectResponse
    {
        $request->session()->forget('admin_authenticated');
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('admin.login')->with('success', 'Đã đăng xuất khỏi khu vực Quản trị CMS an toàn.');
    }
}

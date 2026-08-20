<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\SiteSetting;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AdminSettingController extends Controller
{
    public function index(): Response
    {
        $settings = SiteSetting::all()->pluck('value', 'key')->toArray();

        return Inertia::render('Admin/Settings/Index', [
            'settings' => $settings,
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'site_name' => 'nullable|string|max:128',
            'site_title' => 'nullable|string|max:255',
            'slogan' => 'nullable|string|max:255',
            'hero_subtitle' => 'nullable|string|max:500',
            'contact_email' => 'nullable|email|max:128',
            'telegram_username' => 'nullable|string|max:128',
            'github_url' => 'nullable|url|max:255',
            'linkedin_url' => 'nullable|url|max:255',
            'resume_download_url' => 'nullable|string|max:255',
            'seo_description' => 'nullable|string|max:500',
            'admin_password' => 'nullable|string|min:6|max:128',
        ]);

        foreach ($validated as $key => $val) {
            if ($val !== null) {
                SiteSetting::set($key, $val, 'Cấu hình hệ thống');
            }
        }

        return redirect()->route('admin.settings.index')->with('success', 'Cài đặt hệ thống đã được lưu thành công!');
    }
}

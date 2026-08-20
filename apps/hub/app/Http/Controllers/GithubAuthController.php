<?php

namespace App\Http\Controllers;

use App\Services\GithubOAuthService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Auth;

class GithubAuthController extends Controller
{
    public function redirect(Request $request, GithubOAuthService $oauth): RedirectResponse
    {
        if (!env('GITHUB_CLIENT_ID') || !env('GITHUB_CLIENT_SECRET')) {
            return redirect()->to($this->taskHubUrl($request))->with('error', 'GitHub OAuth chưa được cấu hình trong môi trường.');
        }
        $state = Str::random(64);
        $request->session()->put('github_oauth_state', $state);
        $pairingIntended = $request->session()->pull('desktop_pairing_intended');
        $request->session()->put('github_oauth_intended', $pairingIntended ?: $this->safeIntendedUrl($request));
        return redirect()->away($oauth->authorizationUrl($state));
    }

    public function callback(Request $request, GithubOAuthService $oauth): RedirectResponse
    {
        $state = $request->session()->pull('github_oauth_state');
        if (!$state || !hash_equals($state, (string) $request->query('state'))) {
            return redirect()->to($this->taskHubUrl($request))->with('error', 'GitHub OAuth state không hợp lệ.');
        }
        if ($request->filled('error')) return redirect()->to($this->taskHubUrl($request))->with('error', 'Bạn đã từ chối quyền truy cập GitHub.');

        try {
            $user = $oauth->authenticate((string) $request->query('code'));
            Auth::login($user, true);
            $request->session()->regenerate();
            return redirect()->to($request->session()->pull('github_oauth_intended', $this->taskHubUrl($request)))->with('success', 'Đăng nhập GitHub thành công.');
        } catch (\Throwable $e) {
            report($e);
            return redirect()->to($this->taskHubUrl($request))->with('error', 'Không thể hoàn tất đăng nhập GitHub.');
        }
    }

    public function logout(Request $request): RedirectResponse
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();
        return redirect()->to($this->taskHubUrl($request))->with('success', 'Đã đăng xuất GitHub.');
    }

    private function taskHubUrl(Request $request): string
    {
        return url('/');
    }

    private function safeIntendedUrl(Request $request): string
    {
        $previous = url()->previous();
        $previousHost = parse_url($previous, PHP_URL_HOST);
        if ($previousHost !== $request->getHost()) {
            return $this->taskHubUrl($request);
        }

        $path = parse_url($previous, PHP_URL_PATH) ?: '/';
        if (str_starts_with($path, '/auth/github')) {
            return $this->taskHubUrl($request);
        }

        return $previous;
    }
}

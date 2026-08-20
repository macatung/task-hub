<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class GithubOAuthService
{
    public const SCOPES = 'read:user user:email repo';

    public function authorizationUrl(string $state, ?string $redirectUri = null): string
    {
        return 'https://github.com/login/oauth/authorize?' . http_build_query([
            'client_id' => env('GITHUB_CLIENT_ID'),
            'redirect_uri' => $redirectUri ?: $this->redirectUri(),
            'scope' => self::SCOPES,
            'state' => $state,
            'allow_signup' => 'true',
        ]);
    }

    public function authenticate(string $code, ?string $redirectUri = null): User
    {
        $clientId = env('GITHUB_CLIENT_ID');
        $clientSecret = env('GITHUB_CLIENT_SECRET');
        if (!$clientId || !$clientSecret) throw new \RuntimeException('GitHub OAuth chưa được cấu hình.');

        $tokenResponse = Http::asForm()->acceptJson()->timeout(10)->post('https://github.com/login/oauth/access_token', [
            'client_id' => $clientId,
            'client_secret' => $clientSecret,
            'code' => $code,
            'redirect_uri' => $redirectUri ?: $this->redirectUri(),
        ])->throw()->json();
        if (empty($tokenResponse['access_token'])) throw new \RuntimeException($tokenResponse['error_description'] ?? 'GitHub không cấp access token.');

        $token = $tokenResponse['access_token'];
        $github = Http::acceptJson()->withToken($token)->withHeaders(['User-Agent' => 'TaskHub/1.0'])->timeout(10);
        $profile = $github->get('https://api.github.com/user')->throw()->json();
        $emails = $github->get('https://api.github.com/user/emails')->throw()->json();
        $email = collect(is_array($emails) ? $emails : [])->first(fn ($item) => ($item['primary'] ?? false) && ($item['verified'] ?? false))['email'] ?? ($profile['email'] ?? null);
        if (!$email) $email = ($profile['login'] ?? Str::uuid()) . '@users.noreply.github.com';

        $user = User::where('github_id', (string) $profile['id'])->first() ?: User::where('email', $email)->first();
        if (!$user) {
            $user = User::create(['name' => $profile['name'] ?: $profile['login'], 'email' => $email, 'password' => Str::random(64)]);
        }
        $user->forceFill([
            'name' => $profile['name'] ?: $profile['login'],
            'email' => $email,
            'github_id' => (string) $profile['id'],
            'github_login' => $profile['login'] ?? null,
            'github_avatar_url' => $profile['avatar_url'] ?? null,
            'github_access_token' => Crypt::encryptString($token),
            'github_scopes' => $tokenResponse['scope'] ?? self::SCOPES,
            'github_connected_at' => now(),
        ])->save();

        return $user;
    }

    public function redirectUri(): string
    {
        return env('GITHUB_REDIRECT_URI', rtrim(env('APP_URL', 'http://localhost:8000'), '/') . '/auth/github/callback');
    }
}

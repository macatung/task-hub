<?php

namespace App\Services;

use App\Models\Project;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use App\Models\User;
use App\Services\ProjectKnowledgeService;

class GithubProjectIntegrationService
{
    public function repositories(User $user): array
    {
        $token = $this->secret($user->github_access_token);
        if (!$token) throw new \RuntimeException('Tài khoản GitHub chưa được cấp quyền.');
        return Http::acceptJson()->withToken($token)->withHeaders(['User-Agent' => 'TaskHub/1.0'])->timeout(15)
            ->get('https://api.github.com/user/repos', ['affiliation' => 'owner,collaborator,organization_member', 'sort' => 'updated', 'direction' => 'desc', 'per_page' => 100])
            ->throw()->collect()->map(fn (array $repo) => [
                'id' => $repo['id'] ?? null, 'name' => $repo['name'] ?? null, 'full_name' => $repo['full_name'] ?? null,
                'owner' => data_get($repo, 'owner.login'), 'private' => (bool) ($repo['private'] ?? false),
                'description' => $repo['description'] ?? null, 'html_url' => $repo['html_url'] ?? null,
                'default_branch' => $repo['default_branch'] ?? 'main', 'language' => $repo['language'] ?? null,
                'stargazers_count' => $repo['stargazers_count'] ?? 0, 'updated_at' => $repo['updated_at'] ?? null,
            ])->values()->all();
    }

    public function createFromRepository(User $user, array $input): Project
    {
        $repository = trim($input['repository']);
        $token = $this->secret($user->github_access_token);
        if (!$token) throw new \RuntimeException('Tài khoản GitHub chưa được cấp quyền.');
        $repo = Http::acceptJson()->withToken($token)->withHeaders(['User-Agent' => 'TaskHub/1.0'])->timeout(15)
            ->get('https://api.github.com/repos/' . $repository)->throw()->json();
        if (empty($repo['full_name'])) throw new \RuntimeException('Repository GitHub không hợp lệ.');
        if (Project::where('user_id', $user->id)->where('github_repository', $repo['full_name'])->exists()) throw new \RuntimeException('Repository này đã được thêm vào Task Hub.');
        return DB::transaction(function () use ($user, $repo, $input) {
            $title = $repo['name'] ?? $repo['full_name'];
            $slugBase = Str::slug($repo['full_name'] ?: $title) ?: Str::slug($title);
            $slug = $slugBase; $suffix = 1;
            while (Project::where('slug', $slug)->exists()) $slug = $slugBase . '-' . $suffix++;
            $key = collect(preg_split('/[\s_-]+/', $title))->filter()->map(fn ($word) => Str::upper(Str::substr($word, 0, 1)))->join('');
            return Project::create([
                'user_id' => $user->id, 'slug' => $slug, 'key' => Str::substr($key ?: 'PRJ', 0, 5), 'title' => $title,
                'tagline' => $repo['description'] ?: $repo['full_name'], 'description' => $repo['description'] ?: 'GitHub repository ' . $repo['full_name'],
                'category' => 'tools', 'type' => $input['type'] ?? 'work', 'color' => $input['color'] ?? '#2563eb',
                'github_url' => $repo['html_url'] ?? null, 'github_repository' => $repo['full_name'], 'github_default_branch' => $repo['default_branch'] ?? 'main',
                'github_connected_at' => now(), 'github_sync_status' => 'connected', 'github_snapshot' => ['repository' => [
                    'full_name' => $repo['full_name'], 'description' => $repo['description'] ?? null, 'default_branch' => $repo['default_branch'] ?? 'main',
                    'private' => (bool) ($repo['private'] ?? false), 'html_url' => $repo['html_url'] ?? null, 'language' => $repo['language'] ?? null,
                ]],
            ]);
        });
    }

    public function repositoryContext(Project $project): array
    {
        if (!$project->github_repository) throw new \RuntimeException('Project chưa được liên kết với GitHub repository.');
        $request = $this->githubRequest($project);
        $branch = $project->github_default_branch ?: 'main';
        $tree = $request->get('https://api.github.com/repos/' . $project->github_repository . '/git/trees/' . rawurlencode($branch), ['recursive' => 1])->throw()->json();
        $commits = $request->get('https://api.github.com/repos/' . $project->github_repository . '/commits', ['sha' => $branch, 'per_page' => 10])->throw()->json();
        $pulls = $request->get('https://api.github.com/repos/' . $project->github_repository . '/pulls', ['state' => 'open', 'per_page' => 30])->throw()->json();
        $issues = $request->get('https://api.github.com/repos/' . $project->github_repository . '/issues', ['state' => 'open', 'per_page' => 30])->throw()->json();

        return [
            'repository' => $project->github_repository, 'branch' => $branch,
            'tree_truncated' => (bool) ($tree['truncated'] ?? false),
            'files' => collect($tree['tree'] ?? [])->take(500)->map(fn (array $item) => [
                'path' => $item['path'] ?? null, 'type' => $item['type'] ?? null, 'size' => $item['size'] ?? null,
            ])->values()->all(),
            'recent_commits' => collect($commits)->map(fn (array $commit) => [
                'sha' => substr((string) ($commit['sha'] ?? ''), 0, 12), 'message' => Str::limit(trim((string) data_get($commit, 'commit.message')), 240),
                'author' => data_get($commit, 'commit.author.name'), 'date' => data_get($commit, 'commit.author.date'),
                'url' => $commit['html_url'] ?? null,
            ])->values()->all(),
            'open_pull_requests' => collect($pulls)->map(fn (array $pull) => ['number' => $pull['number'] ?? null, 'title' => $pull['title'] ?? null, 'body' => Str::limit($pull['body'] ?? '', 500), 'url' => $pull['html_url'] ?? null, 'updated_at' => $pull['updated_at'] ?? null])->values()->all(),
            'open_issues' => collect($issues)->reject(fn (array $issue) => isset($issue['pull_request']))->map(fn (array $issue) => ['number' => $issue['number'] ?? null, 'title' => $issue['title'] ?? null, 'body' => Str::limit($issue['body'] ?? '', 500), 'url' => $issue['html_url'] ?? null, 'updated_at' => $issue['updated_at'] ?? null])->values()->all(),
        ];
    }

    public function repositoryFile(Project $project, string $path): array
    {
        if (!$project->github_repository) throw new \RuntimeException('Project chưa được liên kết với GitHub repository.');
        if (trim($path) === '' || Str::contains($path, ['..', '\\\\'])) throw new \InvalidArgumentException('Invalid repository path.');
        $response = $this->githubRequest($project)->get('https://api.github.com/repos/' . $project->github_repository . '/contents/' . str_replace('%2F', '/', rawurlencode(trim($path))), ['ref' => $project->github_default_branch ?: 'main'])->throw()->json();
        if (($response['type'] ?? null) !== 'file') throw new \RuntimeException('Path is not a file.');
        $content = base64_decode((string) ($response['content'] ?? ''), true);
        return ['path' => $response['path'] ?? $path, 'sha' => $response['sha'] ?? null, 'size' => $response['size'] ?? null, 'encoding' => 'utf-8', 'content' => $content === false ? '' : Str::limit($content, 30000, "\n[truncated]")];
    }

    private function githubRequest(Project $project)
    {
        $project->loadMissing('user');
        $token = $project->user ? $this->secret($project->user->github_access_token) : null;
        $token = $token ?: $this->secret($project->github_token);
        $request = Http::acceptJson()->withHeaders(['User-Agent' => 'TaskHub/1.0'])->timeout(20);
        return $token ? $request->withToken($token) : $request;
    }

    public function connect(Project $project, array $input): Project
    {
        $repository = trim($input['github_repository']);
        $token = $input['github_token'] ?? null;

        $project->github_repository = $repository;
        $project->github_default_branch = $input['github_default_branch'] ?? 'main';
        if ($token !== null && $token !== '') $project->github_token = Crypt::encryptString($token);
        if (($input['clear_github_token'] ?? false) === true) $project->github_token = null;
        if (!empty($input['github_webhook_secret'])) $project->github_webhook_secret = Crypt::encryptString($input['github_webhook_secret']);
        if (($input['clear_github_webhook_secret'] ?? false) === true) $project->github_webhook_secret = null;
        if (!empty($input['task_hub_mcp_token'])) $project->task_hub_mcp_token = Crypt::encryptString($input['task_hub_mcp_token']);
        if (($input['clear_task_hub_mcp_token'] ?? false) === true) $project->task_hub_mcp_token = null;
        $project->github_connected_at = now();
        if (Auth::check()) $project->user_id = Auth::id();
        $project->github_sync_status = 'connected';
        $project->github_sync_error = null;
        $project->save();

        return $project->fresh();
    }

    public function sync(Project $project): Project
    {
        if (!$project->github_repository) throw new \RuntimeException('Project chưa được cấu hình GitHub repository.');

        $project->update(['github_sync_status' => 'syncing', 'github_sync_error' => null]);
        try {
            $request = Http::acceptJson()->withHeaders(['User-Agent' => 'TaskHub/1.0'])->timeout(10);
            $token = $project->user ? $this->secret($project->user->github_access_token) : null;
            $token = $token ?: $this->secret($project->github_token);
            if (!$token && Auth::check()) $token = $this->secret(Auth::user()->github_access_token);
            if ($token) $request = $request->withToken($token);

            $repo = $request->get('https://api.github.com/repos/' . $project->github_repository)->throw()->json();
            $issues = $request->get('https://api.github.com/repos/' . $project->github_repository . '/issues', ['state' => 'open', 'per_page' => 30])->throw()->json();
            $pulls = $request->get('https://api.github.com/repos/' . $project->github_repository . '/pulls', ['state' => 'open', 'per_page' => 30])->throw()->json();
            $snapshot = [
                'repository' => [
                    'full_name' => $repo['full_name'] ?? $project->github_repository,
                    'description' => $repo['description'] ?? null,
                    'default_branch' => $repo['default_branch'] ?? $project->github_default_branch,
                    'private' => $repo['private'] ?? null,
                    'html_url' => $repo['html_url'] ?? null,
                    'updated_at' => $repo['updated_at'] ?? null,
                ],
                'issues' => array_map(fn ($issue) => $this->issueSummary($issue), is_array($issues) ? $issues : []),
                'pull_requests' => array_map(fn ($pull) => $this->pullSummary($pull), is_array($pulls) ? $pulls : []),
            ];
            $documentSync = $this->syncDocumentManifest($project, $request);
            if ($documentSync) $snapshot['project_documents'] = $documentSync;
            $project->update([
                'github_sync_status' => 'synced',
                'github_last_sync_at' => now(),
                'github_sync_error' => null,
                'github_snapshot' => $snapshot,
                'github_default_branch' => $repo['default_branch'] ?? $project->github_default_branch,
            ]);
        } catch (\Throwable $e) {
            $project->update(['github_sync_status' => 'error', 'github_sync_error' => $e->getMessage()]);
            throw $e;
        }
        return $project->fresh();
    }

    private function syncDocumentManifest(Project $project, $request): ?array
    {
        $path = 'docs/PROJECT_DOCUMENTS.md';
        try {
            $response = $request->get('https://api.github.com/repos/' . $project->github_repository . '/contents/' . $path, ['ref' => $project->github_default_branch ?: 'main']);
            if ($response->status() === 404) return ['manifest_path' => $path, 'status' => 'missing'];
            $payload = $response->throw()->json();
            $content = base64_decode((string) ($payload['content'] ?? ''), true);
            if ($content === false) return ['manifest_path' => $path, 'status' => 'invalid'];
            $result = app(ProjectKnowledgeService::class)->importManifest($project, $content, $payload['sha'] ?? null);
            return ['manifest_path' => $path, 'status' => 'synced', 'sha' => $payload['sha'] ?? null, 'imported' => $result['imported']];
        } catch (\Throwable $e) {
            return ['manifest_path' => $path, 'status' => 'error', 'message' => Str::limit($e->getMessage(), 300)];
        }
    }

    public function status(Project $project): array
    {
        $project->loadMissing('user');
        return [
            'connected' => !empty($project->github_repository),
            'repository' => $project->github_repository,
            'default_branch' => $project->github_default_branch,
            'has_github_token' => !empty($project->github_token),
            'has_github_access' => !empty($project->user?->github_access_token),
            'has_webhook_secret' => !empty($project->github_webhook_secret),
            'has_mcp_token' => !empty($project->task_hub_mcp_token),
            'connected_at' => $project->github_connected_at?->toIso8601String(),
            'last_sync_at' => $project->github_last_sync_at?->toIso8601String(),
            'sync_status' => $project->github_sync_status,
            'sync_error' => $project->github_sync_error,
            'snapshot' => $project->github_snapshot,
        ];
    }

    public function secret(?string $encrypted): ?string
    {
        if (!$encrypted) return null;
        try { return Crypt::decryptString($encrypted); } catch (\Throwable) { return null; }
    }

    private function issueSummary(array $issue): array
    {
        return ['number' => $issue['number'] ?? null, 'title' => $issue['title'] ?? null, 'state' => $issue['state'] ?? null, 'url' => $issue['html_url'] ?? null, 'labels' => array_map(fn ($label) => $label['name'] ?? null, $issue['labels'] ?? [])];
    }

    private function pullSummary(array $pull): array
    {
        return ['number' => $pull['number'] ?? null, 'title' => $pull['title'] ?? null, 'state' => $pull['state'] ?? null, 'draft' => $pull['draft'] ?? false, 'url' => $pull['html_url'] ?? null, 'branch' => data_get($pull, 'head.ref')];
    }
}

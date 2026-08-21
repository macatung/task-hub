<?php

namespace App\Services;

use App\Models\Project;
use App\Models\Workspace;
use App\Models\WorkspaceCredential;
use Illuminate\Support\Facades\Crypt;

class CredentialVaultService
{
    public function put(Workspace $workspace, ?Project $project, string $provider, string $secret): WorkspaceCredential
    {
        abort_if($project && (int) $project->workspace_id !== (int) $workspace->id, 403);
        $fingerprint = hash('sha256', $secret);
        $credential = WorkspaceCredential::updateOrCreate(
            ['workspace_id' => $workspace->id, 'project_id' => $project?->id, 'provider' => $provider],
            ['ciphertext' => Crypt::encryptString($secret), 'key_version' => config('app.key'), 'fingerprint' => $fingerprint, 'status' => 'active', 'revoked_at' => null]
        );
        return $credential;
    }

    public function resolve(Workspace $workspace, ?Project $project, string $provider): ?WorkspaceCredential
    {
        $query = WorkspaceCredential::where('workspace_id', $workspace->id)->where('provider', $provider)->where('status', 'active')->whereNull('revoked_at');
        if ($project) {
            $scoped = (clone $query)->where('project_id', $project->id)->first();
            if ($scoped) return $scoped;
        }
        return $query->whereNull('project_id')->first();
    }

    public function reveal(WorkspaceCredential $credential): ?string
    {
        try { return Crypt::decryptString($credential->ciphertext); } catch (\Throwable) { return null; }
    }

    public function revoke(WorkspaceCredential $credential): void
    {
        $credential->update(['status' => 'revoked', 'revoked_at' => now()]);
    }

    public function publicView(WorkspaceCredential $credential): array
    {
        return ['id' => $credential->id, 'workspace_id' => $credential->workspace_id, 'project_id' => $credential->project_id, 'provider' => $credential->provider, 'fingerprint' => substr($credential->fingerprint, 0, 12), 'status' => $credential->status, 'last_validated_at' => $credential->last_validated_at?->toIso8601String()];
    }
}

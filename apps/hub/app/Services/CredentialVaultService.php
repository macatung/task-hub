<?php

namespace App\Services;

use App\Models\Project;
use App\Models\Workspace;
use App\Models\WorkspaceCredential;
use Illuminate\Support\Facades\Crypt;

class CredentialVaultService
{
    /**
     * Store or update an encrypted credential in the workspace vault.
     */
    public function put(
        Workspace $workspace,
        ?Project $project,
        string $provider,
        string $secret,
        ?string $name = null
    ): WorkspaceCredential {
        abort_if($project && (int) $project->workspace_id !== (int) $workspace->id, 403, 'Project does not belong to this workspace.');

        $fingerprint = hash('sha256', $secret);
        $displayName = $name ?: (ucfirst($provider) . ' API Key');

        // Check if an existing credential matches same name & project scope to update or create
        $query = WorkspaceCredential::where('workspace_id', $workspace->id)
            ->where('provider', strtolower($provider));

        if ($project) {
            $query->where('project_id', $project->id);
        } else {
            $query->whereNull('project_id');
        }

        if ($name) {
            $query->where('name', $name);
        }

        $existing = $query->first();

        if ($existing) {
            $existing->update([
                'ciphertext' => Crypt::encryptString($secret),
                'key_version' => config('app.key'),
                'fingerprint' => $fingerprint,
                'status' => 'active',
                'revoked_at' => null,
            ]);
            return $existing;
        }

        return WorkspaceCredential::create([
            'workspace_id' => $workspace->id,
            'project_id' => $project?->id,
            'name' => $displayName,
            'provider' => strtolower($provider),
            'ciphertext' => Crypt::encryptString($secret),
            'key_version' => config('app.key'),
            'fingerprint' => $fingerprint,
            'status' => 'active',
            'revoked_at' => null,
        ]);
    }

    /**
     * Resolve a credential for agent task execution (prefers project-scoped over workspace-wide).
     */
    public function resolve(Workspace $workspace, ?Project $project, string $provider): ?WorkspaceCredential
    {
        $query = WorkspaceCredential::where('workspace_id', $workspace->id)
            ->where('provider', strtolower($provider))
            ->where('status', 'active')
            ->whereNull('revoked_at');

        if ($project) {
            $scoped = (clone $query)->where('project_id', $project->id)->first();
            if ($scoped) {
                return $scoped;
            }
        }

        return $query->whereNull('project_id')->first();
    }

    /**
     * Reveal and decrypt the plaintext secret value for authorized callers.
     */
    public function reveal(WorkspaceCredential $credential): ?string
    {
        try {
            return Crypt::decryptString($credential->ciphertext);
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * Revoke a credential and mark it inactive.
     */
    public function revoke(WorkspaceCredential $credential): void
    {
        $credential->update([
            'status' => 'revoked',
            'revoked_at' => now(),
        ]);
    }

    /**
     * Format a credential for public/browser consumption (masking raw secret).
     */
    public function publicView(WorkspaceCredential $credential): array
    {
        $hash = $credential->fingerprint;
        $formattedFingerprint = 'sha256_' . substr($hash, 0, 8) . '...' . substr($hash, -4);

        return [
            'id' => $credential->id,
            'workspace_id' => $credential->workspace_id,
            'project_id' => $credential->project_id,
            'project_name' => $credential->project?->title,
            'name' => $credential->name ?: (ucfirst($credential->provider) . ' Secret'),
            'provider' => $credential->provider,
            'masked_value' => '••••••••',
            'fingerprint' => $formattedFingerprint,
            'status' => $credential->status,
            'last_validated_at' => $credential->last_validated_at?->toIso8601String(),
            'created_at' => $credential->created_at?->toIso8601String(),
            'updated_at' => $credential->updated_at?->toIso8601String(),
        ];
    }
}

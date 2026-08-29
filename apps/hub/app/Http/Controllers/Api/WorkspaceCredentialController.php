<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\Workspace;
use App\Models\WorkspaceCredential;
use App\Services\CredentialVaultService;
use App\Services\WorkspaceContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WorkspaceCredentialController extends Controller
{
    /**
     * List all active credentials in the workspace vault.
     */
    public function index(Request $request, Workspace $workspace, CredentialVaultService $vault, WorkspaceContext $context): JsonResponse
    {
        $this->setWorkspace($request, $workspace);
        $context->authorizeRole($request, ['owner', 'admin', 'developer', 'viewer']);

        if (!$this->isVaultAllowed($workspace)) {
            return response()->json([
                'success' => false,
                'error_code' => 'UPGRADE_REQUIRED',
                'message' => 'Team Credential Vault is only available on Team and Enterprise plans. Please upgrade.',
                'quota' => [
                    'resource' => 'secrets',
                    'current_plan' => $workspace->plan ?: 'community',
                    'suggested_plan' => 'team',
                    'upgrade_url' => "/workspaces/{$workspace->id}/billing",
                ],
            ], 403);
        }

        $projectId = $request->query('project_id');
        $query = WorkspaceCredential::where('workspace_id', $workspace->id)
            ->whereNull('revoked_at')
            ->where('status', 'active');

        if ($projectId) {
            $query->where('project_id', $projectId);
        }

        $credentials = $query->orderByDesc('id')
            ->get()
            ->map(fn ($item) => $vault->publicView($item))
            ->values();

        return response()->json([
            'success' => true,
            'data' => $credentials,
        ]);
    }

    /**
     * Store a new or updated encrypted credential.
     */
    public function store(Request $request, Workspace $workspace, CredentialVaultService $vault, WorkspaceContext $context): JsonResponse
    {
        $this->setWorkspace($request, $workspace);
        $userRole = $context->role($request, $workspace);

        if ($userRole === 'viewer') {
            return response()->json([
                'success' => false,
                'error_code' => 'UNAUTHORIZED_ACTION',
                'message' => 'Viewers cannot create credentials in the Team Vault.',
            ], 403);
        }

        $context->authorizeRole($request, ['owner', 'admin', 'developer']);

        if (!$this->isVaultAllowed($workspace)) {
            return response()->json([
                'success' => false,
                'error_code' => 'UPGRADE_REQUIRED',
                'message' => 'Shared secret storage requires Team or Enterprise plan.',
                'quota' => [
                    'resource' => 'secrets',
                    'current_plan' => $workspace->plan ?: 'community',
                    'suggested_plan' => 'team',
                    'upgrade_url' => "/workspaces/{$workspace->id}/billing",
                ],
            ], 403);
        }

        $data = $request->validate([
            'provider' => 'required|string|max:80',
            'name' => 'nullable|string|max:120',
            'secret_value' => 'nullable|string|max:10000',
            'secret' => 'nullable|string|max:10000',
            'project_id' => 'nullable|integer|exists:projects,id',
        ]);

        $rawSecret = $data['secret_value'] ?? ($data['secret'] ?? null);
        if (empty($rawSecret)) {
            return response()->json([
                'success' => false,
                'error_code' => 'VALIDATION_ERROR',
                'message' => 'Secret value is required.',
            ], 422);
        }

        $name = trim($data['name'] ?? '');
        $projectId = !empty($data['project_id']) ? (int) $data['project_id'] : null;

        // Check for duplicate credential name in the same scope
        if (!empty($name)) {
            $duplicate = WorkspaceCredential::where('workspace_id', $workspace->id)
                ->where('name', $name)
                ->where('status', 'active')
                ->whereNull('revoked_at')
                ->where(function ($q) use ($projectId) {
                    if ($projectId) {
                        $q->where('project_id', $projectId);
                    } else {
                        $q->whereNull('project_id');
                    }
                })
                ->exists();

            if ($duplicate) {
                return response()->json([
                    'success' => false,
                    'error_code' => 'DUPLICATE_CREDENTIAL_NAME',
                    'message' => 'A credential with this name already exists in this scope.',
                ], 422);
            }
        }

        $project = $projectId ? Project::where('workspace_id', $workspace->id)->findOrFail($projectId) : null;
        $credential = $vault->put($workspace, $project, strtolower($data['provider']), $rawSecret, $name ?: null);

        return response()->json([
            'success' => true,
            'message' => "Credential '{$credential->name}' saved securely.",
            'data' => $vault->publicView($credential),
        ], 201);
    }

    /**
     * Reveal and decrypt the secret value (restricted to Owner/Admin).
     */
    public function reveal(Request $request, Workspace $workspace, WorkspaceCredential $credential, CredentialVaultService $vault, WorkspaceContext $context): JsonResponse
    {
        $this->setWorkspace($request, $workspace);
        $userRole = $context->role($request, $workspace);

        if (!in_array($userRole, ['owner', 'admin'], true)) {
            return response()->json([
                'success' => false,
                'error_code' => 'UNAUTHORIZED_REVEAL',
                'message' => 'Only workspace owners and admins are authorized to reveal secret values.',
            ], 403);
        }

        if (!$this->isVaultAllowed($workspace)) {
            return response()->json([
                'success' => false,
                'error_code' => 'UPGRADE_REQUIRED',
                'message' => 'Upgrade required.',
            ], 403);
        }

        abort_unless((int) $credential->workspace_id === (int) $workspace->id, 404, 'Credential not found in this workspace.');

        $secretValue = $vault->reveal($credential);

        if ($secretValue === null) {
            return response()->json([
                'success' => false,
                'message' => 'Unable to decrypt secret payload.',
            ], 500);
        }

        return response()->json([
            'success' => true,
            'secret_value' => $secretValue,
            'data' => [
                'id' => $credential->id,
                'secret_value' => $secretValue,
            ],
        ]);
    }

    /**
     * Revoke/delete a credential from the vault.
     */
    public function destroy(Request $request, Workspace $workspace, WorkspaceCredential $credential, CredentialVaultService $vault, WorkspaceContext $context): JsonResponse
    {
        $this->setWorkspace($request, $workspace);
        $userRole = $context->role($request, $workspace);

        if (!in_array($userRole, ['owner', 'admin'], true)) {
            return response()->json([
                'success' => false,
                'error_code' => 'UNAUTHORIZED_ACTION',
                'message' => 'Only owners and admins can delete credentials.',
            ], 403);
        }

        abort_unless((int) $credential->workspace_id === (int) $workspace->id, 404, 'Credential not found in this workspace.');

        $vault->revoke($credential);
        $credential->delete();

        return response()->json([
            'success' => true,
            'message' => 'Credential removed from vault.',
        ]);
    }

    private function setWorkspace(Request $request, Workspace $workspace): void
    {
        $request->headers->set('X-Workspace-Id', (string) $workspace->id);
    }

    private function isVaultAllowed(Workspace $workspace): bool
    {
        $planSlug = strtolower($workspace->plan ?: ($workspace->activePlan()?->slug ?? 'community'));
        return in_array($planSlug, ['team', 'enterprise'], true);
    }
}

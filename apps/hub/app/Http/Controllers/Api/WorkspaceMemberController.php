<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Workspace;
use App\Services\WorkspaceContext;
use App\Services\WorkspaceQuotaService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class WorkspaceMemberController extends Controller
{
    /**
     * List all workspace members and real-time seat quota usage.
     */
    public function index(Request $request, Workspace $workspace, WorkspaceContext $context, WorkspaceQuotaService $quotaService): JsonResponse
    {
        $request->headers->set('X-Workspace-Id', (string) $workspace->id);
        $context->resolve($request);

        $members = $workspace->members()
            ->select('users.id', 'users.name', 'users.email', 'users.github_login', 'users.github_avatar_url')
            ->withPivot('role', 'created_at')
            ->get()
            ->map(function ($member) use ($workspace) {
                return [
                    'id' => $member->id,
                    'name' => $member->name ?: ($member->github_login ?: 'User #' . $member->id),
                    'email' => $member->email,
                    'github_login' => $member->github_login,
                    'github_avatar_url' => $member->github_avatar_url,
                    'role' => $member->id === $workspace->owner_id ? 'owner' : ($member->pivot->role ?? 'developer'),
                    'is_owner' => $member->id === $workspace->owner_id,
                    'joined_at' => $member->pivot->created_at?->toIso8601String(),
                ];
            });

        // Ensure owner is present if not in pivot
        if (!$members->contains('id', $workspace->owner_id) && $workspace->owner) {
            $owner = $workspace->owner;
            $members->prepend([
                'id' => $owner->id,
                'name' => $owner->name ?: ($owner->github_login ?: 'Owner'),
                'email' => $owner->email,
                'github_login' => $owner->github_login,
                'github_avatar_url' => $owner->github_avatar_url,
                'role' => 'owner',
                'is_owner' => true,
                'joined_at' => $workspace->created_at?->toIso8601String(),
            ]);
        }

        $usage = $quotaService->getUsageSummary($workspace);
        $seatLimit = $workspace->effectiveSeatLimit();
        $activeSeats = $usage['seats']['active'];

        return response()->json([
            'success' => true,
            'data' => $members->values(),
            'seats' => [
                'used' => $activeSeats,
                'limit' => $seatLimit,
                'remaining' => $seatLimit !== null ? max(0, $seatLimit - $activeSeats) : null,
                'percent' => $usage['seats']['percent'],
            ],
        ]);
    }

    /**
     * Invite or add a new member by email, GitHub username, or user_id.
     */
    public function store(Request $request, Workspace $workspace, WorkspaceContext $context, WorkspaceQuotaService $quotaService): JsonResponse
    {
        $request->headers->set('X-Workspace-Id', (string) $workspace->id);
        $context->authorizeRole($request, ['owner', 'admin']);

        $validated = $request->validate([
            'email_or_username' => 'nullable|string|max:255',
            'email' => 'nullable|email|max:255',
            'user_id' => 'nullable|exists:users,id',
            'role' => 'required|in:admin,developer,viewer',
        ]);

        $targetUser = null;

        if (!empty($validated['user_id'])) {
            $targetUser = User::find($validated['user_id']);
        } else {
            $identifier = trim($validated['email_or_username'] ?? ($validated['email'] ?? ''));
            if (empty($identifier)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Please provide a valid email or GitHub username.',
                ], 422);
            }

            $targetUser = User::where('email', $identifier)
                ->orWhere('github_login', $identifier)
                ->first();

            if (!$targetUser) {
                // If user does not exist yet on Task Hub, auto-provision an invited account
                if (filter_var($identifier, FILTER_VALIDATE_EMAIL)) {
                    $targetUser = User::create([
                        'name' => explode('@', $identifier)[0],
                        'email' => $identifier,
                        'password' => bcrypt(Str::random(32)),
                    ]);
                } else {
                    $cleanUsername = ltrim($identifier, '@');
                    $targetUser = User::create([
                        'name' => $cleanUsername,
                        'email' => strtolower($cleanUsername) . '@users.noreply.github.com',
                        'github_login' => $cleanUsername,
                        'github_avatar_url' => "https://github.com/{$cleanUsername}.png",
                        'password' => bcrypt(Str::random(32)),
                    ]);
                }
            }
        }

        if (!$targetUser) {
            return response()->json([
                'success' => false,
                'message' => 'Target user could not be identified.',
            ], 404);
        }

        $alreadyMember = $workspace->members()->where('users.id', $targetUser->id)->exists() || $workspace->owner_id === $targetUser->id;
        if ($alreadyMember) {
            return response()->json([
                'success' => false,
                'error_code' => 'USER_ALREADY_MEMBER',
                'message' => 'User is already a member of this workspace.',
            ], 422);
        }

        // Quota check throws PlanQuotaExceededException (HTTP 422 with PLAN_QUOTA_EXCEEDED)
        $quotaService->assertCanAddMember($workspace);

        $workspace->members()->attach($targetUser->id, ['role' => $validated['role']]);

        return response()->json([
            'success' => true,
            'message' => "Successfully added {$targetUser->name} to workspace.",
            'data' => [
                'id' => $targetUser->id,
                'name' => $targetUser->name,
                'email' => $targetUser->email,
                'github_login' => $targetUser->github_login,
                'github_avatar_url' => $targetUser->github_avatar_url,
                'role' => $validated['role'],
                'is_owner' => false,
                'joined_at' => now()->toIso8601String(),
            ],
        ], 201);
    }

    /**
     * Update an existing member's role.
     */
    public function update(Request $request, Workspace $workspace, User $user, WorkspaceContext $context): JsonResponse
    {
        $request->headers->set('X-Workspace-Id', (string) $workspace->id);
        $context->authorizeRole($request, ['owner', 'admin']);

        $validated = $request->validate([
            'role' => 'required|in:admin,developer,viewer',
        ]);

        if ($workspace->owner_id === $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'Workspace owner role cannot be changed.',
            ], 422);
        }

        $isMember = $workspace->members()->where('users.id', $user->id)->exists();
        if (!$isMember) {
            return response()->json([
                'success' => false,
                'message' => 'User is not a member of this workspace.',
            ], 404);
        }

        $workspace->members()->updateExistingPivot($user->id, ['role' => $validated['role']]);

        return response()->json([
            'success' => true,
            'message' => "Updated {$user->name}'s role to {$validated['role']}.",
            'data' => [
                'user_id' => $user->id,
                'role' => $validated['role'],
            ],
        ]);
    }

    /**
     * Remove a member from the workspace (revoke access).
     */
    public function destroy(Request $request, Workspace $workspace, User $user, WorkspaceContext $context): JsonResponse
    {
        $request->headers->set('X-Workspace-Id', (string) $workspace->id);
        $context->authorizeRole($request, ['owner', 'admin']);

        if ($workspace->owner_id === $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'Cannot remove workspace owner.',
            ], 422);
        }

        $isMember = $workspace->members()->where('users.id', $user->id)->exists();
        if (!$isMember) {
            return response()->json([
                'success' => false,
                'message' => 'User is not a member of this workspace.',
            ], 404);
        }

        $workspace->members()->detach($user->id);

        return response()->json([
            'success' => true,
            'message' => "Removed {$user->name} from workspace.",
        ]);
    }
}

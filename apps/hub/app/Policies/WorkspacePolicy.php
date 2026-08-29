<?php

namespace App\Policies;

use App\Models\User;
use App\Models\Workspace;

class WorkspacePolicy
{
    /**
     * Determine whether the user can view the workspace.
     */
    public function view(User $user, Workspace $workspace): bool
    {
        return $workspace->owner_id === $user->id || $workspace->members()->whereKey($user->id)->exists();
    }

    /**
     * Determine whether the user can manage members (invite, change roles, revoke).
     */
    public function manageMembers(User $user, Workspace $workspace): bool
    {
        if ($workspace->owner_id === $user->id) {
            return true;
        }

        $role = $workspace->members()->whereKey($user->id)->first()?->pivot?->role;
        return in_array($role, ['owner', 'admin'], true);
    }

    /**
     * Determine whether the user can update a specific member's role.
     */
    public function updateMemberRole(User $user, Workspace $workspace, User $targetMember): bool
    {
        if ($targetMember->id === $workspace->owner_id) {
            return false;
        }

        return $this->manageMembers($user, $workspace);
    }

    /**
     * Determine whether the user can remove a specific member.
     */
    public function removeMember(User $user, Workspace $workspace, User $targetMember): bool
    {
        if ($targetMember->id === $workspace->owner_id) {
            return false;
        }

        return $this->manageMembers($user, $workspace);
    }
}

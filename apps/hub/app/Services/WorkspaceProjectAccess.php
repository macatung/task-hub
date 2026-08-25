<?php

namespace App\Services;

use App\Models\Project;
use Illuminate\Http\Request;

/**
 * Authorizes a project resource in the active SaaS workspace.
 *
 * Route model binding alone is not a tenant boundary: a project ID can belong
 * to another workspace. Keep the check in one place so web and desktop-token
 * routes enforce the same project scope and workspace role rules.
 */
class WorkspaceProjectAccess
{
    public function authorize(Request $request, Project $project, array $roles = ['owner', 'admin', 'developer', 'viewer']): Project
    {
        $context = app(WorkspaceContext::class);
        $workspace = $context->resolve($request);

        abort_unless((int) $project->workspace_id === (int) $workspace->id, 404);

        $desktopProject = $request->attributes->get('desktop_project');
        if ($desktopProject instanceof Project) {
            abort_unless((int) $desktopProject->id === (int) $project->id, 403, 'Desktop credential is scoped to another project.');
        }

        abort_unless(in_array($context->role($request, $workspace), $roles, true), 403, 'Insufficient workspace role.');

        return $project;
    }
}

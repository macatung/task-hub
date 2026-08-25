<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Services\ProjectRoadmapXlsxExport;
use App\Services\WorkspaceContext;
use Illuminate\Http\Request;

class ApiProjectRoadmapExportController extends Controller
{
    public function __invoke(Request $request, Project $project, ProjectRoadmapXlsxExport $export)
    {
        abort_unless((int) $project->workspace_id === (int) app(WorkspaceContext::class)->resolve($request)->id, 404);
        $path = $export->build($project);
        $filename = str($project->slug ?: $project->title)->slug()->append('-roadmap.xlsx')->toString();

        return response()->download($path, $filename, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ])->deleteFileAfterSend(true);
    }
}

<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\ProjectDocument;
use App\Models\Task;
use App\Services\GithubProjectIntegrationService;
use App\Services\ProjectKnowledgeService;
use App\Services\WorkspaceProjectAccess;
use Illuminate\Http\Request;

class ApiProjectDocumentController extends Controller
{
    public function index(Request $request, Project $project, ProjectKnowledgeService $knowledge, WorkspaceProjectAccess $access)
    {
        $access->authorize($request, $project);
        return response()->json(['success' => true, 'data' => $knowledge->projectState($project)]);
    }

    public function store(Request $request, Project $project, WorkspaceProjectAccess $access)
    {
        $access->authorize($request, $project, ['owner', 'admin', 'developer']);
        $document = $project->documents()->create($this->validated($request) + ['workspace_id' => $project->workspace_id]);
        return response()->json(['success' => true, 'data' => $document], 201);
    }

    public function update(Request $request, ProjectDocument $document, WorkspaceProjectAccess $access)
    {
        $access->authorize($request, $document->project, ['owner', 'admin', 'developer']);
        $document->update($this->validated($request, true));
        return response()->json(['success' => true, 'data' => $document->fresh()]);
    }

    public function destroy(Request $request, ProjectDocument $document, WorkspaceProjectAccess $access)
    {
        $access->authorize($request, $document->project, ['owner', 'admin', 'developer']);
        $document->delete();
        return response()->json(['success' => true]);
    }

    public function attach(Request $request, Task $task, WorkspaceProjectAccess $access)
    {
        $access->authorize($request, $task->project, ['owner', 'admin', 'developer']);
        $data = $request->validate(['project_document_id' => 'required|exists:project_documents,id', 'is_required' => 'nullable|boolean', 'purpose' => 'nullable|string|max:500']);
        $document = ProjectDocument::findOrFail($data['project_document_id']);
        abort_unless($task->project_id === $document->project_id, 422, 'Document must belong to the task project.');
        $task->documents()->syncWithoutDetaching([$document->id => ['is_required' => $data['is_required'] ?? false, 'purpose' => $data['purpose'] ?? null]]);
        return response()->json(['success' => true, 'data' => $task->fresh()->load('documents')]);
    }

    public function detach(Request $request, Task $task, ProjectDocument $document, WorkspaceProjectAccess $access)
    {
        $access->authorize($request, $task->project, ['owner', 'admin', 'developer']);
        $task->documents()->detach($document->id);
        return response()->json(['success' => true]);
    }

    public function manifestTemplate(ProjectKnowledgeService $knowledge)
    {
        return response($knowledge->manifestTemplate(), 200, ['Content-Type' => 'text/markdown; charset=UTF-8']);
    }

    public function importManifest(Request $request, Project $project, ProjectKnowledgeService $knowledge, GithubProjectIntegrationService $github, WorkspaceProjectAccess $access)
    {
        $access->authorize($request, $project, ['owner', 'admin', 'developer']);
        $data = $request->validate(['content' => 'nullable|string|max:100000', 'path' => 'nullable|string|max:500']);
        $content = $data['content'] ?? null;
        if ($content === null) {
            $path = $data['path'] ?? 'docs/PROJECT_DOCUMENTS.md';
            $file = $github->repositoryFile($project, $path);
            $content = $file['content'];
        }
        return response()->json(['success' => true, 'data' => $knowledge->importManifest($project, $content)]);
    }

    public function importGenerated(Request $request, Project $project, ProjectKnowledgeService $knowledge, WorkspaceProjectAccess $access)
    {
        $access->authorize($request, $project, ['owner', 'admin', 'developer']);
        $data = $request->validate([
            'manifest' => 'required|string|max:100000',
            'documents' => 'required|array|max:10',
            'documents.*.path' => 'required|string|max:500',
            'documents.*.content' => 'required|string|max:300000',
        ]);
        $knowledge->importManifest($project, $data['manifest']);
        $rows = $knowledge->parseManifest($data['manifest']);
        $byPath = collect($data['documents'])->keyBy(fn (array $document) => ltrim($document['path'], '/'));
        foreach ($rows as $row) {
            $path = ltrim((string) $row['repository_path'], '/');
            $file = $byPath->get($path);
            if (!$file) continue;
            ProjectDocument::where('project_id', $project->id)->where('document_type', $row['document_type'])->where('title', $row['title'])->update([
                'content' => $file['content'], 'content_hash' => hash('sha256', $file['content']), 'last_verified_at' => now(), 'source_updated_at' => now(),
            ]);
        }
        return response()->json(['success' => true, 'data' => $knowledge->projectState($project->fresh()), 'synced_content' => $byPath->count()]);
    }

    private function validated(Request $request, bool $partial = false): array
    {
        return $request->validate([
            'document_type' => ($partial ? 'sometimes|' : 'required|') . 'in:' . implode(',', ProjectDocument::TYPES),
            'title' => ($partial ? 'sometimes|' : 'required|') . 'string|max:255', 'url' => 'nullable|url|max:1000',
            'repository_path' => 'nullable|string|max:500', 'version' => 'nullable|string|max:100', 'content' => 'nullable|string|max:300000', 'content_hash' => 'nullable|string|size:64',
            'status' => 'nullable|in:active,draft,archived', 'owner' => 'nullable|string|max:120', 'access_level' => 'nullable|in:team,restricted',
            'tags' => 'nullable|array', 'source_updated_at' => 'nullable|date', 'last_verified_at' => 'nullable|date',
        ]);
    }
}

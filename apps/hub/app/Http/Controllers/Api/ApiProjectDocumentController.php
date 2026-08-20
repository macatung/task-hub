<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\ProjectDocument;
use App\Models\Task;
use App\Services\GithubProjectIntegrationService;
use App\Services\ProjectKnowledgeService;
use Illuminate\Http\Request;

class ApiProjectDocumentController extends Controller
{
    public function index(Project $project, ProjectKnowledgeService $knowledge)
    {
        return response()->json(['success' => true, 'data' => $knowledge->projectState($project)]);
    }

    public function store(Request $request, Project $project)
    {
        $document = $project->documents()->create($this->validated($request));
        return response()->json(['success' => true, 'data' => $document], 201);
    }

    public function update(Request $request, ProjectDocument $document)
    {
        $document->update($this->validated($request, true));
        return response()->json(['success' => true, 'data' => $document->fresh()]);
    }

    public function destroy(ProjectDocument $document)
    {
        $document->delete();
        return response()->json(['success' => true]);
    }

    public function attach(Request $request, Task $task)
    {
        $data = $request->validate(['project_document_id' => 'required|exists:project_documents,id', 'is_required' => 'nullable|boolean', 'purpose' => 'nullable|string|max:500']);
        $document = ProjectDocument::findOrFail($data['project_document_id']);
        abort_unless($task->project_id === $document->project_id, 422, 'Document must belong to the task project.');
        $task->documents()->syncWithoutDetaching([$document->id => ['is_required' => $data['is_required'] ?? false, 'purpose' => $data['purpose'] ?? null]]);
        return response()->json(['success' => true, 'data' => $task->fresh()->load('documents')]);
    }

    public function detach(Task $task, ProjectDocument $document)
    {
        $task->documents()->detach($document->id);
        return response()->json(['success' => true]);
    }

    public function manifestTemplate(ProjectKnowledgeService $knowledge)
    {
        return response($knowledge->manifestTemplate(), 200, ['Content-Type' => 'text/markdown; charset=UTF-8']);
    }

    public function importManifest(Request $request, Project $project, ProjectKnowledgeService $knowledge, GithubProjectIntegrationService $github)
    {
        $data = $request->validate(['content' => 'nullable|string|max:100000', 'path' => 'nullable|string|max:500']);
        $content = $data['content'] ?? null;
        if ($content === null) {
            $path = $data['path'] ?? 'docs/PROJECT_DOCUMENTS.md';
            $file = $github->repositoryFile($project, $path);
            $content = $file['content'];
        }
        return response()->json(['success' => true, 'data' => $knowledge->importManifest($project, $content)]);
    }

    private function validated(Request $request, bool $partial = false): array
    {
        return $request->validate([
            'document_type' => ($partial ? 'sometimes|' : 'required|') . 'in:' . implode(',', ProjectDocument::TYPES),
            'title' => ($partial ? 'sometimes|' : 'required|') . 'string|max:255', 'url' => 'nullable|url|max:1000',
            'repository_path' => 'nullable|string|max:500', 'version' => 'nullable|string|max:100', 'content_hash' => 'nullable|string|size:64',
            'status' => 'nullable|in:active,draft,archived', 'owner' => 'nullable|string|max:120', 'access_level' => 'nullable|in:team,restricted',
            'tags' => 'nullable|array', 'source_updated_at' => 'nullable|date', 'last_verified_at' => 'nullable|date',
        ]);
    }
}

<?php

namespace App\Services;

use App\Models\Project;
use App\Models\ProjectDocument;
use App\Models\Task;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class ProjectKnowledgeService
{
    public const STANDARD_VERSION = 'task-hub-docs-v1';
    public const CORE_TYPES = ['brief', 'prd', 'functional_spec', 'architecture', 'qa_plan', 'release_runbook'];

    public function documentsForTask(Task $task): array
    {
        $task->loadMissing(['project.documents', 'documents']);
        $required = $task->documents->keyBy('id');
        $projectDocuments = $task->project?->documents->where('status', 'active') ?? collect();

        return $projectDocuments->map(function (ProjectDocument $document) use ($required) {
            $linked = $required->get($document->id);
            return $this->serialize($document, $linked?->pivot?->is_required ?? false, $linked?->pivot?->purpose);
        })->merge(
            $task->documents->filter(fn (ProjectDocument $document) => !$projectDocuments->contains('id', $document->id))
                ->map(fn (ProjectDocument $document) => $this->serialize($document, (bool) $document->pivot->is_required, $document->pivot->purpose))
        )->values()->all();
    }

    public function projectState(Project $project): array
    {
        $documents = $project->documents()->orderBy('document_type')->orderBy('title')->get();
        return [
            'documents' => $documents->map(fn (ProjectDocument $document) => $this->serialize($document))->values()->all(),
            'summary' => [
                'total' => $documents->count(),
                'active' => $documents->where('status', 'active')->count(),
                'stale' => $documents->filter->is_stale->count(),
                'standard_version' => self::STANDARD_VERSION,
                'manifest_path' => 'docs/PROJECT_DOCUMENTS.md',
                'required_core' => self::CORE_TYPES,
                'missing_core' => array_values(array_diff(self::CORE_TYPES, $documents->where('status', 'active')->pluck('document_type')->unique()->all())),
            ],
        ];
    }

    public function importManifest(Project $project, string $content, ?string $sourceHash = null): array
    {
        $rows = $this->parseManifest($content);
        $sourceHash = $sourceHash ?: hash('sha256', $content);
        $seen = [];
        foreach ($rows as $row) {
            $key = ['project_id' => $project->id, 'document_type' => $row['document_type'], 'title' => $row['title']];
            ProjectDocument::updateOrCreate($key, array_merge($row, ['project_id' => $project->id, 'workspace_id' => $project->workspace_id, 'content_hash' => $sourceHash, 'last_verified_at' => now()]));
            $seen[] = $row['document_type'] . '|' . $row['title'];
        }
        return ['imported' => count($seen), 'documents' => $this->projectState($project->fresh())];
    }

    /** Format: | type | title | path_or_url | owner | version | tags | */
    public function parseManifest(string $content): array
    {
        $rows = [];
        foreach (preg_split('/\R/', $content) as $line) {
            $columns = array_map('trim', explode('|', trim($line, " \t|")));
            if (count($columns) < 3 || Str::startsWith($columns[0], ['type', '---', ':--'])) continue;
            $type = Str::lower(Str::replace([' ', '-'], '_', $columns[0]));
            if (!in_array($type, ProjectDocument::TYPES, true)) continue;
            $location = $columns[2];
            $rows[] = [
                'document_type' => $type,
                'title' => $columns[1] ?: Str::headline($type),
                'url' => filter_var($location, FILTER_VALIDATE_URL) ? $location : null,
                'repository_path' => filter_var($location, FILTER_VALIDATE_URL) ? null : ltrim($location, '/'),
                'owner' => $columns[3] ?? null,
                'version' => $columns[4] ?? null,
                'tags' => isset($columns[5]) ? array_values(array_filter(array_map('trim', explode(',', $columns[5])))) : [],
                'status' => 'active',
            ];
        }
        return $rows;
    }

    public function manifestTemplate(): string
    {
        return "# Task Hub Project Documents\n\n<!-- task-hub:document-registry:v1 -->\n\nThis registry is the canonical index for product, engineering, QA and release context. Keep the core rows present; update the linked files when the repository changes. Task Hub imports this file and passes the active references into agent context.\n\n| type | title | path_or_url | owner | version | tags |\n| --- | --- | --- | --- | --- | --- |\n| brief | Project Brief | docs/PROJECT_BRIEF.md | Product | 1.0 | scope,goals |\n| prd | Product Requirements | docs/PRD.md | Product | 1.0 | requirements,acceptance |\n| functional_spec | Functional Specification | docs/FUNCTIONAL_SPECIFICATION.md | Engineering & Product | 1.0 | specifications,use-cases,traceability |\n| architecture | Architecture | docs/ARCHITECTURE.md | Engineering | 1.0 | system,data-flow |\n| qa_plan | QA Plan | docs/QA_PLAN.md | QA | 1.0 | test,quality |\n| release_runbook | Release Runbook | docs/RELEASE_RUNBOOK.md | DevOps | 1.0 | release,operations |\n";
    }

    public function documentContentsForTask(Task $task): array
    {
        $task->loadMissing(['project.documents', 'documents']);
        $project = $task->project;
        if (!$project) return [];

        $documents = collect($this->documentsForTask($task));
        $github = app(GithubProjectIntegrationService::class);
        return $documents->filter(fn (array $document) => !empty($document['repository_path']))->map(function (array $document) use ($github, $project) {
            try {
                $stored = ProjectDocument::where('project_id', $project->id)->where('document_type', $document['type'])->where('title', $document['title'])->first();
                if ($stored?->content) return ['type' => $document['type'], 'title' => $document['title'], 'path' => $document['repository_path'], 'sha' => $stored->content_hash, 'content' => $stored->content, 'source' => 'task_hub'];
                if (!$project->github_repository) return ['type' => $document['type'], 'title' => $document['title'], 'path' => $document['repository_path'], 'content' => null, 'unavailable' => true];
                $file = $github->repositoryFile($project, $document['repository_path']);
                return ['type' => $document['type'], 'title' => $document['title'], 'path' => $file['path'], 'sha' => $file['sha'], 'content' => $file['content']];
            } catch (\Throwable) {
                return ['type' => $document['type'], 'title' => $document['title'], 'path' => $document['repository_path'], 'content' => null, 'unavailable' => true];
            }
        })->values()->all();
    }

    private function serialize(ProjectDocument $document, bool $required = false, ?string $purpose = null): array
    {
        return [
            'id' => $document->id, 'type' => $document->document_type, 'title' => $document->title,
            'standard_version' => self::STANDARD_VERSION,
            'url' => $document->url, 'repository_path' => $document->repository_path, 'version' => $document->version,
            'has_content' => filled($document->content),
            'content_hash' => $document->content_hash, 'owner' => $document->owner, 'access_level' => $document->access_level,
            'tags' => $document->tags ?: [], 'status' => $document->status, 'is_stale' => $document->is_stale,
            'required_for_task' => $required, 'purpose' => $purpose, 'last_verified_at' => $document->last_verified_at?->toIso8601String(),
        ];
    }
}

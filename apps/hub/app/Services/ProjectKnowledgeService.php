<?php

namespace App\Services;

use App\Models\Project;
use App\Models\ProjectDocument;
use App\Models\Task;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class ProjectKnowledgeService
{
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
                'missing_core' => array_values(array_diff(['brief', 'prd', 'architecture', 'qa_plan', 'release_runbook'], $documents->where('status', 'active')->pluck('document_type')->unique()->all())),
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
            ProjectDocument::updateOrCreate($key, array_merge($row, ['project_id' => $project->id, 'content_hash' => $sourceHash, 'last_verified_at' => now()]));
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
        return "# Project document registry\n\nThis file is the versioned source of project references. Sync it in Task Hub after editing.\n\n| type | title | path_or_url | owner | version | tags |\n| --- | --- | --- | --- | --- | --- |\n| brief | Project brief | docs/PROJECT_BRIEF.md | PM | 1.0 | scope,goals |\n| architecture | Architecture | docs/ARCHITECTURE.md | Tech Lead | 1.0 | system,adr |\n| qa_plan | QA plan | docs/QA_PLAN.md | QA | 1.0 | test |\n| release_runbook | Release runbook | docs/RELEASE_RUNBOOK.md | DevOps | 1.0 | release |\n";
    }

    private function serialize(ProjectDocument $document, bool $required = false, ?string $purpose = null): array
    {
        return [
            'id' => $document->id, 'type' => $document->document_type, 'title' => $document->title,
            'url' => $document->url, 'repository_path' => $document->repository_path, 'version' => $document->version,
            'content_hash' => $document->content_hash, 'owner' => $document->owner, 'access_level' => $document->access_level,
            'tags' => $document->tags ?: [], 'status' => $document->status, 'is_stale' => $document->is_stale,
            'required_for_task' => $required, 'purpose' => $purpose, 'last_verified_at' => $document->last_verified_at?->toIso8601String(),
        ];
    }
}

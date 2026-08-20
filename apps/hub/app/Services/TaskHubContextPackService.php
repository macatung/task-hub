<?php

namespace App\Services;

use App\Models\AgentRun;
use App\Models\Task;
use Illuminate\Support\Str;

class TaskHubContextPackService
{
    public function build(?Task $task, array $options = []): array
    {
        $task?->loadMissing(['project.documents', 'sprint', 'epic', 'agentRuns.evidence', 'documents']);
        $project = $task?->project;

        $pack = [
            'version' => 1,
            'generated_at' => now()->toIso8601String(),
            'work_item' => $task ? [
                'id' => $task->id,
                'issue_key' => $task->issue_key,
                'title' => $task->title,
                'description' => $task->description,
                'acceptance_criteria' => $task->acceptance_criteria,
                'definition_of_done' => $task->definition_of_done,
                'risk_level' => $task->risk_level ?: 'low',
                'status' => $task->status,
                'priority' => $task->priority,
                'project' => $task->project?->only(['id', 'title', 'key']),
                'sprint' => $task->sprint?->only(['id', 'name', 'goal', 'status']),
                'github' => $project ? [
                    'repository' => $project->github_repository,
                    'default_branch' => $project->github_default_branch,
                    'sync_status' => $project->github_sync_status,
                    'last_sync_at' => $project->github_last_sync_at?->toIso8601String(),
                ] : null,
            ] : null,
            'repository' => $options['repository'] ?? $project?->github_repository ?? env('TASK_HUB_REPOSITORY'),
            'branch' => $options['branch'] ?? $project?->github_default_branch,
            'test_commands' => $options['test_commands'] ?? ['npm test', 'npm run build'],
            'security_constraints' => $options['security_constraints'] ?? [
                'do_not_expose_secrets',
                'do_not_merge_or_deploy_without_human_approval',
            ],
            'previous_runs' => $task ? $task->agentRuns->map(fn (AgentRun $run) => [
                'id' => $run->id,
                'provider' => $run->provider,
                'status' => $run->status,
                'summary' => $run->summary,
                'commit_sha' => $run->commit_sha,
                'finished_at' => $run->finished_at?->toIso8601String(),
            ])->values()->all() : [],
            'project_knowledge' => $task && $project ? app(ProjectKnowledgeService::class)->documentsForTask($task) : [],
        ];

        $pack['context_hash'] = hash('sha256', json_encode($pack, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        return $pack;
    }

    public function instructionHash(array $instruction): string
    {
        return hash('sha256', json_encode($instruction, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    }
}

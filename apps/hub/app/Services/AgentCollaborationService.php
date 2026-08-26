<?php

namespace App\Services;

use App\Models\AgentMessage;
use App\Models\AgentProfile;
use App\Models\Project;
use Illuminate\Support\Str;

class AgentCollaborationService
{
    private function project(int $projectId): Project { return Project::findOrFail($projectId); }

    public function register(array $input): AgentProfile
    {
        $project = $this->project((int) $input['project_id']);
        return AgentProfile::updateOrCreate(
            ['project_id' => $project->id, 'agent_key' => $input['agent_key']],
            ['workspace_id' => $project->workspace_id, 'name' => $input['name'], 'role' => $input['role'] ?? null, 'provider' => $input['provider'] ?? null, 'model' => $input['model'] ?? null, 'status' => $input['status'] ?? 'idle', 'metadata' => $input['metadata'] ?? [], 'status_updated_at' => now()]
        );
    }

    public function roster(int $projectId): array
    {
        return AgentProfile::where('project_id', $projectId)->withCount(['inbox as unread_count' => fn ($q) => $q->whereIn('status', ['queued', 'delivered'])])->orderBy('name')->get()->all();
    }

    public function send(array $input): AgentMessage
    {
        $project = $this->project((int) $input['project_id']);
        $sender = AgentProfile::where('project_id', $project->id)->where('agent_key', $input['from_agent_key'])->firstOrFail();
        $recipient = AgentProfile::where('project_id', $project->id)->where('agent_key', $input['to_agent_key'])->firstOrFail();
        return AgentMessage::create(['thread_id' => $input['thread_id'] ?? (string) Str::uuid(), 'workspace_id' => $project->workspace_id, 'project_id' => $project->id, 'sender_agent_id' => $sender->id, 'recipient_agent_id' => $recipient->id, 'subject' => $input['subject'], 'body' => $input['body'], 'payload' => $input['payload'] ?? [], 'status' => 'queued']);
    }

    public function inbox(int $projectId, string $agentKey, bool $peek = false): array
    {
        $recipient = AgentProfile::where('project_id', $projectId)->where('agent_key', $agentKey)->firstOrFail();
        $messages = AgentMessage::where('recipient_agent_id', $recipient->id)->with('sender:id,name,role,agent_key')->whereIn('status', ['queued', 'delivered', 'read'])->latest()->limit(100)->get();
        if (!$peek) AgentMessage::whereIn('id', $messages->pluck('id'))->whereIn('status', ['queued', 'delivered'])->update(['status' => 'read', 'read_at' => now()]);
        return $messages->fresh(['sender:id,name,role,agent_key'])->all();
    }

    public function acknowledge(array $input): AgentMessage
    {
        $message = AgentMessage::where('project_id', (int) $input['project_id'])->findOrFail((int) $input['message_id']);
        $recipient = AgentProfile::where('project_id', $message->project_id)->where('agent_key', $input['agent_key'])->firstOrFail();
        abort_unless($message->recipient_agent_id === $recipient->id, 403);
        $message->update(['status' => $input['status'], 'acknowledged_at' => now(), 'payload' => array_merge($message->payload ?? [], ['ack_note' => $input['note'] ?? null])]);
        return $message;
    }

    public function reportStatus(array $input): AgentProfile
    {
        $profile = AgentProfile::where('project_id', (int) $input['project_id'])->where('agent_key', $input['agent_key'])->firstOrFail();
        $profile->update(['status' => $input['status'], 'active_run_id' => $input['run_id'] ?? $profile->active_run_id, 'status_updated_at' => now(), 'metadata' => array_merge($profile->metadata ?? [], ['status_summary' => $input['summary'] ?? null])]);
        return $profile;
    }
}

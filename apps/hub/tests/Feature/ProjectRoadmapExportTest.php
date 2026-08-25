<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProjectRoadmapExportTest extends TestCase
{
    use RefreshDatabase;

    public function test_authenticated_workspace_member_can_download_a_three_sheet_xlsx_export(): void
    {
        $user = User::factory()->create();
        $workspace = Workspace::create(['name' => 'Export workspace', 'slug' => 'export-' . $user->id, 'owner_id' => $user->id]);
        $workspace->members()->attach($user->id, ['role' => 'owner']);
        $project = Project::create(['workspace_id' => $workspace->id, 'user_id' => $user->id, 'slug' => 'delivery', 'title' => 'Delivery', 'tagline' => 'Roadmap', 'description' => 'Project export', 'category' => 'software']);
        $epic = Task::create(['workspace_id' => $workspace->id, 'project_id' => $project->id, 'issue_type' => 'epic', 'title' => 'Launch', 'start_date' => '2026-08-01', 'due_date' => '2026-08-31']);
        Task::create(['workspace_id' => $workspace->id, 'project_id' => $project->id, 'epic_id' => $epic->id, 'title' => 'Ship export', 'status' => 'done', 'story_points' => 5, 'completed_at' => now()]);

        $response = $this->actingAs($user)->withHeaders(['X-Workspace-Id' => $workspace->id])
            ->get('/api/projects/' . $project->id . '/roadmap-export');

        $response->assertOk()->assertHeader('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        $file = $response->baseResponse->getFile();
        $this->assertStringStartsWith('PK', file_get_contents($file->getPathname()));
        $zip = new \ZipArchive();
        $this->assertTrue($zip->open($file->getPathname()) === true);
        $workbook = $zip->getFromName('xl/workbook.xml');
        $this->assertStringContainsString('Summary', $workbook);
        $this->assertStringContainsString('Roadmap', $workbook);
        $this->assertStringContainsString('Tasks', $workbook);
        $this->assertNotFalse($zip->locateName('xl/worksheets/sheet3.xml'));
        $zip->close();
    }

    public function test_export_does_not_allow_a_project_from_another_workspace(): void
    {
        $user = User::factory()->create();
        $workspace = Workspace::create(['name' => 'One', 'slug' => 'one-' . $user->id, 'owner_id' => $user->id]);
        $workspace->members()->attach($user->id, ['role' => 'owner']);
        $other = Workspace::create(['name' => 'Two', 'slug' => 'two-' . $user->id, 'owner_id' => $user->id]);
        $project = Project::create(['workspace_id' => $other->id, 'user_id' => $user->id, 'slug' => 'private', 'title' => 'Private', 'tagline' => 'No access', 'description' => 'No access', 'category' => 'software']);

        $this->actingAs($user)->withHeaders(['X-Workspace-Id' => $workspace->id])
            ->get('/api/projects/' . $project->id . '/roadmap-export')->assertNotFound();
    }
}

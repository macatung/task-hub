<?php

use App\Http\Controllers\Api\ApiAgentRunController;
use App\Http\Controllers\Api\ApiCapabilityController;
use App\Http\Controllers\Api\ApiAgentRunnerController;
use App\Http\Controllers\Api\ApiProjectController;
use App\Http\Controllers\Api\ApiProjectDocumentController;
use App\Http\Controllers\Api\ApiProjectReleaseController;
use App\Http\Controllers\Api\ApiSprintController;
use App\Http\Controllers\Api\ApiTaskController;
use App\Http\Controllers\Api\TaskHubMcpController;
use App\Http\Controllers\DesktopPairingController;
use App\Http\Controllers\GithubAuthController;
use App\Http\Controllers\TaskController;
use Illuminate\Support\Facades\Route;

// Hub SaaS Web Views
Route::get('/', [TaskController::class, 'landing'])->name('hub.landing');
Route::get('/tasks', [TaskController::class, 'index'])->name('tasks.index');
Route::get('/workspace', [TaskController::class, 'index'])->name('tasks.workspace');

// GitHub OAuth identity and authorization
Route::get('/auth/github', [GithubAuthController::class, 'redirect'])->name('auth.github');
Route::get('/auth/github/callback', [GithubAuthController::class, 'callback'])->name('auth.github.callback');
Route::post('/auth/github/logout', [GithubAuthController::class, 'logout'])->name('auth.github.logout');

// MCP Model Context Protocol Endpoint
Route::post('/mcp', [TaskHubMcpController::class, 'handle'])->name('mcp.handle');
Route::post('/api/mcp', [TaskHubMcpController::class, 'handle']);
Route::post('/api/tasks/mcp', [TaskHubMcpController::class, 'handle']);
Route::post('/api/v1/mcp', [TaskHubMcpController::class, 'handle']);

// Desktop Agent Pairing Web UI
Route::get('/desktop/pairing/{pairingId}/approve', [DesktopPairingController::class, 'approveForm'])->name('desktop.pairing.form');
Route::post('/desktop/pairing/{pairingId}/approve', [DesktopPairingController::class, 'approve'])->name('desktop.pairing.approve');
Route::post('/desktop/pairing/{pairingId}/deny', [DesktopPairingController::class, 'deny'])->name('desktop.pairing.deny');

// Common API registration closure
$registerApiRoutes = function () {
    // Capabilities
    Route::get('/capabilities', [ApiCapabilityController::class, 'show']);
    Route::post('/runners/register', [ApiAgentRunnerController::class, 'register']);
    Route::get('/runners', [ApiAgentRunnerController::class, 'index']);
    Route::post('/runners/{agentRunner}/heartbeat', [ApiAgentRunnerController::class, 'heartbeat']);
    Route::post('/runners/{agentRunner}/revoke', [ApiAgentRunnerController::class, 'revoke']);
    Route::get('/runners/{agentRunner}/jobs/claim', [ApiAgentRunnerController::class, 'claim']);
    Route::post('/agent-runs/{agentRun}/events', [ApiAgentRunnerController::class, 'event']);
    Route::post('/agent-runs/{agentRun}/logs', [ApiAgentRunnerController::class, 'log']);
    Route::post('/agent-runs/{agentRun}/cancel', [ApiAgentRunnerController::class, 'cancel']);

    // Tasks and AI workflows
    Route::get('/tasks', [ApiTaskController::class, 'index']);
    Route::post('/tasks', [ApiTaskController::class, 'store']);
    Route::post('/tasks/ai-preview', [ApiTaskController::class, 'aiPreview']);
    Route::post('/tasks/ai-generate', [ApiTaskController::class, 'aiGenerate']);
    Route::get('/tasks/daily-dispatch', [ApiTaskController::class, 'dailyDispatch']);
    Route::get('/tasks/daily-review', [ApiTaskController::class, 'dailyReview']);
    Route::get('/tasks/next-action', [ApiTaskController::class, 'nextAction']);
    Route::get('/tasks/ai-settings', [ApiTaskController::class, 'getAiSettings']);
    Route::post('/tasks/ai-settings', [ApiTaskController::class, 'saveAiSettings']);
    Route::get('/tasks/report-settings', [ApiTaskController::class, 'getReportSettings']);
    Route::post('/tasks/report-settings', [ApiTaskController::class, 'saveReportSettings']);
    Route::post('/tasks/send-report-now', [ApiTaskController::class, 'sendReportNow']);
    Route::post('/tasks/work-items/{task}/approve', [ApiAgentRunController::class, 'approve']);
    Route::post('/tasks/work-items/{task}/reject', [ApiAgentRunController::class, 'reject']);
    Route::post('/tasks/github/webhook', [ApiAgentRunController::class, 'githubWebhook']);
    Route::get('/tasks/agent-runs', [ApiAgentRunController::class, 'index']);
    Route::post('/tasks/agent-runs', [ApiAgentRunController::class, 'store']);
    Route::get('/tasks/agent-runs/{agentRun}', [ApiAgentRunController::class, 'show']);
    Route::patch('/tasks/agent-runs/{agentRun}', [ApiAgentRunController::class, 'update']);
    Route::post('/tasks/agent-runs/{agentRun}/events', [ApiAgentRunController::class, 'event']);
    Route::post('/tasks/agent-runs/{agentRun}/evidence', [ApiAgentRunController::class, 'evidence']);
    Route::post('/tasks/agent-runs/{agentRun}/handoff', [ApiAgentRunController::class, 'handoff']);
    Route::get('/tasks/context-pack', [ApiAgentRunController::class, 'context']);
    Route::post('/tasks/{task}/documents', [ApiProjectDocumentController::class, 'attach']);
    Route::delete('/tasks/{task}/documents/{document}', [ApiProjectDocumentController::class, 'detach']);
    Route::patch('/tasks/{id}', [ApiTaskController::class, 'update']);
    Route::delete('/tasks/{id}', [ApiTaskController::class, 'destroy']);

    // Projects
    Route::get('/projects', [ApiProjectController::class, 'index']);
    Route::post('/projects', [ApiProjectController::class, 'store']);
    Route::get('/projects/github/repositories', [ApiProjectController::class, 'githubRepositories'])->middleware('auth');
    Route::post('/projects/from-github', [ApiProjectController::class, 'storeFromGithub'])->middleware('auth');
    Route::get('/projects/{project}/github', [ApiProjectController::class, 'githubStatus']);
    Route::post('/projects/{project}/github/connect', [ApiProjectController::class, 'connectGithub'])->middleware('auth');
    Route::post('/projects/{project}/github/sync', [ApiProjectController::class, 'syncGithub'])->middleware('auth');
    Route::get('/projects/{project}/documents', [ApiProjectDocumentController::class, 'index']);
    Route::post('/projects/{project}/documents', [ApiProjectDocumentController::class, 'store']);
    Route::post('/projects/{project}/documents/import-manifest', [ApiProjectDocumentController::class, 'importManifest']);
    Route::get('/projects/{project}/documents/manifest-template', [ApiProjectDocumentController::class, 'manifestTemplate']);
    Route::patch('/projects/documents/{document}', [ApiProjectDocumentController::class, 'update']);
    Route::delete('/projects/documents/{document}', [ApiProjectDocumentController::class, 'destroy']);
    Route::get('/projects/{project}/releases', [ApiProjectReleaseController::class, 'index']);
    Route::post('/projects/{project}/releases', [ApiProjectReleaseController::class, 'store']);
    Route::patch('/projects/{id}', [ApiProjectController::class, 'update']);
    Route::delete('/projects/{id}', [ApiProjectController::class, 'destroy']);

    // Sprints
    Route::get('/sprints', [ApiSprintController::class, 'index']);
    Route::post('/sprints', [ApiSprintController::class, 'store']);
    Route::patch('/sprints/{sprint}', [ApiSprintController::class, 'update']);
    Route::post('/sprints/{sprint}/start', [ApiSprintController::class, 'start']);
    Route::post('/sprints/{sprint}/complete', [ApiSprintController::class, 'complete']);
    Route::delete('/sprints/{sprint}', [ApiSprintController::class, 'destroy']);

    // Agent Runs & Context Pack
    Route::get('/agent-runs', [ApiAgentRunController::class, 'index']);
    Route::post('/agent-runs', [ApiAgentRunController::class, 'store']);
    Route::get('/agent-runs/{agentRun}', [ApiAgentRunController::class, 'show']);
    Route::patch('/agent-runs/{agentRun}', [ApiAgentRunController::class, 'update']);
    Route::post('/agent-runs/{agentRun}/events', [ApiAgentRunController::class, 'event']);
    Route::post('/agent-runs/{agentRun}/evidence', [ApiAgentRunController::class, 'evidence']);
    Route::post('/agent-runs/{agentRun}/handoff', [ApiAgentRunController::class, 'handoff']);
    Route::get('/context-pack', [ApiAgentRunController::class, 'context']);

    // Desktop Pairing API
    Route::post('/desktop/pairing/start', [DesktopPairingController::class, 'start']);
    Route::get('/desktop/pairing/{pairingId}/status', [DesktopPairingController::class, 'status']);
};

// Register API under both /api and /api/v1
Route::prefix('api')->group($registerApiRoutes);
Route::prefix('api/v1')->group($registerApiRoutes);

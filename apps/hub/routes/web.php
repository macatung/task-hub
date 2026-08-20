<?php

use App\Http\Controllers\Api\ApiAgentRunController;
use App\Http\Controllers\Api\ApiCapabilityController;
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

Route::get('/', [TaskController::class, 'index'])->name('hub.index');
Route::get('/tasks', [TaskController::class, 'index'])->name('tasks.index');

Route::get('/auth/github', [GithubAuthController::class, 'redirect'])->name('auth.github');
Route::get('/auth/github/callback', [GithubAuthController::class, 'callback'])->name('auth.github.callback');
Route::post('/auth/github/logout', [GithubAuthController::class, 'logout'])->name('auth.github.logout');

Route::prefix('api/v1')->group(function () {
    Route::get('/capabilities', [ApiCapabilityController::class, 'show']);
    Route::get('/tasks', [ApiTaskController::class, 'index']);
    Route::post('/tasks', [ApiTaskController::class, 'store']);
    Route::patch('/tasks/{id}', [ApiTaskController::class, 'update']);
    Route::delete('/tasks/{id}', [ApiTaskController::class, 'destroy']);
    Route::post('/tasks/ai-preview', [ApiTaskController::class, 'aiPreview']);
    Route::post('/tasks/ai-generate', [ApiTaskController::class, 'aiGenerate']);
    Route::get('/projects', [ApiProjectController::class, 'index']);
    Route::post('/projects', [ApiProjectController::class, 'store']);
    Route::patch('/projects/{id}', [ApiProjectController::class, 'update']);
    Route::delete('/projects/{id}', [ApiProjectController::class, 'destroy']);
    Route::get('/projects/{project}/documents', [ApiProjectDocumentController::class, 'index']);
    Route::post('/projects/{project}/documents', [ApiProjectDocumentController::class, 'store']);
    Route::get('/projects/{project}/releases', [ApiProjectReleaseController::class, 'index']);
    Route::post('/projects/{project}/releases', [ApiProjectReleaseController::class, 'store']);
    Route::get('/sprints', [ApiSprintController::class, 'index']);
    Route::post('/sprints', [ApiSprintController::class, 'store']);
    Route::patch('/sprints/{sprint}', [ApiSprintController::class, 'update']);
    Route::get('/agent-runs', [ApiAgentRunController::class, 'index']);
    Route::post('/agent-runs', [ApiAgentRunController::class, 'store']);
    Route::get('/agent-runs/{agentRun}', [ApiAgentRunController::class, 'show']);
    Route::patch('/agent-runs/{agentRun}', [ApiAgentRunController::class, 'update']);
    Route::post('/agent-runs/{agentRun}/events', [ApiAgentRunController::class, 'event']);
    Route::post('/agent-runs/{agentRun}/evidence', [ApiAgentRunController::class, 'evidence']);
    Route::post('/agent-runs/{agentRun}/handoff', [ApiAgentRunController::class, 'handoff']);
    Route::get('/context-pack', [ApiAgentRunController::class, 'context']);
    Route::post('/desktop/pairing/start', [DesktopPairingController::class, 'start']);
    Route::get('/desktop/pairing/{pairingId}/status', [DesktopPairingController::class, 'status']);
});

Route::post('/mcp', [TaskHubMcpController::class, 'handle']);
Route::get('/desktop/pairing/{pairingId}/approve', [DesktopPairingController::class, 'approveForm']);
Route::post('/desktop/pairing/{pairingId}/approve', [DesktopPairingController::class, 'approve']);
Route::post('/desktop/pairing/{pairingId}/deny', [DesktopPairingController::class, 'deny']);

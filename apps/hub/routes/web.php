<?php

use App\Http\Controllers\Api\ApiAgentRunController;
use App\Http\Controllers\Api\ApiCapabilityController;
use App\Http\Controllers\Api\ApiAgentRunnerController;
use App\Http\Controllers\Api\ApiPlanController;
use App\Http\Controllers\Api\ApiSubscriptionController;
use App\Http\Controllers\Api\ApiInvoiceController;
use App\Http\Controllers\Api\WorkspaceController;
use App\Http\Controllers\Api\WorkspaceCredentialController;
use App\Http\Controllers\Api\ApiProjectController;
use App\Http\Controllers\Api\ApiProjectDocumentController;
use App\Http\Controllers\Api\ApiProjectRoadmapExportController;
use App\Http\Controllers\Api\ApiProjectReleaseController;
use App\Http\Controllers\Api\ApiSprintController;
use App\Http\Controllers\Api\ApiTaskController;
use App\Http\Controllers\Api\TaskHubMcpController;
use App\Http\Controllers\DesktopPairingController;
use App\Http\Controllers\GithubAuthController;
use App\Http\Controllers\PricingController;
use App\Http\Controllers\TaskController;
use App\Http\Controllers\WorkspaceBillingController;
use Illuminate\Support\Facades\Route;

// Hub SaaS Web Views
Route::get('/', [TaskController::class, 'landing'])->name('hub.landing');
Route::get('/pricing', [PricingController::class, 'index'])->name('pricing');
Route::get('/tasks', [TaskController::class, 'index'])->name('tasks.index');
Route::get('/workspace', [TaskController::class, 'index'])->name('tasks.workspace');
Route::get('/workspaces/{workspace}/billing', [WorkspaceBillingController::class, 'show'])->name('workspaces.billing');
Route::post('/contact', [\App\Http\Controllers\ContactController::class, 'store'])->name('contact.store');
Route::post('/summon', [\App\Http\Controllers\ContactController::class, 'store'])->name('contact.summon');

// Admin CMS Authentication
Route::get('/admin/login', [\App\Http\Controllers\Admin\AdminAuthController::class, 'showLogin'])->name('admin.login');
Route::post('/admin/login', [\App\Http\Controllers\Admin\AdminAuthController::class, 'login'])->name('admin.login.post');
Route::post('/admin/logout', [\App\Http\Controllers\Admin\AdminAuthController::class, 'logout'])->name('admin.logout');

// Public Analytics Beacon API
Route::post('/api/analytics/event', [\App\Http\Controllers\Admin\AdminAnalyticsController::class, 'recordEvent'])->name('api.analytics.event');

// Admin CMS Protected Area
Route::middleware('admin.auth')->prefix('admin')->group(function () {
    Route::get('/', [\App\Http\Controllers\Admin\AdminDashboardController::class, 'index'])->name('admin.dashboard');
    Route::get('/analytics', [\App\Http\Controllers\Admin\AdminAnalyticsController::class, 'index'])->name('admin.analytics');
    Route::resource('skills', \App\Http\Controllers\Admin\AdminSkillController::class)->names('admin.skills');
    Route::resource('experiences', \App\Http\Controllers\Admin\AdminExperienceController::class)->names('admin.experiences');
    Route::resource('articles', \App\Http\Controllers\Admin\AdminArticleController::class)->names('admin.articles');
    Route::resource('contacts', \App\Http\Controllers\Admin\AdminContactController::class)->names('admin.contacts');
    Route::resource('projects', \App\Http\Controllers\Admin\AdminProjectController::class)->names('admin.projects');
    Route::get('/settings', [\App\Http\Controllers\Admin\AdminSettingController::class, 'index'])->name('admin.settings.index');
    Route::match(['post', 'put', 'patch'], '/settings', [\App\Http\Controllers\Admin\AdminSettingController::class, 'update'])->name('admin.settings.update');
});

// GitHub OAuth identity and authorization
Route::get('/auth/github', [GithubAuthController::class, 'redirect'])->name('auth.github');
Route::get('/auth/github/callback', [GithubAuthController::class, 'callback'])->name('auth.github.callback');
Route::post('/auth/github/logout', [GithubAuthController::class, 'logout'])->name('auth.github.logout');

// MCP Model Context Protocol Endpoint
Route::match(['get', 'post', 'options'], '/mcp', [TaskHubMcpController::class, 'handle'])
    ->name('mcp.handle')
    ->withoutMiddleware([\App\Http\Middleware\HandleInertiaRequests::class, \App\Http\Middleware\TrackVisitorAnalytics::class]);
Route::match(['get', 'post', 'options'], '/api/mcp', [TaskHubMcpController::class, 'handle'])
    ->middleware('legacy.api')
    ->withoutMiddleware([\App\Http\Middleware\HandleInertiaRequests::class, \App\Http\Middleware\TrackVisitorAnalytics::class]);
Route::match(['get', 'post', 'options'], '/api/tasks/mcp', [TaskHubMcpController::class, 'handle'])
    ->middleware('legacy.api')
    ->withoutMiddleware([\App\Http\Middleware\HandleInertiaRequests::class, \App\Http\Middleware\TrackVisitorAnalytics::class]);
Route::match(['get', 'post', 'options'], '/api/v1/mcp', [TaskHubMcpController::class, 'handle'])
    ->withoutMiddleware([\App\Http\Middleware\HandleInertiaRequests::class, \App\Http\Middleware\TrackVisitorAnalytics::class]);

// Desktop Agent Pairing Web UI
Route::get('/desktop/pairing/{pairingId}/approve', [DesktopPairingController::class, 'approveForm'])->name('desktop.pairing.form');
Route::post('/desktop/pairing/{pairingId}/approve', [DesktopPairingController::class, 'approve'])->name('desktop.pairing.approve');
Route::post('/desktop/pairing/{pairingId}/deny', [DesktopPairingController::class, 'deny'])->name('desktop.pairing.deny');

// Common API registration closure
$registerApiRoutes = function () {
    // Plans & Public Pricing
    Route::get('/plans', [ApiPlanController::class, 'index']);

    // Capabilities
    Route::get('/capabilities', [ApiCapabilityController::class, 'show']);
    Route::get('/workspaces', [WorkspaceController::class, 'index'])->middleware('auth');
    Route::post('/workspaces', [WorkspaceController::class, 'store'])->middleware('auth');
    Route::post('/workspaces/{workspace}/switch', [WorkspaceController::class, 'switch'])->middleware('auth');
    Route::post('/workspaces/{workspace}/members', [WorkspaceController::class, 'addMember'])->middleware('auth');
    Route::patch('/workspaces/{workspace}/members/{user}', [WorkspaceController::class, 'updateMember'])->middleware('auth');
    Route::get('/workspaces/{workspace}/credentials', [WorkspaceCredentialController::class, 'index'])->middleware('auth');
    Route::post('/workspaces/{workspace}/credentials', [WorkspaceCredentialController::class, 'store'])->middleware('auth');
    Route::delete('/workspaces/{workspace}/credentials/{credential}', [WorkspaceCredentialController::class, 'destroy'])->middleware('auth');
    Route::post('/runners/register', [ApiAgentRunnerController::class, 'register']);
    Route::get('/runners', [ApiAgentRunnerController::class, 'index']);
    Route::get('/runners/dashboard', [ApiAgentRunnerController::class, 'dashboard'])->middleware('auth');
    Route::post('/runners/{agentRunner}/heartbeat', [ApiAgentRunnerController::class, 'heartbeat']);
    Route::post('/runners/{agentRunner}/revoke', [ApiAgentRunnerController::class, 'revoke']);
    Route::get('/runners/{agentRunner}/jobs/claim', [ApiAgentRunnerController::class, 'claim']);
    Route::get('/runners/{agentRunner}/jobs/{agentRun}/credential', [ApiAgentRunnerController::class, 'credential']);
    Route::post('/agent-runs/{agentRun}/events', [ApiAgentRunnerController::class, 'event']);
    Route::post('/agent-runs/{agentRun}/logs', [ApiAgentRunnerController::class, 'log']);
    Route::post('/agent-runs/{agentRun}/cancel', [ApiAgentRunnerController::class, 'cancel']);

    // Connected Desktop Agents Registry & Command Streaming
    Route::post('/desktop/agents/register', [ApiAgentRunnerController::class, 'desktopRegister']);
    Route::post('/desktop/agents/heartbeat', [ApiAgentRunnerController::class, 'desktopHeartbeat']);
    Route::get('/desktop/agents', [ApiAgentRunnerController::class, 'desktopIndex']);
    Route::get('/desktop/agents/{agentRunner}/command-stream', [ApiAgentRunnerController::class, 'desktopCommandStream']);

    // Tasks and AI workflows
    Route::get('/tasks', [ApiTaskController::class, 'index'])->middleware('auth');
    Route::post('/tasks', [ApiTaskController::class, 'store'])->middleware('auth');
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
    Route::get('/tasks/agent-runs/stream', [ApiAgentRunController::class, 'stream'])->middleware('auth');
    Route::post('/tasks/agent-runs', [ApiAgentRunController::class, 'store']);
    Route::get('/tasks/agent-runs/{agentRun}', [ApiAgentRunController::class, 'show']);
    Route::patch('/tasks/agent-runs/{agentRun}', [ApiAgentRunController::class, 'update']);
    Route::post('/tasks/agent-runs/{agentRun}/events', [ApiAgentRunController::class, 'event']);
    Route::post('/tasks/agent-runs/{agentRun}/evidence', [ApiAgentRunController::class, 'evidence']);
    Route::post('/tasks/agent-runs/{agentRun}/handoff', [ApiAgentRunController::class, 'handoff']);
    Route::post('/tasks/agent-runs/{agentRun}/cancel', [ApiAgentRunController::class, 'cancel']);
    Route::get('/tasks/context-pack', [ApiAgentRunController::class, 'context']);
    Route::post('/tasks/{task}/documents', [ApiProjectDocumentController::class, 'attach'])->middleware(['auth', 'workspace']);
    Route::delete('/tasks/{task}/documents/{document}', [ApiProjectDocumentController::class, 'detach'])->middleware(['auth', 'workspace']);
    Route::post('/tasks/{task}/dispatch', [ApiAgentRunController::class, 'dispatch']);
    Route::post('/tasks/{task}/dispatch-sequence', [ApiAgentRunController::class, 'dispatchEpic']);
    Route::get('/tasks/{task}/history', [ApiTaskController::class, 'history']);
    Route::patch('/tasks/{id}', [ApiTaskController::class, 'update'])->middleware('auth');
    Route::delete('/tasks/{id}', [ApiTaskController::class, 'destroy'])->middleware('auth');

    // Projects
    Route::get('/projects', [ApiProjectController::class, 'index'])->middleware('auth');
    Route::post('/projects', [ApiProjectController::class, 'store'])->middleware('auth');
    Route::get('/projects/{project}/roadmap-export', ApiProjectRoadmapExportController::class)->middleware('auth');
    Route::get('/projects/github/repositories', [ApiProjectController::class, 'githubRepositories'])->middleware('auth');
    Route::post('/projects/from-github', [ApiProjectController::class, 'storeFromGithub'])->middleware('auth');
    Route::get('/projects/{project}/github', [ApiProjectController::class, 'githubStatus'])->middleware(['auth', 'workspace']);
    Route::post('/projects/{project}/github/connect', [ApiProjectController::class, 'connectGithub'])->middleware('auth');
    Route::post('/projects/{project}/github/sync', [ApiProjectController::class, 'syncGithub'])->middleware('auth');
    Route::get('/projects/{project}/mcp', [ApiProjectController::class, 'getMcpInfo'])->middleware('auth');
    Route::post('/projects/{project}/mcp/token', [ApiProjectController::class, 'saveMcpToken'])->middleware('auth');
    Route::post('/projects/{project}/mcp/generate-token', [ApiProjectController::class, 'generateMcpToken'])->middleware('auth');
    Route::get('/projects/{project}/documents', [ApiProjectDocumentController::class, 'index'])->middleware(['auth', 'workspace']);
    Route::post('/projects/{project}/documents', [ApiProjectDocumentController::class, 'store'])->middleware(['auth', 'workspace']);
    Route::post('/projects/{project}/documents/import-manifest', [ApiProjectDocumentController::class, 'importManifest'])->middleware(['auth', 'workspace']);
    Route::post('/projects/{project}/documents/import-generated', [ApiProjectDocumentController::class, 'importGenerated'])->middleware(['auth', 'workspace']);
    Route::get('/projects/{project}/documents/manifest-template', [ApiProjectDocumentController::class, 'manifestTemplate'])->middleware(['auth', 'workspace']);
    Route::patch('/projects/documents/{document}', [ApiProjectDocumentController::class, 'update'])->middleware(['auth', 'workspace']);
    Route::delete('/projects/documents/{document}', [ApiProjectDocumentController::class, 'destroy'])->middleware(['auth', 'workspace']);
    Route::get('/projects/{project}/releases', [ApiProjectReleaseController::class, 'index'])->middleware(['auth', 'workspace']);
    Route::post('/projects/{project}/releases', [ApiProjectReleaseController::class, 'store'])->middleware(['auth', 'workspace']);
    Route::patch('/projects/{id}', [ApiProjectController::class, 'update'])->middleware('auth');
    Route::delete('/projects/{id}', [ApiProjectController::class, 'destroy'])->middleware('auth');

    // Sprints
    Route::middleware(['auth', 'workspace'])->group(function () {
        Route::get('/sprints', [ApiSprintController::class, 'index']);
        Route::post('/sprints', [ApiSprintController::class, 'store']);
        Route::patch('/sprints/{sprint}', [ApiSprintController::class, 'update']);
        Route::post('/sprints/{sprint}/start', [ApiSprintController::class, 'start']);
        Route::post('/sprints/{sprint}/complete', [ApiSprintController::class, 'complete']);
        Route::post('/sprints/move-tasks', [ApiSprintController::class, 'moveTasks']);
        Route::delete('/sprints/{sprint}', [ApiSprintController::class, 'destroy']);
    });

    // Agent Runs, Models, Quota & Context Pack
    Route::get('/agent/models', [ApiAgentRunController::class, 'models']);
    Route::get('/tasks/agent/models', [ApiAgentRunController::class, 'models']);
    Route::match(['get', 'post'], '/agent/quota', [ApiAgentRunController::class, 'quota']);
    Route::match(['get', 'post'], '/tasks/agent/quota', [ApiAgentRunController::class, 'quota']);
    Route::get('/agent-runs', [ApiAgentRunController::class, 'index']);
    Route::post('/agent-runs', [ApiAgentRunController::class, 'store']);
    Route::get('/agent-runs/{agentRun}', [ApiAgentRunController::class, 'show']);
    Route::patch('/agent-runs/{agentRun}', [ApiAgentRunController::class, 'update']);
    Route::post('/agent-runs/{agentRun}/events', [ApiAgentRunController::class, 'event']);
    Route::post('/agent-runs/{agentRun}/evidence', [ApiAgentRunController::class, 'evidence']);
    Route::post('/agent-runs/{agentRun}/handoff', [ApiAgentRunController::class, 'handoff']);
    Route::get('/context-pack', [ApiAgentRunController::class, 'context']);

    // Canonical SaaS tenant-scoped API. Legacy unscoped routes remain for desktop compatibility,
    // while authenticated requests are filtered by WorkspaceContext in their controllers.
    Route::prefix('workspaces/{workspace}')->middleware(['auth', 'workspace'])->group(function () {
        Route::get('/subscription', [ApiSubscriptionController::class, 'show']);
        Route::post('/subscription', [ApiSubscriptionController::class, 'update']);
        Route::post('/subscription/cancel', [ApiSubscriptionController::class, 'cancel']);
        Route::get('/invoices', [ApiInvoiceController::class, 'index']);
        Route::get('/quota', [ApiSubscriptionController::class, 'quota']);
        Route::get('/projects', [ApiProjectController::class, 'index']);
        Route::post('/projects', [ApiProjectController::class, 'store']);
        Route::get('/tasks', [ApiTaskController::class, 'index']);
        Route::post('/tasks', [ApiTaskController::class, 'store']);
        Route::get('/agent-runs', [ApiAgentRunController::class, 'index']);
        Route::post('/agent-runs', [ApiAgentRunController::class, 'store']);
        Route::get('/credentials', [WorkspaceCredentialController::class, 'index']);
        Route::post('/credentials', [WorkspaceCredentialController::class, 'store']);
    });

    // Desktop Pairing API
    Route::post('/desktop/pairing/start', [DesktopPairingController::class, 'start']);
    Route::get('/desktop/pairing/{pairingId}/status', [DesktopPairingController::class, 'status']);

    // Project-scoped API consumed by the authenticated desktop companion.
    Route::middleware('desktop.project')->prefix('desktop')->group(function () {
        Route::get('/bootstrap', [ApiProjectController::class, 'desktopBootstrap']);
        Route::get('/projects', [ApiProjectController::class, 'index']);
        Route::get('/tasks', [ApiTaskController::class, 'index']);
        Route::post('/tasks', [ApiTaskController::class, 'store']);
        Route::get('/tasks/{task}/history', [ApiTaskController::class, 'history']);
        Route::patch('/tasks/{id}', [ApiTaskController::class, 'update']);
        Route::post('/projects/{project}/documents/import-generated', [ApiProjectDocumentController::class, 'importGenerated']);
    });
};

// Register API under both /api and /api/v1
// /api is retained only as a compatibility alias. New clients must call /api/v1.
Route::prefix('api')->middleware('legacy.api')->group($registerApiRoutes);
Route::prefix('api/v1')->group($registerApiRoutes);

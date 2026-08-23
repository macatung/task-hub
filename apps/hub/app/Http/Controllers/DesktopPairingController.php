<?php

namespace App\Http\Controllers;

use App\Models\DesktopPairingSession;
use App\Models\Project;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Str;

class DesktopPairingController extends Controller
{
    public function start(Request $request)
    {
        $validated = $request->validate(['project_id' => 'nullable|integer|exists:projects,id']);
        $pairingId = (string) Str::uuid();
        $verifier = Str::random(64);
        $code = strtoupper(Str::random(4) . '-' . Str::random(4));
        $expiresAt = now()->addMinutes(10);
        DesktopPairingSession::create([
            'pairing_id' => $pairingId,
            'project_id' => $validated['project_id'] ?? null,
            'verifier_hash' => hash('sha256', $verifier),
            'code_hash' => hash('sha256', $code),
            'expires_at' => $expiresAt,
        ]);

        $base = rtrim($request->getSchemeAndHttpHost(), '/');
        return response()->json([
            'success' => true,
            'pairing_id' => $pairingId,
            'device_secret' => $verifier,
            'code' => $code,
            'expires_at' => $expiresAt->toIso8601String(),
            'approval_url' => $base . '/desktop/pairing/' . $pairingId . '/approve?code=' . urlencode($code),
        ], 201);
    }

    public function status(Request $request, string $pairingId)
    {
        $session = DesktopPairingSession::with(['project.workspace', 'workspace', 'user'])->where('pairing_id', $pairingId)->firstOrFail();
        $secret = (string) $request->header('X-Desktop-Pairing-Secret');
        if ($secret === '' || !hash_equals($session->verifier_hash, hash('sha256', $secret))) {
            return response()->json(['success' => false, 'message' => 'Invalid pairing secret.'], 401);
        }
        if ($session->expires_at->isPast() && $session->status === 'pending') $session->update(['status' => 'expired']);
        if ($session->status !== 'approved') return response()->json(['success' => true, 'status' => $session->status]);
        if ($session->consumed_at) return response()->json(['success' => true, 'status' => 'consumed']);

        $project = $session->project;
        if (!$project) return response()->json(['success' => false, 'status' => 'rejected', 'message' => 'No project is linked to this pairing.'], 422);
        $workspace = $project->workspace;
        if (!$workspace) return response()->json(['success' => false, 'status' => 'rejected', 'message' => 'Project workspace is unavailable.'], 422);
        $workspaceToken = Str::random(64);
        $session->update(['workspace_token_hash' => hash('sha256', $workspaceToken), 'consumed_at' => now()]);
        return response()->json([
            'success' => true,
            'status' => 'approved',
            'project_id' => $session->project_id,
            'project_title' => $project->title,
            'workspace_id' => $workspace->id,
            'workspace_name' => $workspace->name,
            'user_email' => $session->user?->email,
            'user_name' => $session->user?->name,
            'task_hub_url' => rtrim($request->getSchemeAndHttpHost(), '/'),
            'mcp_token' => $workspaceToken,
        ]);
    }

    public function approveForm(Request $request, string $pairingId)
    {
        $session = DesktopPairingSession::with('project')->where('pairing_id', $pairingId)->firstOrFail();
        $code = (string) $request->query('code');
        if (!hash_equals($session->code_hash, hash('sha256', strtoupper($code)))) abort(403, 'Invalid pairing code.');
        if ($session->expires_at->isPast() || $session->status !== 'pending') abort(410, 'Pairing request has expired or was already processed.');
        if (!Auth::check()) {
            $request->session()->put('desktop_pairing_intended', $request->fullUrl());
            return redirect('/auth/github');
        }
        return view('desktop.pairing', ['session' => $session, 'code' => $code]);
    }

    public function approve(Request $request, string $pairingId)
    {
        abort_unless(Auth::check(), 401);
        $session = DesktopPairingSession::with('project')->where('pairing_id', $pairingId)->firstOrFail();
        if (!hash_equals($session->code_hash, hash('sha256', strtoupper((string) $request->input('code'))))) abort(403);
        if ($session->expires_at->isPast() || $session->status !== 'pending') abort(410);
        $workspaceId = (int) $request->session()->get('current_workspace_id');
        if (!$workspaceId) $workspaceId = (int) Auth::user()->workspaces()->value('workspaces.id');
        $workspace = \App\Models\Workspace::whereKey($workspaceId)->firstOrFail();
        abort_unless(Auth::user()->workspaces()->whereKey($workspace->id)->exists(), 403, 'You do not have access to this workspace.');
        $project = $session->project ?: Project::where('workspace_id', $workspace->id)->orderBy('id')->firstOrFail();
        abort_unless((int) $project->workspace_id === (int) $workspace->id, 403, 'Project does not belong to the active workspace.');

        if (!$project->task_hub_mcp_token) {
            $project->task_hub_mcp_token = Crypt::encryptString(Str::random(64));
            $project->save();
        }
        $session->update(['status' => 'approved', 'user_id' => Auth::id(), 'workspace_id' => $workspace->id, 'project_id' => $project->id, 'approved_at' => now()]);
        return view('desktop.pairing-approved', ['session' => $session->fresh('project')]);
    }

    public function deny(Request $request, string $pairingId)
    {
        abort_unless(Auth::check(), 401);
        $session = DesktopPairingSession::where('pairing_id', $pairingId)->firstOrFail();
        $session->update(['status' => 'denied', 'user_id' => Auth::id()]);
        return view('desktop.pairing-denied');
    }
}

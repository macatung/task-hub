<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Workspace;
use App\Services\WorkspaceContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ApiInvoiceController extends Controller
{
    /**
     * List all billing invoices for a workspace.
     */
    public function index(
        Request $request,
        Workspace $workspace,
        WorkspaceContext $context
    ): JsonResponse {
        $context->authorizeRole($request, ['owner', 'admin', 'developer', 'viewer']);

        $invoices = $workspace->invoices()->latest()->get();

        return response()->json([
            'success' => true,
            'data' => $invoices,
        ]);
    }
}

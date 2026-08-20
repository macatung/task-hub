<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;

class ApiCapabilityController extends Controller
{
    public function show()
    {
        return response()->json([
            'data' => [
                'api_version' => 'v1',
                'minimum_desktop_version' => '1.0.1',
                'mcp_protocol_version' => '2024-11-05',
                'mcp_tools' => ['start_agent_run', 'update_agent_run', 'attach_verification_evidence', 'complete_agent_handoff'],
                'features' => ['device_pairing', 'structured_handoff', 'workspace_roles'],
            ],
        ]);
    }
}

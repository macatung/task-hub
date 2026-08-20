<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AnalyticsEvent;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class AnalyticsEventController extends Controller
{
    /**
     * Store client-side beacon interaction event
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'event_type' => 'required|string|max:64',
            'event_data' => 'nullable|array',
        ]);

        $sessionId = $request->session()->getId() ?: ('sess_' . Str::random(16));

        AnalyticsEvent::create([
            'session_id' => $sessionId,
            'event_type' => $validated['event_type'],
            'event_data' => $validated['event_data'] ?? [],
            'created_at' => Carbon::now(),
        ]);

        return response()->json(['success' => true]);
    }
}

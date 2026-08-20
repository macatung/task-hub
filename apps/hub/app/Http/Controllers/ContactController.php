<?php

namespace App\Http\Controllers;

use App\Http\Requests\ContactRequest;
use App\Models\ContactSubmission;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Str;

class ContactController extends Controller
{
    /**
     * Store a newly created contact / summoning altar submission.
     */
    public function store(ContactRequest $request): RedirectResponse
    {
        $validated = $request->validated();

        // Generate unique reference_id: SUMMON-XXXX (uppercase alphanumeric string)
        do {
            $referenceId = 'SUMMON-' . strtoupper(Str::random(6));
        } while (ContactSubmission::where('reference_id', $referenceId)->exists());

        $submission = ContactSubmission::create([
            'reference_id' => $referenceId,
            'name' => $validated['name'],
            'email' => $validated['email'],
            'project_type' => $validated['project_type'],
            'coffee_offering' => $validated['coffee_offering'],
            'message' => $validated['message'],
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        $successMessage = 'Tín hiệu đã được truyền đi qua màn đêm! Ma Cà Tưng sẽ hồi đáp trong thời gian sớm nhất. ☕✨';

        return redirect()->back()->with([
            'flash' => [
                'success' => $successMessage,
                'reference_id' => $submission->reference_id,
            ],
            'success' => $successMessage,
            'reference_id' => $submission->reference_id,
        ]);
    }
}

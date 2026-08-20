<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Experience;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AdminExperienceController extends Controller
{
    public function index(): Response
    {
        $experiences = Experience::ordered()->get();

        return Inertia::render('Admin/Experiences/Index', [
            'experiences' => $experiences,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'role' => 'required|string|max:128',
            'company' => 'required|string|max:128',
            'period' => 'required|string|max:64',
            'type' => 'required|string|max:64',
            'location' => 'required|string|max:64',
            'summary' => 'required|string',
            'achievements' => 'nullable|array',
            'technologies' => 'nullable|array',
            'order' => 'nullable|integer',
        ]);

        Experience::create($validated);

        return redirect()->route('admin.experiences.index')->with('success', 'Cột mốc kinh nghiệm đã được thêm thành công!');
    }

    public function update(Request $request, Experience $experience): RedirectResponse
    {
        $validated = $request->validate([
            'role' => 'required|string|max:128',
            'company' => 'required|string|max:128',
            'period' => 'required|string|max:64',
            'type' => 'required|string|max:64',
            'location' => 'required|string|max:64',
            'summary' => 'required|string',
            'achievements' => 'nullable|array',
            'technologies' => 'nullable|array',
            'order' => 'nullable|integer',
        ]);

        $experience->update($validated);

        return redirect()->route('admin.experiences.index')->with('success', 'Cột mốc kinh nghiệm đã được cập nhật thành công!');
    }

    public function destroy(Experience $experience): RedirectResponse
    {
        $experience->delete();

        return redirect()->route('admin.experiences.index')->with('success', 'Cột mốc kinh nghiệm đã được xóa thành công!');
    }
}

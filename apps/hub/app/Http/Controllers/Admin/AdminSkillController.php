<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Skill;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AdminSkillController extends Controller
{
    public function index(): Response
    {
        $skills = Skill::ordered()->get();

        return Inertia::render('Admin/Skills/Index', [
            'skills' => $skills,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:128',
            'category' => 'required|string|in:frontend,backend,cloud,ai',
            'level' => 'required|integer|min:1|max:100',
            'rune' => 'required|string|max:32',
            'tag' => 'required|string|max:64',
            'order' => 'nullable|integer',
        ]);

        Skill::create($validated);

        return redirect()->route('admin.skills.index')->with('success', 'Kỹ năng mới đã được thêm thành công!');
    }

    public function update(Request $request, Skill $skill): RedirectResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:128',
            'category' => 'required|string|in:frontend,backend,cloud,ai',
            'level' => 'required|integer|min:1|max:100',
            'rune' => 'required|string|max:32',
            'tag' => 'required|string|max:64',
            'order' => 'nullable|integer',
        ]);

        $skill->update($validated);

        return redirect()->route('admin.skills.index')->with('success', 'Kỹ năng đã được cập nhật thành công!');
    }

    public function destroy(Skill $skill): RedirectResponse
    {
        $skill->delete();

        return redirect()->route('admin.skills.index')->with('success', 'Kỹ năng đã được xóa thành công!');
    }
}

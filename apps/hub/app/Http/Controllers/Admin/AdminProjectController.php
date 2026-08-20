<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Project;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class AdminProjectController extends Controller
{
    /**
     * Display a listing of projects.
     */
    public function index(): Response
    {
        $projects = Project::ordered()->get();

        return Inertia::render('Admin/Projects/Index', [
            'projects' => $projects,
        ]);
    }

    /**
     * Store a newly created project.
     */
    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'slug' => 'nullable|string|max:255|unique:projects,slug',
            'tagline' => 'required|string|max:255',
            'description' => 'required|string',
            'category' => 'required|string|in:fullstack,creative,ai-web3,tools',
            'tags' => 'nullable|array',
            'tech_stack' => 'nullable|array',
            'metrics' => 'nullable|array',
            'live_url' => 'nullable|url|max:255',
            'github_url' => 'nullable|url|max:255',
            'featured' => 'boolean',
            'order' => 'nullable|integer',
        ]);

        if (empty($validated['slug'])) {
            $validated['slug'] = Str::slug($validated['title']) . '-' . Str::random(4);
        }

        Project::create($validated);

        return redirect()->route('admin.projects.index')->with('success', 'Dự án đã được thêm thành công!');
    }

    /**
     * Update the specified project.
     */
    public function update(Request $request, Project $project): RedirectResponse
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'slug' => 'required|string|max:255|unique:projects,slug,' . $project->id,
            'tagline' => 'required|string|max:255',
            'description' => 'required|string',
            'category' => 'required|string|in:fullstack,creative,ai-web3,tools',
            'tags' => 'nullable|array',
            'tech_stack' => 'nullable|array',
            'metrics' => 'nullable|array',
            'live_url' => 'nullable|url|max:255',
            'github_url' => 'nullable|url|max:255',
            'featured' => 'boolean',
            'order' => 'nullable|integer',
        ]);

        $project->update($validated);

        return redirect()->route('admin.projects.index')->with('success', 'Dự án đã được cập nhật thành công!');
    }

    /**
     * Toggle featured status.
     */
    public function toggleFeatured(Project $project): RedirectResponse
    {
        $project->update([
            'featured' => !$project->featured,
        ]);

        return redirect()->route('admin.projects.index')->with('success', 'Trạng thái nổi bật đã được thay đổi!');
    }

    /**
     * Remove the specified project.
     */
    public function destroy(Project $project): RedirectResponse
    {
        $project->delete();

        return redirect()->route('admin.projects.index')->with('success', 'Dự án đã được xóa thành công!');
    }
}

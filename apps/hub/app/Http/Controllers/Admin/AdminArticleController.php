<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Article;
use Carbon\Carbon;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class AdminArticleController extends Controller
{
    public function index(): Response
    {
        $articles = Article::latest('created_at')->get();

        return Inertia::render('Admin/Articles/Index', [
            'articles' => $articles,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'slug' => 'nullable|string|max:255|unique:articles,slug',
            'excerpt' => 'nullable|string|max:500',
            'content' => 'required|string',
            'tags' => 'nullable|array',
            'reading_time_min' => 'nullable|integer',
            'is_published' => 'boolean',
        ]);

        if (empty($validated['slug'])) {
            $validated['slug'] = Str::slug($validated['title']) . '-' . Str::random(4);
        }

        if ($validated['is_published']) {
            $validated['published_at'] = Carbon::now();
        }

        Article::create($validated);

        return redirect()->route('admin.articles.index')->with('success', 'Bài viết đã được tạo thành công!');
    }

    public function update(Request $request, Article $article): RedirectResponse
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'slug' => 'required|string|max:255|unique:articles,slug,' . $article->id,
            'excerpt' => 'nullable|string|max:500',
            'content' => 'required|string',
            'tags' => 'nullable|array',
            'reading_time_min' => 'nullable|integer',
            'is_published' => 'boolean',
        ]);

        if ($validated['is_published'] && !$article->is_published) {
            $validated['published_at'] = Carbon::now();
        }

        $article->update($validated);

        return redirect()->route('admin.articles.index')->with('success', 'Bài viết đã được cập nhật thành công!');
    }

    public function destroy(Article $article): RedirectResponse
    {
        $article->delete();

        return redirect()->route('admin.articles.index')->with('success', 'Bài viết đã được xóa thành công!');
    }
}

<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use App\Models\Article;
use App\Models\SiteSetting;
use Carbon\Carbon;

class BlogController extends Controller
{
    /**
     * Display a listing of published articles.
     */
    public function index(Request $request): Response
    {
        $search = $request->query('q');
        $tag = $request->query('tag');

        $query = Article::query()->where('is_published', true);

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                  ->orWhere('excerpt', 'like', "%{$search}%")
                  ->orWhere('content', 'like', "%{$search}%");
            });
        }

        if ($tag) {
            $query->whereJsonContains('tags', $tag);
        }

        $articles = $query->orderBy('published_at', 'desc')->get()->map(function ($article) {
            return [
                'id' => $article->id,
                'title' => $article->title,
                'slug' => $article->slug,
                'excerpt' => $article->excerpt,
                'cover_image' => $article->cover_image ?? null,
                'tags' => $article->tags ?? [],
                'reading_time_min' => $article->reading_time_min ?? 5,
                'published_at' => $article->published_at ? Carbon::parse($article->published_at)->format('d/m/Y') : '',
                'views_count' => 120 + ($article->id * 47),
            ];
        });

        // Collect all unique tags
        $allTags = Article::where('is_published', true)
            ->get()
            ->pluck('tags')
            ->flatten()
            ->filter()
            ->unique()
            ->values();

        $settings = SiteSetting::all()->pluck('value', 'key')->toArray();

        return Inertia::render('Blog/Index', [
            'articles' => $articles,
            'allTags' => $allTags,
            'currentTag' => $tag,
            'currentSearch' => $search,
            'settings' => $settings,
        ]);
    }

    /**
     * Display a single article.
     */
    public function show(string $slug): Response
    {
        $article = Article::where('slug', $slug)
            ->where('is_published', true)
            ->firstOrFail();

        // Related articles
        $relatedArticles = Article::where('is_published', true)
            ->where('id', '!=', $article->id)
            ->limit(3)
            ->get()
            ->map(function ($a) {
                return [
                    'id' => $a->id,
                    'title' => $a->title,
                    'slug' => $a->slug,
                    'excerpt' => $a->excerpt,
                    'tags' => $a->tags ?? [],
                    'reading_time_min' => $a->reading_time_min ?? 5,
                    'published_at' => $a->published_at ? Carbon::parse($a->published_at)->format('d/m/Y') : '',
                ];
            });

        $settings = SiteSetting::all()->pluck('value', 'key')->toArray();

        return Inertia::render('Blog/Show', [
            'article' => [
                'id' => $article->id,
                'title' => $article->title,
                'slug' => $article->slug,
                'excerpt' => $article->excerpt,
                'content' => $article->content,
                'cover_image' => $article->cover_image ?? null,
                'tags' => $article->tags ?? [],
                'reading_time_min' => $article->reading_time_min ?? 5,
                'published_at' => $article->published_at ? Carbon::parse($article->published_at)->format('d/m/Y') : '',
                'views_count' => 120 + ($article->id * 47),
            ],
            'relatedArticles' => $relatedArticles,
            'settings' => $settings,
        ]);
    }
}

<?php

namespace App\Http\Controllers;

use App\Models\Article;
use App\Models\Project;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class SeoController extends Controller
{
    /**
     * Generate dynamic XML Sitemap for both main domain and subdomain.
     */
    public function sitemap(Request $request): Response
    {
        $host = $request->getHost();
        $baseDomain = config('app.base_domain', 'macatung.dev');
        $isTheravada = str_starts_with($host, 'theravada.') || $request->path() === 'theravada/sitemap.xml';

        if ($isTheravada) {
            return $this->generateTheravadaSitemap($baseDomain);
        }

        return $this->generateMainSitemap($baseDomain);
    }

    /**
     * Generate dynamic Robots.txt with AI Bot friendly permissions.
     */
    public function robots(Request $request): Response
    {
        $host = $request->getHost();
        $baseDomain = config('app.base_domain', 'macatung.dev');
        $isTheravada = str_starts_with($host, 'theravada.');
        $sitemapUrl = $isTheravada 
            ? 'https://theravada.' . $baseDomain . '/sitemap.xml'
            : 'https://' . $baseDomain . '/sitemap.xml';

        $robots = <<<EOT
User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/
Disallow: /summon

# Explicit AI Search & Assistant Crawlers Allowed
User-agent: Googlebot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: Bingbot
Allow: /

User-agent: GPTBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Claude-Web
Allow: /

User-agent: Applebot
Allow: /

Sitemap: {$sitemapUrl}
EOT;

        return response($robots, 200, ['Content-Type' => 'text/plain; charset=UTF-8']);
    }

    /**
     * Main Domain XML Sitemap
     */
    protected function generateMainSitemap(string $baseDomain): Response
    {
        $baseUrl = 'https://' . $baseDomain;
        $articles = Article::where('site_domain', 'main')->where('is_published', true)->latest('published_at')->get();
        $projects = Project::ordered()->get();

        $xml = '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
        $xml .= '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">' . "\n";

        // Static Pages
        $staticPages = [
            ['url' => $baseUrl . '/', 'priority' => '1.0', 'changefreq' => 'daily'],
            ['url' => $baseUrl . '/projects', 'priority' => '0.9', 'changefreq' => 'weekly'],
            ['url' => $baseUrl . '/about', 'priority' => '0.8', 'changefreq' => 'monthly'],
            ['url' => $baseUrl . '/skills', 'priority' => '0.8', 'changefreq' => 'monthly'],
            ['url' => $baseUrl . '/blog', 'priority' => '0.9', 'changefreq' => 'daily'],
            ['url' => $baseUrl . '/game', 'priority' => '0.7', 'changefreq' => 'monthly'],
            ['url' => $baseUrl . '/talisman', 'priority' => '0.7', 'changefreq' => 'monthly'],
            ['url' => $baseUrl . '/contact', 'priority' => '0.6', 'changefreq' => 'yearly'],
        ];

        foreach ($staticPages as $page) {
            $xml .= "  <url>\n";
            $xml .= "    <loc>{$page['url']}</loc>\n";
            $xml .= "    <changefreq>{$page['changefreq']}</changefreq>\n";
            $xml .= "    <priority>{$page['priority']}</priority>\n";
            $xml .= "  </url>\n";
        }

        // Blog Articles
        foreach ($articles as $art) {
            $lastmod = $art->updated_at ? $art->updated_at->toAtomString() : $art->published_at->toAtomString();
            $xml .= "  <url>\n";
            $xml .= "    <loc>{$baseUrl}/blog/{$art->slug}</loc>\n";
            $xml .= "    <lastmod>{$lastmod}</lastmod>\n";
            $xml .= "    <changefreq>monthly</changefreq>\n";
            $xml .= "    <priority>0.8</priority>\n";
            $xml .= "  </url>\n";
        }

        $xml .= '</urlset>';

        return response($xml, 200, ['Content-Type' => 'application/xml; charset=UTF-8']);
    }

    /**
     * Theravada Subdomain XML Sitemap
     */
    protected function generateTheravadaSitemap(string $baseDomain): Response
    {
        $baseUrl = 'https://theravada.' . $baseDomain;
        $articles = Article::where('site_domain', 'theravada')->where('is_published', true)->latest('published_at')->get();

        $xml = '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
        $xml .= '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">' . "\n";

        // Static Sections & Apps
        $staticPages = [
            ['url' => $baseUrl . '/', 'priority' => '1.0', 'changefreq' => 'daily'],
            ['url' => $baseUrl . '/danh-muc/phap-hoc', 'priority' => '0.9', 'changefreq' => 'weekly'],
            ['url' => $baseUrl . '/danh-muc/phap-hanh', 'priority' => '0.9', 'changefreq' => 'weekly'],
            ['url' => $baseUrl . '/danh-muc/kinh-tung', 'priority' => '0.9', 'changefreq' => 'weekly'],
            ['url' => $baseUrl . '/ung-dung-tu-hoc', 'priority' => '0.9', 'changefreq' => 'weekly'],
            ['url' => $baseUrl . '/tu-dien-pali', 'priority' => '0.8', 'changefreq' => 'monthly'],
        ];

        foreach ($staticPages as $page) {
            $xml .= "  <url>\n";
            $xml .= "    <loc>{$page['url']}</loc>\n";
            $xml .= "    <changefreq>{$page['changefreq']}</changefreq>\n";
            $xml .= "    <priority>{$page['priority']}</priority>\n";
            $xml .= "  </url>\n";
        }

        // Canonical Suttas & Articles
        foreach ($articles as $art) {
            $lastmod = $art->updated_at ? $art->updated_at->toAtomString() : ($art->published_at ? $art->published_at->toAtomString() : now()->toAtomString());
            $xml .= "  <url>\n";
            $xml .= "    <loc>{$baseUrl}/kinh/{$art->slug}</loc>\n";
            $xml .= "    <lastmod>{$lastmod}</lastmod>\n";
            $xml .= "    <changefreq>monthly</changefreq>\n";
            $xml .= "    <priority>0.85</priority>\n";
            $xml .= "  </url>\n";
        }

        $xml .= '</urlset>';

        return response($xml, 200, ['Content-Type' => 'application/xml; charset=UTF-8']);
    }
}

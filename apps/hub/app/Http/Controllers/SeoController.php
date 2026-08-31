<?php

namespace App\Http\Controllers;

use App\Models\Article;
use App\Models\Project;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class SeoController extends Controller
{
    /**
     * Master Sitemap Index grouping all domain and subdomain sitemaps.
     */
    public function sitemapIndex(Request $request): Response
    {
        $baseDomain = config('app.base_domain') ?: 'macatung.dev';
        $now = now()->toAtomString();

        $xml = '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
        $xml .= '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";

        $sitemaps = [
            "https://{$baseDomain}/sitemap.xml",
            "https://theravada.{$baseDomain}/sitemap.xml",
            "https://midnight.{$baseDomain}/sitemap.xml",
        ];

        foreach ($sitemaps as $url) {
            $xml .= "  <sitemap>\n";
            $xml .= "    <loc>{$url}</loc>\n";
            $xml .= "    <lastmod>{$now}</lastmod>\n";
            $xml .= "  </sitemap>\n";
        }

        $xml .= '</sitemapindex>';

        return response($xml, 200, ['Content-Type' => 'application/xml; charset=UTF-8']);
    }

    /**
     * Generate dynamic XML Sitemap for main domain and subdomains.
     */
    public function sitemap(Request $request): Response
    {
        $host = $request->getHost();
        $baseDomain = config('app.base_domain') ?: 'macatung.dev';

        $isTheravada = str_starts_with($host, 'theravada.') || $request->path() === 'theravada/sitemap.xml';
        $isMidnight = str_starts_with($host, 'midnight.') || str_starts_with($host, 'hub.') || str_starts_with($host, 'task-hub.') || $request->path() === 'midnight/sitemap.xml';

        if ($isTheravada) {
            return $this->generateTheravadaSitemap($baseDomain);
        }

        if ($isMidnight) {
            return $this->generateMidnightSitemap($baseDomain);
        }

        return $this->generateMainSitemap($baseDomain);
    }

    /**
     * Generate dynamic Robots.txt with AI Bot friendly permissions and domain-specific sitemaps.
     */
    public function robots(Request $request): Response
    {
        $host = $request->getHost();
        $baseDomain = config('app.base_domain') ?: 'macatung.dev';

        $isTheravada = str_starts_with($host, 'theravada.');
        $isMidnight = str_starts_with($host, 'midnight.') || str_starts_with($host, 'hub.') || str_starts_with($host, 'task-hub.');

        if ($isTheravada) {
            $sitemapLines = "Sitemap: https://theravada.{$baseDomain}/sitemap.xml";
        } elseif ($isMidnight) {
            $sitemapLines = "Sitemap: https://midnight.{$baseDomain}/sitemap.xml";
        } else {
            $sitemapLines = <<<SITEMAPS
Sitemap: https://{$baseDomain}/sitemap.xml
Sitemap: https://{$baseDomain}/sitemap-index.xml
Sitemap: https://theravada.{$baseDomain}/sitemap.xml
Sitemap: https://midnight.{$baseDomain}/sitemap.xml
SITEMAPS;
        }

        $robots = <<<EOT
User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/
Disallow: /summon
Disallow: /workspaces/
Disallow: /tasks
Disallow: /workspace
Disallow: /desktop/pairing/
Disallow: /auth/

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

User-agent: CCBot
Allow: /

{$sitemapLines}
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
        $xml .= '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">' . "\n";

        // Static Core Pages
        $staticPages = [
            ['url' => $baseUrl . '/', 'priority' => '1.0', 'changefreq' => 'daily'],
            ['url' => $baseUrl . '/projects', 'priority' => '0.9', 'changefreq' => 'weekly'],
            ['url' => $baseUrl . '/about', 'priority' => '0.8', 'changefreq' => 'monthly'],
            ['url' => $baseUrl . '/skills', 'priority' => '0.8', 'changefreq' => 'monthly'],
            ['url' => $baseUrl . '/blog', 'priority' => '0.9', 'changefreq' => 'daily'],
            ['url' => $baseUrl . '/desktop', 'priority' => '0.8', 'changefreq' => 'weekly'],
            ['url' => $baseUrl . '/pricing', 'priority' => '0.8', 'changefreq' => 'weekly'],
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
            $lastmod = $art->updated_at ? $art->updated_at->toAtomString() : ($art->published_at ? $art->published_at->toAtomString() : now()->toAtomString());
            $xml .= "  <url>\n";
            $xml .= "    <loc>{$baseUrl}/blog/{$art->slug}</loc>\n";
            $xml .= "    <lastmod>{$lastmod}</lastmod>\n";
            $xml .= "    <changefreq>monthly</changefreq>\n";
            $xml .= "    <priority>0.85</priority>\n";
            if (!empty($art->cover_image_url)) {
                $xml .= "    <image:image>\n";
                $xml .= "      <image:loc>{$art->cover_image_url}</image:loc>\n";
                $xml .= "      <image:title>" . htmlspecialchars($art->title, ENT_XML1, 'UTF-8') . "</image:title>\n";
                $xml .= "    </image:image>\n";
            }
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
        $xml .= '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">' . "\n";

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
            if (!empty($art->cover_image_url)) {
                $xml .= "    <image:image>\n";
                $xml .= "      <image:loc>{$art->cover_image_url}</image:loc>\n";
                $xml .= "      <image:title>" . htmlspecialchars($art->title, ENT_XML1, 'UTF-8') . "</image:title>\n";
                $xml .= "    </image:image>\n";
            }
            $xml .= "  </url>\n";
        }

        $xml .= '</urlset>';

        return response($xml, 200, ['Content-Type' => 'application/xml; charset=UTF-8']);
    }

    /**
     * Midnight Hub Subdomain XML Sitemap
     */
    protected function generateMidnightSitemap(string $baseDomain): Response
    {
        $baseUrl = 'https://midnight.' . $baseDomain;

        $xml = '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
        $xml .= '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">' . "\n";

        $pages = [
            ['url' => $baseUrl . '/', 'priority' => '1.0', 'changefreq' => 'daily'],
            ['url' => $baseUrl . '/pricing', 'priority' => '0.9', 'changefreq' => 'weekly'],
            ['url' => $baseUrl . '/desktop', 'priority' => '0.9', 'changefreq' => 'weekly'],
        ];

        foreach ($pages as $page) {
            $xml .= "  <url>\n";
            $xml .= "    <loc>{$page['url']}</loc>\n";
            $xml .= "    <changefreq>{$page['changefreq']}</changefreq>\n";
            $xml .= "    <priority>{$page['priority']}</priority>\n";
            $xml .= "  </url>\n";
        }

        $xml .= '</urlset>';

        return response($xml, 200, ['Content-Type' => 'application/xml; charset=UTF-8']);
    }
}

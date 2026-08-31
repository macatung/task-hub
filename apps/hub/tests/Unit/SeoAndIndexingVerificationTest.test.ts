/**
 * Test Suite: SEO & Google Search Console Indexing Verification
 * Tier 1: Feature Coverage (Isolation)
 * Tier 2: Boundary & Corner Cases (Canonical, Sitemaps, Robots & Multi-Subdomain)
 */

import { describe, it, expect } from '../Harness/index.js';
import fs from 'fs';
import path from 'path';

describe('SeoAndIndexingVerificationTest', () => {
  const hubRoot = fs.existsSync(path.resolve(process.cwd(), 'apps/hub'))
    ? path.resolve(process.cwd(), 'apps/hub')
    : process.cwd();

  const seoControllerPath = path.resolve(hubRoot, 'app/Http/Controllers/SeoController.php');
  const webRoutesPath = path.resolve(hubRoot, 'routes/web.php');
  const bladeAppPath = path.resolve(hubRoot, 'resources/views/app.blade.php');
  const seoHeadVuePath = path.resolve(hubRoot, 'resources/js/Components/common/SeoHead.vue');
  const pricingVuePath = path.resolve(hubRoot, 'resources/js/Pages/Pricing/Index.vue');
  const hubLandingVuePath = path.resolve(hubRoot, 'resources/js/Pages/Hub/Index.vue');

  const seoControllerSrc = fs.readFileSync(seoControllerPath, 'utf-8');
  const webRoutesSrc = fs.readFileSync(webRoutesPath, 'utf-8');
  const bladeAppSrc = fs.readFileSync(bladeAppPath, 'utf-8');
  const seoHeadVueSrc = fs.readFileSync(seoHeadVuePath, 'utf-8');
  const pricingVueSrc = fs.readFileSync(pricingVuePath, 'utf-8');
  const hubLandingVueSrc = fs.readFileSync(hubLandingVuePath, 'utf-8');

  // ==========================================================================
  // TIER 1: Feature Coverage (Isolation)
  // ==========================================================================
  describe('[T1_SEO] Sitemaps, Robots.txt & Controllers', () => {
    it('[T1_SEO_01] SeoController implements sitemapIndex with sitemapindex XML namespace', () => {
      expect(seoControllerSrc).toContain('public function sitemapIndex');
      expect(seoControllerSrc).toContain('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
      expect(seoControllerSrc).toContain('https://{$baseDomain}/sitemap.xml');
      expect(seoControllerSrc).toContain('https://theravada.{$baseDomain}/sitemap.xml');
      expect(seoControllerSrc).toContain('https://midnight.{$baseDomain}/sitemap.xml');
    });

    it('[T1_SEO_02] SeoController implements generateMainSitemap with full static routes and image extensions', () => {
      expect(seoControllerSrc).toContain('protected function generateMainSitemap');
      expect(seoControllerSrc).toContain("['url' => $baseUrl . '/', 'priority' => '1.0'");
      expect(seoControllerSrc).toContain("['url' => $baseUrl . '/projects'");
      expect(seoControllerSrc).toContain("['url' => $baseUrl . '/blog'");
      expect(seoControllerSrc).toContain("['url' => $baseUrl . '/desktop'");
      expect(seoControllerSrc).toContain("['url' => $baseUrl . '/pricing'");
      expect(seoControllerSrc).toContain('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"');
      expect(seoControllerSrc).toContain('<image:image>');
    });

    it('[T1_SEO_03] SeoController implements generateTheravadaSitemap for Buddhist subdomain', () => {
      expect(seoControllerSrc).toContain('protected function generateTheravadaSitemap');
      expect(seoControllerSrc).toContain('$baseUrl = \'https://theravada.\' . $baseDomain;');
      expect(seoControllerSrc).toContain("['url' => $baseUrl . '/danh-muc/phap-hoc'");
      expect(seoControllerSrc).toContain("['url' => $baseUrl . '/danh-muc/phap-hanh'");
      expect(seoControllerSrc).toContain("['url' => $baseUrl . '/danh-muc/kinh-tung'");
      expect(seoControllerSrc).toContain("['url' => $baseUrl . '/tu-dien-pali'");
      expect(seoControllerSrc).toContain("['url' => $baseUrl . '/ung-dung-tu-hoc'");
      expect(seoControllerSrc).toContain('kinh/{$art->slug}');
    });

    it('[T1_SEO_04] SeoController implements generateMidnightSitemap for SaaS Hub platform', () => {
      expect(seoControllerSrc).toContain('protected function generateMidnightSitemap');
      expect(seoControllerSrc).toContain('$baseUrl = \'https://midnight.\' . $baseDomain;');
      expect(seoControllerSrc).toContain("['url' => $baseUrl . '/pricing'");
      expect(seoControllerSrc).toContain("['url' => $baseUrl . '/desktop'");
    });

    it('[T1_SEO_05] SeoController robots method permits AI search engines and blocks internal workspaces', () => {
      expect(seoControllerSrc).toContain('public function robots');
      expect(seoControllerSrc).toContain('User-agent: Googlebot');
      expect(seoControllerSrc).toContain('User-agent: Google-Extended');
      expect(seoControllerSrc).toContain('User-agent: GPTBot');
      expect(seoControllerSrc).toContain('User-agent: PerplexityBot');
      expect(seoControllerSrc).toContain('User-agent: Claude-Web');
      expect(seoControllerSrc).toContain('User-agent: Applebot');
      expect(seoControllerSrc).toContain('Disallow: /workspaces/');
      expect(seoControllerSrc).toContain('Disallow: /tasks');
      expect(seoControllerSrc).toContain('Disallow: /admin/');
      expect(seoControllerSrc).toContain('Disallow: /api/');
    });
  });

  // ==========================================================================
  // TIER 2: Boundary & Corner Cases (Web Routes, Canonical & Head Schema)
  // ==========================================================================
  describe('[T2_SEO] Route Registration & Server-Side Pre-Rendering', () => {
    it('[T2_SEO_01] web.php registers global sitemaps, sitemap-index and robots.txt routes', () => {
      expect(webRoutesSrc).toContain("Route::get('/sitemap.xml', [SeoController::class, 'sitemap'])");
      expect(webRoutesSrc).toContain("Route::get('/sitemap-index.xml', [SeoController::class, 'sitemapIndex'])");
      expect(webRoutesSrc).toContain("Route::get('/theravada/sitemap.xml', [SeoController::class, 'sitemap'])");
      expect(webRoutesSrc).toContain("Route::get('/midnight/sitemap.xml', [SeoController::class, 'sitemap'])");
      expect(webRoutesSrc).toContain("Route::get('/robots.txt', [SeoController::class, 'robots'])");
    });

    it('[T2_SEO_02] web.php registers Theravada and Midnight subdomain groups', () => {
      expect(webRoutesSrc).toContain("Route::domain('theravada.' . $baseDomain)");
      expect(webRoutesSrc).toContain("Route::domain('midnight.' . $baseDomain)");
      expect(webRoutesSrc).toContain("Route::domain('hub.' . $baseDomain)");
    });

    it('[T2_SEO_03] app.blade.php generates dynamic server-side canonical URL matching requested host and path', () => {
      expect(bladeAppSrc).toContain('$canonicalUrl = $scheme . \'://\' . $host');
      expect(bladeAppSrc).toContain('<link rel="canonical" href="{{ $canonicalUrl }}">');
      // Must not contain hardcoded static canonical url to root
      expect(bladeAppSrc).not.toContain('<link rel="canonical" href="https://macatung.dev/">');
    });

    it('[T2_SEO_04] app.blade.php renders Google Search Console verification tag when configured', () => {
      expect(bladeAppSrc).toContain('$gscVerification');
      expect(bladeAppSrc).toContain('<meta name="google-site-verification" content="{{ $gscVerification }}">');
    });

    it('[T2_SEO_05] app.blade.php contains pre-rendered WebSite & Person JSON-LD and noscript fallback', () => {
      expect(bladeAppSrc).toContain('WebSite');
      expect(bladeAppSrc).toContain('Person');
      expect(bladeAppSrc).toContain('MacaTung');
      expect(bladeAppSrc).toContain('<noscript>');
      expect(bladeAppSrc).toContain('</noscript>');
    });

    it('[T2_SEO_06] SeoHead.vue and page components integrate rich structured schemas', () => {
      expect(seoHeadVueSrc).toContain('siteName');
      expect(seoHeadVueSrc).toContain('effectiveOgImage');
      expect(pricingVueSrc).toContain('SeoHead');
      expect(pricingVueSrc).toContain('pricingJsonLd');
      expect(pricingVueSrc).toContain('SoftwareApplication');
      expect(hubLandingVueSrc).toContain('SeoHead');
      expect(hubLandingVueSrc).toContain('hubJsonLd');
    });
  });
});

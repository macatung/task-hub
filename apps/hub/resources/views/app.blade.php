@php
    $host = request()->getHost();
    $path = request()->path();
    $baseDomain = config('app.base_domain') ?: 'macatung.dev';
    
    $isTheravada = str_starts_with($host, 'theravada.') || str_starts_with($path, 'theravada');
    $isMidnight = str_starts_with($host, 'midnight.') || str_starts_with($host, 'hub.') || str_starts_with($host, 'task-hub.');
    
    $scheme = (request()->secure() || request()->header('X-Forwarded-Proto') === 'https') ? 'https' : 'https';
    $canonicalUrl = $scheme . '://' . $host . ($path === '/' || $path === '' ? '/' : '/' . ltrim($path, '/'));
    
    // GSC Verification Token
    $gscVerification = config('services.google.site_verification', env('GOOGLE_SITE_VERIFICATION', ''));
    
    if ($isTheravada) {
        $defaultTitle = 'Ma Tọa Thiền — Tam Tạng Kinh Điển Theravāda & Thiền Vipassanā';
        $defaultDesc = 'Hệ thống tu học và bảo tồn kinh điển Phật giáo nguyên thủy Theravāda: Tứ Thánh Đế, Bát Chánh Đạo, Thiền Minh Sát Vipassanā, Thẻ ảnh Pháp Cú và Từ điển Pāḷi thuần khiết.';
        $defaultKeywords = 'Theravada, Pāḷi Tipiṭaka, Phật giáo nguyên thủy, Kinh Pháp Cú, Dhammapada, Thiền Vipassana, Tứ Niệm Xứ, Bát Chánh Đạo, Tứ Diệu Đế, Ma Tọa Thiền';
        $siteName = 'Ma Tọa Thiền • Theravāda';
        $favicon = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" fill="%231c1917" stroke="%23f59e0b" stroke-width="4"/><circle cx="50" cy="50" r="14" fill="%23f59e0b"/><path d="M50 14 L50 86 M14 50 L86 50 M24 24 L76 76 M24 76 L76 24" stroke="%23f59e0b" stroke-width="4" stroke-linecap="round"/></svg>';
        $themeColor = '#0c0a09';
    } elseif ($isMidnight) {
        $defaultTitle = 'Midnight Hub — Autonomous Multi-Agent Engineering Platform & Supervised Vibe Coding';
        $defaultDesc = 'Enterprise developer platform for supervised vibe coding. Orchestrate Antigravity 2.0, Codex, and Claude Code in isolated Git worktrees with deterministic verification gates.';
        $defaultKeywords = 'Midnight Hub, Vibe Coding, AI Coding Agents, Antigravity 2.0, Claude Code, Verification Evidence, MCP Gateway, Git Worktree, Autonomous Engineering';
        $siteName = 'Midnight Hub';
        $favicon = '/brand/midnight-hub-mark.svg?v=20260829';
        $themeColor = '#04070d';
    } else {
        $defaultTitle = 'MacaTung — Lead AI Systems Architect & Full-Stack Engineer';
        $defaultDesc = 'Engineering laboratory & portfolio of MacaTung: Autonomous multi-agent orchestration, high-throughput distributed systems, GIS telecommunications infra, and resilient software craft.';
        $defaultKeywords = 'MacaTung, macatung.dev, Fullstack Engineer, AI Agent Architect, Laravel, Vue.js, Multi-Agent Systems, High-Concurrency Distributed Systems';
        $siteName = 'Midnight Hub • Code at midnight';
        $favicon = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="24" fill="%23070b14"/><circle cx="50" cy="52" r="28" fill="%231a233d" stroke="%2300f5a0" stroke-width="2"/><path d="M35 24 C35 16 65 16 65 24 L72 32 L28 32 Z" fill="%2311182c" stroke="%23ffd166" stroke-width="2"/><rect x="42" y="28" width="16" height="32" rx="3" fill="%23ffd166"/><circle cx="50" cy="36" r="3" fill="%23e63946"/><line x1="46" y1="44" x2="54" y2="44" stroke="%23e63946" stroke-width="1.5"/><line x1="46" y1="50" x2="54" y2="50" stroke="%23e63946" stroke-width="1.5"/><circle cx="40" cy="52" r="4" fill="%2300f5d4"/><circle cx="60" cy="52" r="4" fill="%2300f5d4"/><circle cx="40" cy="52" r="1.5" fill="%23ffffff"/><circle cx="60" cy="52" r="1.5" fill="%23ffffff"/><ellipse cx="34" cy="60" rx="3" ry="2" fill="%23ff0054" opacity="0.6"/><ellipse cx="66" cy="60" rx="3" ry="2" fill="%23ff0054" opacity="0.6"/><path d="M47 62 Q50 65 53 62" stroke="%23ffffff" stroke-width="2" fill="none" stroke-linecap="round"/></svg>';
        $themeColor = '#070b14';
    }
@endphp
<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" class="dark scroll-smooth">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    
    <title inertia>{{ $defaultTitle }}</title>
    <meta name="description" content="{{ $defaultDesc }}">
    <meta name="keywords" content="{{ $defaultKeywords }}">
    <meta name="author" content="MacaTung (macatung.dev)">
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
    <meta name="theme-color" content="{{ $themeColor }}">
    
    <!-- Canonical URL (Dynamic per subdomain and path) -->
    <link rel="canonical" href="{{ $canonicalUrl }}">

    <!-- Google Search Console Site Verification -->
    @if (!empty($gscVerification))
        <meta name="google-site-verification" content="{{ $gscVerification }}">
    @endif

    <!-- Open Graph / Facebook / Twitter -->
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="{{ $siteName }}">
    <meta property="og:locale" content="en_US">
    <meta property="og:title" content="{{ $defaultTitle }}">
    <meta property="og:description" content="{{ $defaultDesc }}">
    <meta property="og:url" content="{{ $canonicalUrl }}">

    <!-- Twitter Cards -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="{{ $defaultTitle }}">
    <meta name="twitter:description" content="{{ $defaultDesc }}">

    <!-- Favicon -->
    <link rel="icon" type="image/svg+xml" href="{{ $favicon }}">

    <!-- Google Fonts with full typography support -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,600&family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600&family=Merriweather:ital,wght@0,300;0,400;0,700;1,300;1,400&family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet">

    <!-- Schema.org JSON-LD Pre-rendered Core Graph -->
    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "WebSite",
                "@id": "{{ $scheme }}://{{ $host }}/#website",
                "url": "{{ $scheme }}://{{ $host }}/",
                "name": "{{ $siteName }}",
                "description": "{{ $defaultDesc }}",
                "inLanguage": "en"
            },
            {
                "@type": "Person",
                "@id": "https://macatung.dev/#person",
                "name": "MacaTung",
                "alternateName": ["macatung", "MacaTung", "Midnight Architect"],
                "url": "https://macatung.dev/",
                "jobTitle": "Lead AI Systems Architect & Full-Stack Engineer",
                "sameAs": [
                    "https://github.com/macatung"
                ]
            }
        ]
    }
    </script>

    @vite(['resources/css/app.css', 'resources/js/app.ts'])
    @inertiaHead
</head>
<body class="bg-midnight-950 text-slate-100 font-sans antialiased selection:bg-phantom-mint selection:text-midnight-950 overflow-x-hidden">
    @inertia

    <noscript>
        <main style="padding: 2rem; max-width: 800px; margin: auto; font-family: sans-serif; line-height: 1.6;">
            <h1>{{ $defaultTitle }}</h1>
            <p>{{ $defaultDesc }}</p>
            <nav aria-label="Sitemap navigation">
                <ul>
                    @if ($isTheravada)
                        <li><a href="/theravada/danh-muc/phap-hoc">Pháp Học (Pariyatti)</a></li>
                        <li><a href="/theravada/danh-muc/phap-hanh">Pháp Hành (Vipassanā)</a></li>
                        <li><a href="/theravada/danh-muc/kinh-tung">Kinh Tụng & Paritta</a></li>
                        <li><a href="/theravada/tu-dien-pali">Từ Điển Pāḷi</a></li>
                        <li><a href="https://macatung.dev">MacaTung Platform Home</a></li>
                    @else
                        <li><a href="/projects">Projects & Systems Grimoire</a></li>
                        <li><a href="/about">About & Engineering Manifesto</a></li>
                        <li><a href="/blog">Midnight Tech Chronicle (Blog)</a></li>
                        <li><a href="/desktop">Midnight Hub Desktop Companion</a></li>
                        <li><a href="/pricing">Pricing & Service Plans</a></li>
                        <li><a href="/contact">Contact & Technical Inquiries</a></li>
                        <li><a href="https://theravada.macatung.dev">Theravāda Dhamma Preservation</a></li>
                    @endif
                </ul>
            </nav>
        </main>
    </noscript>
</body>
</html>

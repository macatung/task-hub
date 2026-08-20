<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" class="dark scroll-smooth">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    
    <title inertia>{{ config('app.name', 'Task Hub — AI agent execution workspace') }}</title>
    <meta name="description" content="An open-source workspace for project delivery, GitHub context, and supervised AI agent handoffs.">
    <meta name="author" content="Task Hub contributors">
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
    <meta name="theme-color" content="#070b14">

    <!-- Open Graph / Facebook / Zalo -->
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="Task Hub">
    <meta property="og:locale" content="en_US">
    <meta property="og:title" content="Task Hub — AI agent execution workspace">
    <meta property="og:description" content="Build with context. Review with evidence.">

    <!-- Twitter Cards -->
    <meta name="twitter:card" content="summary_large_image">

    <!-- Favicon -->
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='24' fill='%23070b14'/><circle cx='50' cy='52' r='28' fill='%231a233d' stroke='%2300f5a0' stroke-width='2'/><path d='M35 24 C35 16 65 16 65 24 L72 32 L28 32 Z' fill='%2311182c' stroke='%23ffd166' stroke-width='2'/><rect x='42' y='28' width='16' height='32' rx='3' fill='%23ffd166'/><circle cx='50' cy='36' r='3' fill='%23e63946'/><line x1='46' y1='44' x2='54' y2='44' stroke='%23e63946' stroke-width='1.5'/><line x1='46' y1='50' x2='54' y2='50' stroke='%23e63946' stroke-width='1.5'/><circle cx='40' cy='52' r='4' fill='%2300f5d4'/><circle cx='60' cy='52' r='4' fill='%2300f5d4'/><circle cx='40' cy='52' r='1.5' fill='%23ffffff'/><circle cx='60' cy='52' r='1.5' fill='%23ffffff'/><ellipse cx='34' cy='60' rx='3' ry='2' fill='%23ff0054' opacity='0.6'/><ellipse cx='66' cy='60' rx='3' ry='2' fill='%23ff0054' opacity='0.6'/><path d='M47 62 Q50 65 53 62' stroke='%23ffffff' stroke-width='2' fill='none' stroke-linecap='round'/></svg>" />

    <!-- Google Fonts with full Vietnamese & Pāḷi diacritics support -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,600&family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600&family=Merriweather:ital,wght@0,300;0,400;0,700;1,300;1,400&family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet">

    @vite(['resources/css/app.css', 'resources/js/app.ts'])
    @inertiaHead
</head>
<body class="bg-midnight-950 text-slate-100 font-sans antialiased selection:bg-phantom-mint selection:text-midnight-950 overflow-x-hidden">
    @inertia
</body>
</html>

<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" class="dark scroll-smooth">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    
    <title inertia>{{ config('app.name', 'Midnight Hub') }}</title>
    <meta name="description" content="Autonomous AI Agent Orchestrator & Developer Studio. Code at midnight. Deploy at dawn.">
    <meta name="author" content="Midnight Hub contributors">
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
    <meta name="theme-color" content="#04070d">

    <!-- Open Graph / Facebook / Zalo -->
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="Midnight Hub">
    <meta property="og:locale" content="en_US">
    <meta property="og:title" content="Midnight Hub — Autonomous AI Agent Orchestrator">
    <meta property="og:description" content="Code at midnight. Deploy at dawn.">

    <!-- Twitter Cards -->
    <meta name="twitter:card" content="summary_large_image">

    <!-- Favicon -->
    <link rel="icon" type="image/svg+xml" href="/brand/midnight-hub-mark.svg?v=20260829">

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

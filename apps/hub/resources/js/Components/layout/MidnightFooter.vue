<script setup lang="ts">
import { Link } from '@inertiajs/vue3';
</script>

<template>
  <footer class="border-t border-slate-800/80 bg-midnight-950 px-4 sm:px-6 lg:px-8 py-12 text-xs text-slate-500">
    <div class="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-6">
      <!-- Left Moniker -->
      <div class="flex items-center gap-3">
        <img
          src="/brand/midnight-hub-mark.svg?v=20260829"
          alt="Midnight Hub"
          class="h-6 w-6 rounded-lg object-contain"
        />
        <span class="font-bold text-slate-300">Midnight Hub</span>
        <span>· Supervised AI Agent Execution Engine</span>
      </div>

      <!-- Center / Right Links -->
      <div class="flex flex-wrap items-center gap-6 text-slate-400">
        <Link href="/" class="hover:text-white transition-colors">Overview</Link>
        <Link href="/tasks" class="hover:text-white transition-colors">Workspace</Link>
        <Link href="/projects" class="hover:text-white transition-colors">Projects</Link>
        <Link href="/desktop" class="hover:text-white transition-colors">Desktop</Link>
        <Link href="/pricing" class="hover:text-white transition-colors">Pricing</Link>
        <a
          href="https://github.com/macatung/task-hub"
          target="_blank"
          rel="noopener noreferrer"
          class="hover:text-white transition-colors"
        >
          GitHub
        </a>
      </div>

      <!-- Right Copyright -->
      <p>© 2026 Macatung Dev. Released under the MIT License.</p>
    </div>
  </footer>
</template>

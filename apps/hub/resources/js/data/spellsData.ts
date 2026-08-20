export interface SpellItem {
  word: string;
  category: 'keyword' | 'function' | 'spell' | 'boss';
  points: number;
}

export const beginnerSpells: string[] = [
  'const', 'let', 'return', 'async', 'await', 'git push', 'npm run', '0 bug',
  'ping', 'echo', 'true', 'false', 'null', 'void', 'docker', 'redis',
  'router', 'props', 'emit', 'ref', 'computed', 'watch', 'state', 'model',
  'branch', 'commit', 'fetch', 'json', 'post', 'status', 'token', 'cache',
  'import', 'export', 'type', 'class', 'super', 'this', 'throw', 'catch',
  'robusta', 'cafe', 'midnight', 'rune', 'talisman', 'shield', 'thock'
];

export const normalSpells: string[] = [
  'Cache::lock()', 'new MultiAgent()', 'Promise.all()', 'sudo rm -rf bugs',
  '0 downtime', 'git rebase main', 'SELECT * FROM magic', 'docker compose up',
  'php artisan test', 'npm run build', 'vector.search()', 'gemini.generate()',
  'redis.setEx()', 'api.dispatch()', 'queue.process()', 'event.listen()',
  'Schema::create()', 'DB::transaction()', 'response.json()', 'auth.jwt.verify()',
  'useTimeCycle()', 'MacatungMascot', 'TalismanCanvas', 'MidnightEngine',
  'SpatialIndex.knn()', 'Elasticsearch.query()', 'SNMP.getBulk()', 'FFmpeg.transcode()',
  'WebAudio.synth()', 'Inertia::render()', 'Livewire.dispatch()', 'Tailwind.glass()'
];

export const bossSpells: { name: string; spells: string[]; hp: number }[] = [
  {
    name: 'NullPointerException (Tà Thần Sơ Cấp)',
    spells: ['optional.chaining', 'nullish.coalesce', 'guard.clause'],
    hp: 3
  },
  {
    name: 'MemoryLeak 500MB (Quỷ Hút RAM)',
    spells: ['gc.collect()', 'removeEventListener', 'dispose.buffers'],
    hp: 3
  },
  {
    name: 'MergeConflict 1000 Lines (Ám Khí Git)',
    spells: ['git checkout --theirs', 'git add .', 'git commit -m "fix"'],
    hp: 3
  },
  {
    name: '504 Gateway Timeout (Yêu Ma Sập Cổng)',
    spells: ['increase.timeout', 'scale.replicas', 'enable.cdn.cache'],
    hp: 3
  },
  {
    name: 'Infinite Recursion Loop (Vòng Lặp Vô Tận)',
    spells: ['base.condition()', 'break.iteration', 'tail.optimization'],
    hp: 3
  }
];

export const getTitleBadge = (score: number, wpm: number): string => {
  if (score >= 3000 && wpm >= 70) return '🧙‍♂️ Thần Phím Nửa Đêm (Midnight Grand Wizard)';
  if (score >= 2000 && wpm >= 55) return '⚡ Bậc Thầy Trảm Bug (Bug Slayer Archmage)';
  if (score >= 1200 && wpm >= 40) return '📜 Pháp Sư Ma Đạo (Spell Weaver)';
  if (score >= 600) return '☕ Lập Trình Viên Ca Đêm (Night Shift Coder)';
  return '🌱 Tập Sự Trừ Tà (Apprentice Typer)';
};

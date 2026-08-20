<script setup lang="ts">
defineProps<{
  isHovered?: boolean;
}>();
</script>

<template>
  <div class="relative flex flex-col items-center justify-center select-none cursor-pointer group">
    <!-- Authentic Minimalist Jiangshi Developer Mascot (Chuẩn Vector gốc, đứng yên thanh tịnh) -->
    <div class="relative z-10 flex flex-col items-center">
      <svg
        width="135"
        height="155"
        viewBox="0 0 100 115"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        class="filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.6)] transition-transform duration-200 group-hover:scale-105"
      >
        <defs>
          <linearGradient id="robeGradAuth" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#151d33" />
            <stop offset="60%" stop-color="#0c1220" />
            <stop offset="100%" stop-color="#04070d" />
          </linearGradient>
          <linearGradient id="hatGradAuth" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#1e293b" />
            <stop offset="100%" stop-color="#070b14" />
          </linearGradient>
          <linearGradient id="talismanGradAuth" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#fef08a" />
            <stop offset="50%" stop-color="#eab308" />
            <stop offset="100%" stop-color="#ca8a04" />
          </linearGradient>
          <radialGradient id="ghostSkinAuth" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stop-color="#e2fbeb" />
            <stop offset="70%" stop-color="#b7e4c7" />
            <stop offset="100%" stop-color="#74c69d" />
          </radialGradient>
          <linearGradient id="coffeeCupGradAuth" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#d97706" />
            <stop offset="50%" stop-color="#ffd166" />
            <stop offset="100%" stop-color="#b45309" />
          </linearGradient>
        </defs>

        <!-- Dynamic Ground Shadow -->
        <ellipse cx="50" cy="110" rx="24" ry="4.5" fill="rgba(0, 0, 0, 0.6)" />

        <!-- Outstretched Arms -->
        <g id="mascotArms">
          <!-- Left Arm -->
          <path d="M32 66 C18 66 12 70 8 72" stroke="#0c1220" stroke-width="7" stroke-linecap="round" />
          <circle cx="8" cy="72" r="4" fill="#00f5a0" />
          <text x="3" y="65" font-size="4.5" font-family="monospace" font-weight="bold" fill="#00f5a0">&lt;/&gt;</text>

          <!-- Right Arm with Coffee Cup -->
          <path d="M68 66 C82 66 88 70 92 72" stroke="#0c1220" stroke-width="7" stroke-linecap="round" />
          <circle cx="92" cy="72" r="4" fill="#00f5a0" />
          
          <g transform="translate(86, 64) scale(0.65)">
            <polygon points="4,10 18,10 15,25 7,25" fill="url(#coffeeCupGradAuth)" stroke="#78350f" stroke-width="0.8" />
            <rect x="3" y="8" width="16" height="3" rx="1" fill="#f8fafc" stroke="#64748b" stroke-width="0.6" />
            <text x="11" y="20" text-anchor="middle" font-size="6" fill="#451a03">☕</text>
          </g>
          <text x="94" y="65" font-size="4" font-family="monospace" font-weight="bold" fill="#00f5a0">0 BUG</text>
        </g>

        <!-- Robe Body -->
        <path
          d="M32 58 C32 58, 40 56, 50 56 C60 56, 68 58, 68 58 L76 102 C76 102, 50 106, 24 102 Z"
          fill="url(#robeGradAuth)"
          stroke="#00f5a0"
          stroke-width="1.2"
        />
        <!-- Robe Collar -->
        <path d="M42 59 L50 71 L58 59" stroke="#00f5a0" stroke-width="1.5" fill="none" stroke-linecap="round" />
        <polygon points="50,75 55,78 55,84 50,87 45,84 45,78" fill="#070b14" stroke="#00f5a0" stroke-width="0.8" />
        <text x="50" y="83" text-anchor="middle" font-size="4" font-family="monospace" font-weight="bold" fill="#00f5a0">{ }</text>

        <!-- Feet -->
        <ellipse cx="40" cy="103" rx="6" ry="3" fill="#070b14" stroke="#00f5a0" stroke-width="0.8" />
        <ellipse cx="60" cy="103" rx="6" ry="3" fill="#070b14" stroke="#00f5a0" stroke-width="0.8" />

        <!-- Ghost Head -->
        <circle cx="50" cy="42" r="21" fill="url(#ghostSkinAuth)" stroke="#00f5a0" stroke-width="1.2" />

        <!-- Headphones -->
        <path d="M28 42 C28 24, 72 24, 72 42" stroke="#11182c" stroke-width="3.5" fill="none" stroke-linecap="round" />
        <rect x="25" y="36" width="5" height="13" rx="2.5" fill="#00f5a0" stroke="#070b14" stroke-width="0.8" />
        <rect x="70" y="36" width="5" height="13" rx="2.5" fill="#00f5a0" stroke="#070b14" stroke-width="0.8" />

        <!-- Mandarin Hat -->
        <path d="M30 30 C31 12, 69 12, 70 30 Z" fill="url(#hatGradAuth)" stroke="#00f5a0" stroke-width="1.2" />
        <ellipse cx="50" cy="30" rx="23" ry="6" fill="#0c1220" stroke="#00f5a0" stroke-width="1.2" />
        <!-- Hat Gem & Antenna -->
        <circle cx="50" cy="22" r="2.8" fill="#ff0054" stroke="#00f5a0" stroke-width="0.8" />
        <line x1="50" y1="19" x2="50" y2="10" stroke="#00f5a0" stroke-width="1.2" />
        <circle cx="50" cy="9" r="2" fill="#00f5a0" />

        <!-- Cheeks -->
        <ellipse cx="38" cy="51" rx="3" ry="1.8" fill="#ff0054" opacity="0.4" />
        <ellipse cx="62" cy="51" rx="3" ry="1.8" fill="#ff0054" opacity="0.4" />

        <!-- Eyes -->
        <circle cx="42" cy="43" r="2.8" fill="#00f5a0" />
        <circle cx="43" cy="42" r="1" fill="#ffffff" />
        <circle cx="58" cy="43" r="2.8" fill="#00f5a0" />
        <circle cx="59" cy="42" r="1" fill="#ffffff" />

        <!-- Vampire Fangs Mouth -->
        <path d="M46 52 Q50 56 54 52" stroke="#070b14" stroke-width="1.2" fill="none" stroke-linecap="round" />
        <polygon points="47,52 48.5,55 50,52" fill="#ffffff" />
        <polygon points="50,52 51.5,55 53,52" fill="#ffffff" />

        <!-- Forehead Talisman (Placed gracefully higher on forehead, calm & static) -->
        <g id="foreheadTalisman">
          <rect x="43" y="21" width="14" height="26" rx="1.5" fill="url(#talismanGradAuth)" stroke="#c9182b" stroke-width="0.8" />
          <!-- Seal Circle -->
          <circle cx="50" cy="26" r="2.5" fill="#c9182b" />
          <text x="50" y="27.5" text-anchor="middle" font-size="2.5" font-family="monospace" font-weight="bold" fill="#ffffff">&lt;/&gt;</text>
          <!-- Code Inscription -->
          <text x="50" y="34.5" text-anchor="middle" font-size="2.8" font-family="monospace" font-weight="bold" fill="#c9182b">CODE</text>
          <text x="50" y="39.5" text-anchor="middle" font-size="2.4" font-family="monospace" font-weight="bold" fill="#c9182b">00:00</text>
          <path d="M46 43 L50 45 L54 43" stroke="#c9182b" stroke-width="0.7" stroke-linecap="round" fill="none" />
        </g>
      </svg>

      <!-- Compact Mode Badge -->
      <div class="mt-0.5 px-2.5 py-0.5 rounded-full bg-slate-950/95 border border-emerald-400 text-[10px] font-mono text-emerald-300 font-bold shadow-md flex items-center gap-1 backdrop-blur-md">
        <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
        <span>💻 Dev Coder</span>
      </div>
    </div>
  </div>
</template>
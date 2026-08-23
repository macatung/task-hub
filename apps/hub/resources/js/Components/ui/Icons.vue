<script setup lang="ts">
import { computed } from 'vue';
import * as LucideIcons from 'lucide-vue-next';

interface Props {
  name: string;
  size?: number | string;
  strokeWidth?: number | string;
  class?: string;
}

const props = withDefaults(defineProps<Props>(), {
  size: 20,
  strokeWidth: 2,
  class: '',
});

const toPascalCase = (str: string) => {
  return str
    .replace(/[-_](\w)/g, (_, c) => c.toUpperCase())
    .replace(/^\w/, (c) => c.toUpperCase());
};

const resolvedIcon = computed(() => {
  const rawName = props.name || '';
  const pascalName = toPascalCase(rawName);
  
  const directMatch =
    (LucideIcons as Record<string, any>)[rawName] ||
    (LucideIcons as Record<string, any>)[pascalName];
  if (directMatch) return directMatch;

  const fallbackMap: Record<string, any> = {
    Code: LucideIcons.Code2 || LucideIcons.Code,
    Terminal: LucideIcons.TerminalSquare || LucideIcons.Terminal,
    Coffee: LucideIcons.Coffee,
    Bug: LucideIcons.Bug,
    Zap: LucideIcons.Zap,
    Flame: LucideIcons.Flame,
    Moon: LucideIcons.Moon,
    Sun: LucideIcons.Sun,
    Layout: LucideIcons.LayoutGrid || LucideIcons.Layout,
    Server: LucideIcons.Server,
    Cloud: LucideIcons.CloudLightning || LucideIcons.Cloud,
    Sparkles: LucideIcons.Sparkles,
    Spark: LucideIcons.Sparkles,
    Volume2: LucideIcons.Volume2,
    VolumeX: LucideIcons.VolumeX,
    ChevronUp: LucideIcons.ChevronUp,
    ChevronDown: LucideIcons.ChevronDown,
    ChevronRight: LucideIcons.ChevronRight,
    ChevronsUp: LucideIcons.ChevronsUp || LucideIcons.ChevronUp,
    Minus: LucideIcons.Minus,
    ExternalLink: LucideIcons.ExternalLink,
    Github: LucideIcons.Github,
    Activity: LucideIcons.Activity,
    Check: LucideIcons.Check,
    CheckCircle: LucideIcons.CheckCircle2 || LucideIcons.CheckCircle,
    CheckSquare: LucideIcons.CheckSquare || LucideIcons.Check,
    Copy: LucideIcons.Copy,
    Mail: LucideIcons.Mail,
    Send: LucideIcons.Send,
    Sunrise: LucideIcons.Sunrise || LucideIcons.Sun,
    Sunset: LucideIcons.Sunset || LucideIcons.Moon,
    Clock: LucideIcons.Clock,
    RotateCcw: LucideIcons.RotateCcw,
    Refresh: LucideIcons.RotateCw || LucideIcons.RefreshCw,
    Menu: LucideIcons.Menu,
    X: LucideIcons.X,
    Heart: LucideIcons.Heart,
    Gamepad: LucideIcons.Gamepad2 || LucideIcons.Gamepad,
    Play: LucideIcons.Play,
    Pause: LucideIcons.Pause,
    Shield: LucideIcons.Shield,
    Cpu: LucideIcons.Cpu,
    Desktop: LucideIcons.Monitor || LucideIcons.Tv,
    Folder: LucideIcons.Folder,
    GitBranch: LucideIcons.GitBranch,
    GitPullRequest: LucideIcons.GitPullRequest,
    Diff: LucideIcons.FileDiff || LucideIcons.GitCompare,
    Tag: LucideIcons.Tag,
    Filter: LucideIcons.Filter,
    Search: LucideIcons.Search,
    Lock: LucideIcons.Lock,
    Eye: LucideIcons.Eye,
    Layers: LucideIcons.Layers,
    Sliders: LucideIcons.Sliders,
    Database: LucideIcons.Database,
    Wifi: LucideIcons.Wifi,
    WifiOff: LucideIcons.WifiOff,
    BookOpen: LucideIcons.BookOpen,
    Crown: LucideIcons.Crown,
    Loader: LucideIcons.Loader2 || LucideIcons.Loader,
    HelpCircle: LucideIcons.HelpCircle || LucideIcons.CircleHelp,
    Wrench: LucideIcons.Wrench,
    Pin: LucideIcons.Pin,
    Compass: LucideIcons.Compass,
    Box: LucideIcons.Box,
    ListChecks: LucideIcons.ListChecks,
    ArrowRight: LucideIcons.ArrowRight,
    Agent: LucideIcons.Bot || LucideIcons.Cpu,
    AlertCircle: LucideIcons.AlertCircle || LucideIcons.CircleAlert,
    AlertTriangle: LucideIcons.AlertTriangle || LucideIcons.TriangleAlert,
  };

  return fallbackMap[pascalName] || fallbackMap[rawName] || LucideIcons.HelpCircle || LucideIcons.CircleHelp || LucideIcons.Circle;
});
</script>

<template>
  <component
    :is="resolvedIcon"
    :size="size"
    :stroke-width="strokeWidth"
    :class="props.class"
  />
</template>

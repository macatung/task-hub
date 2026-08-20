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

const resolvedIcon = computed(() => {
  const iconName = props.name;
  const directMatch = (LucideIcons as Record<string, any>)[iconName];
  if (directMatch) return directMatch;

  const fallbackMap: Record<string, any> = {
    Code: LucideIcons.Code2,
    Terminal: LucideIcons.TerminalSquare,
    Coffee: LucideIcons.Coffee,
    Bug: LucideIcons.Bug,
    Zap: LucideIcons.Zap,
    Moon: LucideIcons.Moon,
    Sun: LucideIcons.Sun,
    Layout: LucideIcons.LayoutGrid,
    Server: LucideIcons.Server,
    Cloud: LucideIcons.CloudLightning,
    Sparkles: LucideIcons.Sparkles,
    Volume2: LucideIcons.Volume2,
    VolumeX: LucideIcons.VolumeX,
    ChevronUp: LucideIcons.ChevronUp,
    ChevronDown: LucideIcons.ChevronDown,
    ChevronRight: LucideIcons.ChevronRight,
    ExternalLink: LucideIcons.ExternalLink,
    Github: LucideIcons.Github,
    Activity: LucideIcons.Activity,
    Check: LucideIcons.Check,
    Copy: LucideIcons.Copy,
    Mail: LucideIcons.Mail,
    Send: LucideIcons.Send,
    Sunrise: LucideIcons.Sunrise || LucideIcons.Sun,
    Sunset: LucideIcons.Sunset || LucideIcons.Moon,
    Clock: LucideIcons.Clock,
    RotateCcw: LucideIcons.RotateCcw,
    Menu: LucideIcons.Menu,
    X: LucideIcons.X,
    Heart: LucideIcons.Heart,
    Gamepad: LucideIcons.Gamepad2 || LucideIcons.Gamepad,
    Play: LucideIcons.Play,
  };

  return fallbackMap[iconName] || LucideIcons.HelpCircle;
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

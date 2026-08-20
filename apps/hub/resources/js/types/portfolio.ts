export interface Project {
  id: string;
  title: string;
  tagline: string;
  description: string;
  category: 'fullstack' | 'creative' | 'ai-web3' | 'tools';
  coverGradient: string;
  tags: string[];
  techStack: string[];
  metrics: { label: string; value: string }[];
  liveUrl?: string;
  githubUrl?: string;
  featured?: boolean;
  architectureHighlights: string[];
  midnightFact: string;
}

export interface SkillItem {
  name: string;
  level: number; // 1-100
  rune: string;
  tag: string;
  description: string;
}

export interface SkillCategory {
  title: string;
  iconName: string;
  badge: string;
  skills: SkillItem[];
}

export interface ExperienceItem {
  id: string;
  period: string;
  role: string;
  company: string;
  location: string;
  type: 'Full-time' | 'Contract' | 'Open Source' | 'Venture';
  summary: string;
  achievements: string[];
  technologies: string[];
  midnightQuest: string;
}

export interface DeveloperStat {
  label: string;
  value: string;
  unit?: string;
  iconName: string;
  description: string;
}

export interface TalismanPreset {
  id: string;
  title: string;
  runeTop: string;
  codeSnippet: string;
  meaning: string;
  colorScheme: 'yellow' | 'crimson' | 'cyan' | 'purple';
}

export interface ContactFormData {
  name: string;
  email: string;
  project_type: string;
  coffee_offering: string;
  message: string;
}

export interface FlashMessages {
  success?: string | null;
  error?: string | null;
  reference_id?: string | null;
}

export interface AuthProps {
  user: {
    id: number;
    name: string;
    email: string;
  } | null;
}

export interface PageProps {
  appName?: string;
  title?: string;
  flash?: FlashMessages;
  auth?: AuthProps;
  errors?: Record<string, string>;
  [key: string]: unknown;
}

export interface ISoundEngine {
  isMuted(): boolean;
  toggleMute(): boolean;
  playHop(intensity?: number): void;
  playTalisman(): void;
  playClick(): void;
  playTerminalKey(): void;
  playSuccess(): void;
  playCelestialChime(phaseId?: string): void;
}

export interface MascotProps {
  size?: 'sm' | 'md' | 'lg' | 'hero';
  showControls?: boolean;
}

export interface MascotEmits {
  (e: 'hop-count-change', count: number): void;
}

<script setup lang="ts">
import { ref, computed } from 'vue';
import { usePage, Head, Link } from '@inertiajs/vue3';
import Icons from '@/Components/ui/Icons.vue';

interface PlanLimit {
  history_retention_days?: number;
  custom_mcp?: boolean;
  team_roles?: boolean;
  priority_queue?: boolean;
  sso_enabled?: boolean;
  [key: string]: any;
}

interface PlanItem {
  id: number;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  price_monthly: number;
  price_yearly: number;
  currency: string;
  max_runners: number | null;
  max_seats: number | null;
  max_projects: number | null;
  features: string[];
  limits?: PlanLimit;
  is_active: boolean;
  is_popular: boolean;
  sort_order: number;
}

interface WorkspaceItem {
  id: number;
  name: string;
  slug: string;
  plan?: string;
}

interface UserAuth {
  id: number;
  name: string;
  email: string;
  github_login?: string | null;
  github_avatar_url?: string | null;
}

interface PageProps {
  appName?: string;
  auth?: { user?: UserAuth | null };
  flash?: { success?: string | null; error?: string | null };
  plans?: PlanItem[];
  workspaces?: WorkspaceItem[];
  currentWorkspaceId?: number | null;
  [key: string]: any;
}

const props = withDefaults(
  defineProps<{
    plans?: PlanItem[];
    workspaces?: WorkspaceItem[];
    currentWorkspaceId?: number | null;
  }>(),
  {
    plans: () => [],
    workspaces: () => [],
    currentWorkspaceId: null,
  }
);

const page = usePage<PageProps>();
const user = computed(() => page.props.auth?.user ?? null);
const flash = computed(() => page.props.flash ?? {});

// Billing cycle state: 'monthly' | 'yearly'
const billingCycle = ref<'monthly' | 'yearly'>('monthly');

// Mobile navigation menu toggle
const mobileMenuOpen = ref(false);

// Enterprise contact modal state
const isContactModalOpen = ref(false);
const contactForm = ref({
  name: user.value?.name || '',
  email: user.value?.email || '',
  company: '',
  teamSize: '20-50',
  message: '',
});
const contactSubmitted = ref(false);

// Fallback plans if database returned empty
const defaultPlans: PlanItem[] = [
  {
    id: 1,
    slug: 'community',
    name: 'Community',
    tagline: 'For individual hackers and open-source contributors',
    description: 'Free forever with local desktop runner support and standard features.',
    price_monthly: 0,
    price_yearly: 0,
    currency: 'USD',
    max_runners: 1,
    max_seats: 1,
    max_projects: 3,
    features: [
      '1 Concurrent Desktop Runner',
      'Up to 3 Active Projects',
      '1 Personal Seat',
      'Basic GitHub Repository Sync',
      'Community Discord Support',
      'Local Agent Run History (7 days)',
    ],
    limits: {
      history_retention_days: 7,
      custom_mcp: false,
      team_roles: false,
      priority_queue: false,
    },
    is_active: true,
    is_popular: false,
    sort_order: 1,
  },
  {
    id: 2,
    slug: 'pro',
    name: 'Pro Developer',
    tagline: 'For professional engineers supercharging their local AI workflow',
    description: 'Triple concurrent execution, unlimited projects, and priority streaming.',
    price_monthly: 19,
    price_yearly: 180,
    currency: 'USD',
    max_runners: 3,
    max_seats: 1,
    max_projects: null,
    features: [
      '3 Concurrent Desktop Runners',
      'Unlimited Projects & Roadmaps',
      '1 Developer Seat',
      'Priority AI Task Dispatching',
      'Fast SSE Realtime Log Streaming',
      'Automated GitHub PR Creation',
      'Run History (90 days)',
      'Standard Email Support',
    ],
    limits: {
      history_retention_days: 90,
      custom_mcp: true,
      team_roles: false,
      priority_queue: true,
    },
    is_active: true,
    is_popular: true,
    sort_order: 2,
  },
  {
    id: 3,
    slug: 'team',
    name: 'Team / Startup',
    tagline: 'For engineering squads collaborating with multi-agent swarms',
    description: '10 concurrent runners, 10 team seats, role-based access, and shared vaults.',
    price_monthly: 49,
    price_yearly: 468,
    currency: 'USD',
    max_runners: 10,
    max_seats: 10,
    max_projects: null,
    features: [
      '10 Concurrent Desktop Runners',
      '10 Team Member Seats',
      'Unlimited Projects & Epics',
      'Team Credential Vault Sharing',
      'Role-Based Access Control (Admin/Dev/Viewer)',
      'Multi-runner Fleet Dashboard',
      'Team Analytics & Velocity Metrics',
      'Priority Support with 24h SLA',
    ],
    limits: {
      history_retention_days: 365,
      custom_mcp: true,
      team_roles: true,
      priority_queue: true,
    },
    is_active: true,
    is_popular: false,
    sort_order: 3,
  },
  {
    id: 4,
    slug: 'enterprise',
    name: 'Enterprise',
    tagline: 'For large organizations needing custom capacity and dedicated governance',
    description: 'Unlimited scale, custom security appliances, SAML SSO, and dedicated SLA.',
    price_monthly: 199,
    price_yearly: 1908,
    currency: 'USD',
    max_runners: null,
    max_seats: null,
    max_projects: null,
    features: [
      'Unlimited Concurrent Runners & Fleets',
      'Unlimited Team Seats',
      'Dedicated On-Premise Runner Appliances',
      'Custom SAML/SSO & Okta Integration',
      'Enterprise Security & Audit Logging',
      'Custom Model Context Protocol (MCP) Connectors',
      'Dedicated Account Manager & 99.9% SLA',
      'Custom Invoicing & Procurement Support',
    ],
    limits: {
      history_retention_days: 730,
      custom_mcp: true,
      team_roles: true,
      priority_queue: true,
      sso_enabled: true,
    },
    is_active: true,
    is_popular: false,
    sort_order: 4,
  },
];

const effectivePlans = computed(() => {
  if (props.plans && props.plans.length > 0) {
    return props.plans;
  }
  return defaultPlans;
});

// Helper for monthly breakdown
const getPlanPrice = (plan: PlanItem) => {
  if (plan.price_monthly === 0) return 0;
  if (billingCycle.value === 'yearly') {
    return Math.round(plan.price_yearly / 12);
  }
  return plan.price_monthly;
};

// Helper for total annual bill
const getAnnualBilledAmount = (plan: PlanItem) => {
  return plan.price_yearly;
};

// Active user's current workspace
const activeWorkspace = computed(() => {
  if (!props.workspaces || props.workspaces.length === 0) return null;
  if (props.currentWorkspaceId) {
    return props.workspaces.find((w) => w.id === props.currentWorkspaceId) || props.workspaces[0];
  }
  return props.workspaces[0];
});

// Active user's current plan slug
const currentPlanSlug = computed(() => {
  return activeWorkspace.value?.plan || 'community';
});

// Get CTA destination and text
const getPlanCta = (plan: PlanItem) => {
  if (plan.slug === 'enterprise') {
    return {
      label: 'Contact Enterprise Sales',
      href: '#',
      isModal: true,
      primary: false,
      variant: 'enterprise',
    };
  }

  if (!user.value) {
    if (plan.slug === 'community') {
      return {
        label: 'Get Started Free',
        href: '/auth/github',
        isModal: false,
        primary: false,
        variant: 'github',
      };
    }
    return {
      label: `Start with ${plan.name}`,
      href: '/auth/github',
      isModal: false,
      primary: plan.is_popular,
      variant: 'github',
    };
  }

  // Authenticated user
  if (currentPlanSlug.value === plan.slug) {
    return {
      label: 'Current Active Plan',
      href: `/workspaces/${activeWorkspace.value?.id || 'default'}/billing`,
      isModal: false,
      primary: false,
      isCurrent: true,
      variant: 'current',
    };
  }

  return {
    label: `Switch to ${plan.name}`,
    href: `/workspaces/${activeWorkspace.value?.id || 'default'}/billing?plan=${plan.slug}`,
    isModal: false,
    primary: plan.is_popular,
    variant: 'billing',
  };
};

const handleCtaClick = (plan: PlanItem) => {
  if (plan.slug === 'enterprise') {
    isContactModalOpen.value = true;
  }
};

const submitContactForm = () => {
  contactSubmitted.value = true;
  setTimeout(() => {
    isContactModalOpen.value = false;
    contactSubmitted.value = false;
  }, 2500);
};

// Feature matrix rows
interface MatrixRow {
  name: string;
  tooltip?: string;
  community: string | boolean;
  pro: string | boolean;
  team: string | boolean;
  enterprise: string | boolean;
}

interface MatrixCategory {
  category: string;
  rows: MatrixRow[];
}

const matrixCategories: MatrixCategory[] = [
  {
    category: 'Core Quotas & Capacity',
    rows: [
      {
        name: 'Concurrent Desktop Runners',
        tooltip: 'Simultaneously running AI coding agents',
        community: '1 runner',
        pro: '3 runners',
        team: '10 runners',
        enterprise: 'Unlimited custom fleet',
      },
      {
        name: 'Active Project Workspaces',
        tooltip: 'Managed GitHub repositories & task boards',
        community: '3 projects',
        pro: 'Unlimited',
        team: 'Unlimited',
        enterprise: 'Unlimited',
      },
      {
        name: 'Included Workspace Seats',
        tooltip: 'Collaborating engineers and managers',
        community: '1 seat',
        pro: '1 developer seat',
        team: '10 team seats',
        enterprise: 'Unlimited seats',
      },
      {
        name: 'Run History & Evidence Retention',
        tooltip: 'Retention period for test outputs and diffs',
        community: '7 days',
        pro: '90 days',
        team: '365 days',
        enterprise: '730 days (2 years)',
      },
    ],
  },
  {
    category: 'AI Engine & Agent Execution',
    rows: [
      {
        name: 'Model Context Protocol (MCP) Standard',
        tooltip: 'Compatible with Antigravity, Claude Code, Cursor',
        community: true,
        pro: true,
        team: true,
        enterprise: true,
      },
      {
        name: 'Custom In-House MCP Tool Connectors',
        tooltip: 'Expose private databases & CLI scripts to agents',
        community: false,
        pro: true,
        team: true,
        enterprise: true,
      },
      {
        name: 'Priority Task Dispatch Queue',
        tooltip: 'Instant runner scheduling with zero queue delay',
        community: false,
        pro: true,
        team: true,
        enterprise: true,
      },
      {
        name: 'Real-Time SSE Log & Telemetry Streaming',
        tooltip: 'Sub-second agent terminal streaming',
        community: 'Standard',
        pro: 'High-speed SSE',
        team: 'High-speed SSE',
        enterprise: 'Dedicated Streaming Gateway',
      },
      {
        name: 'Multi-Agent Swarm Orchestration',
        tooltip: 'Dispatch epics to multiple parallel sub-agents',
        community: false,
        pro: false,
        team: true,
        enterprise: true,
      },
    ],
  },
  {
    category: 'GitHub Integration & Collaboration',
    rows: [
      {
        name: 'GitHub Webhook & Bi-directional Sync',
        tooltip: 'Real-time task synchronization with GitHub issues/PRs',
        community: 'Basic Sync',
        pro: 'Auto PR Creation',
        team: 'Full Squad Sync',
        enterprise: 'Multi-Org Enterprise Sync',
      },
      {
        name: 'Team Credential Vault & Shared Secrets',
        tooltip: 'Securely share API keys across runners',
        community: false,
        pro: false,
        team: true,
        enterprise: true,
      },
      {
        name: 'Role-Based Access Control (RBAC)',
        tooltip: 'Admin, Developer, and Viewer permissions',
        community: false,
        pro: false,
        team: true,
        enterprise: true,
      },
      {
        name: 'SAML 2.0 / Okta / Azure AD SSO',
        tooltip: 'Enterprise single sign-on security',
        community: false,
        pro: false,
        team: false,
        enterprise: true,
      },
    ],
  },
  {
    category: 'Support, SLA & Procurement',
    rows: [
      {
        name: 'Technical Support Channel',
        tooltip: 'Support response channels and commitment',
        community: 'Community Discord',
        pro: 'Standard Email',
        team: 'Priority 24h SLA',
        enterprise: 'Dedicated Account Manager',
      },
      {
        name: 'Uptime SLA Commitment',
        tooltip: 'Service Level Agreement uptime guarantee',
        community: 'Best Effort',
        pro: '99.5%',
        team: '99.9%',
        enterprise: '99.99% Financial Backing',
      },
      {
        name: 'Custom Invoicing & Vendor Procurement',
        tooltip: 'Purchase orders, ACH, and custom contracts',
        community: false,
        pro: false,
        team: false,
        enterprise: true,
      },
    ],
  },
];

// FAQs list
const faqs = [
  {
    question: 'How does the Monthly vs. Yearly billing discount work?',
    answer:
      'Yearly billing is paid upfront for a 12-month period and includes an automatic 20% discount compared to the standard monthly rate. For example, Pro Developer is $19/mo when billed monthly, but only $15/mo ($180/year) when billed annually.',
  },
  {
    question: 'What constitutes a Concurrent Desktop Runner?',
    answer:
      'A runner is an active agent worker executing code modifications, running tests, or streaming diff evidence on a local or remote machine. You can connect as many local machines as you like; the limit only applies to the number of agents actively executing work at the exact same time.',
  },
  {
    question: 'Can I add additional seats or extra runner capacity later?',
    answer:
      'Yes! On Team and Enterprise plans, workspace administrators can add extra team member seats ($10/seat/month) and add-on concurrent runner slots directly from the Workspace Billing settings without changing tiers.',
  },
  {
    question: 'Is there a free trial for Pro Developer or Team plans?',
    answer:
      'Yes. Every GitHub-authenticated user can try Pro or Team features with a 14-day free trial. No credit card is required to explore our Community tier, and you can upgrade at any time with 1-click.',
  },
  {
    question: 'How is our codebase and private credential data secured?',
    answer:
      'Midnight Hub operates on a zero-knowledge architecture: your proprietary source code never leaves your local repository or private runner environment. Only task specs, Acceptance Criteria, and execution logs are relayed via TLS 1.3 encrypted endpoints.',
  },
  {
    question: 'How does Supervised Vibe Coding prevent silent bugs in our code?',
    answer:
      'Midnight Hub implements a strict 4-step pipeline (implement ➔ review ➔ evidence ➔ handoff). AI agents (Antigravity 2.0, Codex, Claude Code) are isolated in dedicated Git worktrees and must run your test suite, calculate risk scores, and attach verified evidence before a human reviewer approves the merge. No code enters main without passing the verification gate.',
  },
  {
    question: 'What is Verification Evidence and how long is it retained?',
    answer:
      'Verification Evidence is an auditable cryptographic package containing test execution outputs, pass/fail counts, duration, and actor attribution. Retention ranges from 7 days on Community, 90 days on Pro, 365 days on Team, up to 730 days (2 years) on Enterprise.',
  },
  {
    question: 'What happens if our team hits a quota limit?',
    answer:
      'When your team reaches runner concurrency or project limits, Midnight Hub displays a friendly in-app Upgrade prompt. Your existing runs are never interrupted, and you can upgrade instantly with prorated billing.',
  },
];

import SeoHead from '@/Components/common/SeoHead.vue';

// Open FAQ item tracking
const openFaqIndex = ref<number | null>(0);
const toggleFaq = (index: number) => {
  openFaqIndex.value = openFaqIndex.value === index ? null : index;
};

const pricingJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Midnight Hub',
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'Cross-platform, Web, Windows',
  description: 'Commercial AI coding agent platform & supervised vibe coding engine with transparent pricing.',
  offers: [
    {
      '@type': 'Offer',
      name: 'Community Tier',
      price: '0',
      priceCurrency: 'USD',
      description: '1 Concurrent Runner, 3 Active Workspaces, 7-day retention.',
    },
    {
      '@type': 'Offer',
      name: 'Pro Developer',
      price: '19',
      priceCurrency: 'USD',
      description: '3 Concurrent Runners, Unlimited Workspaces, 90-day retention.',
    },
    {
      '@type': 'Offer',
      name: 'Engineering Team',
      price: '99',
      priceCurrency: 'USD',
      description: '10 Concurrent Runners, 10 Team Seats, Custom MCP, 365-day retention.',
    },
  ],
};
</script>

<template>
  <SeoHead
    title="Pricing & Subscription Plans — Midnight Hub"
    description="Explore Midnight Hub plans: Free Community runner, Pro Developer tier with priority streaming, and Startup / Team subscriptions for autonomous multi-agent orchestration."
    keywords="Midnight Hub Pricing, Developer Subscription, Vibe Coding Plans, AI Agent Studio, Pro Developer"
    canonical="https://macatung.dev/pricing"
    :json-ld="pricingJsonLd"
  />

  <div class="pricing-page min-h-screen bg-midnight-950 text-slate-100 font-sans selection:bg-phantom-mint selection:text-midnight-950 overflow-x-hidden">
    <!-- Ambient Background Lighting -->
    <div class="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div class="absolute -top-40 left-1/2 -translate-x-1/2 h-[550px] w-[1000px] rounded-full bg-gradient-to-tr from-emerald-600/15 via-phantom-cyan/15 to-phantom-purple/10 blur-[140px]" />
      <div class="absolute top-[800px] -left-40 h-[500px] w-[700px] rounded-full bg-gradient-to-br from-phantom-blue/10 via-phantom-purple/15 to-transparent blur-[130px]" />
      <div class="absolute bottom-20 -right-40 h-[600px] w-[800px] rounded-full bg-gradient-to-tl from-talisman-gold/10 via-emerald-600/15 to-transparent blur-[150px]" />
    </div>

    <!-- Sticky Navigation Header -->
    <header class="sticky top-0 z-50 border-b border-midnight-800/80 bg-midnight-950/85 backdrop-blur-md">
      <div class="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <a href="/" class="flex items-center gap-3 group">
          <div class="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 via-teal-500/10 to-phantom-cyan/20 border border-emerald-500/40 p-1 shadow-md shadow-emerald-500/10 group-hover:border-emerald-400 group-hover:scale-105 transition-all">
            <img src="/brand/midnight-hub-mark.svg?v=20260829" alt="Midnight Hub" class="h-full w-full object-contain drop-shadow-sm" />
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xl font-bold tracking-tight text-white group-hover:text-phantom-mint transition-colors">Midnight Hub</span>
            <span class="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">Pricing</span>
          </div>
        </a>

        <!-- Desktop Navigation Links -->
        <nav class="hidden md:flex items-center gap-1.5 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-1 text-xs font-medium text-slate-300">
          <Link href="/" class="px-3 py-1.5 rounded-xl hover:text-white hover:bg-white/5 transition-all">Overview</Link>
          <Link href="/tasks" class="px-3 py-1.5 rounded-xl hover:text-white hover:bg-white/5 transition-all">Workspace</Link>
          <Link href="/projects" class="px-3 py-1.5 rounded-xl hover:text-white hover:bg-white/5 transition-all">Projects</Link>
          <Link href="/desktop" class="px-3 py-1.5 rounded-xl hover:text-white hover:bg-white/5 transition-all">Desktop</Link>
          <Link href="/pricing" class="px-3 py-1.5 rounded-xl text-emerald-400 bg-emerald-500/10 font-bold transition-all">Pricing</Link>
        </nav>

        <!-- Right Side User / Auth Actions -->
        <div class="hidden sm:flex items-center gap-4">
          <a
            href="https://github.com/macatung/task-hub"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center gap-2 rounded-lg border border-midnight-800 bg-midnight-900/60 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-midnight-700 hover:text-white transition-all"
          >
            <Icons name="Github" :size="15" />
            <span>GitHub</span>
          </a>

          <template v-if="user">
            <a
              href="/tasks"
              class="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2 text-xs font-bold text-midnight-950 shadow-lg shadow-emerald-500/25 hover:from-emerald-400 hover:to-teal-400 transition-all cursor-pointer"
            >
              <span>Enter Workspace</span>
              <span>→</span>
            </a>
          </template>
          <template v-else>
            <a
              href="/auth/github"
              class="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-midnight-950 shadow-lg shadow-emerald-500/25 hover:bg-emerald-400 active:scale-95 transition-all cursor-pointer"
            >
              <Icons name="Github" :size="15" />
              <span>Sign in with GitHub</span>
            </a>
          </template>
        </div>

        <!-- Mobile Menu Hamburger Button -->
        <button
          @click="mobileMenuOpen = !mobileMenuOpen"
          class="flex md:hidden items-center justify-center p-2 rounded-lg border border-midnight-800 bg-midnight-900 text-slate-300 hover:text-white"
          aria-label="Toggle navigation menu"
        >
          <Icons :name="mobileMenuOpen ? 'X' : 'Menu'" :size="20" />
        </button>
      </div>

      <!-- Mobile Dropdown Menu -->
      <div v-if="mobileMenuOpen" class="md:hidden border-t border-midnight-800 bg-midnight-950 px-6 py-4 space-y-2">
        <Link href="/" @click="mobileMenuOpen = false" class="block py-2 text-sm text-slate-300 hover:text-white">Overview</Link>
        <Link href="/tasks" @click="mobileMenuOpen = false" class="block py-2 text-sm text-slate-300 hover:text-white">Workspace</Link>
        <Link href="/projects" @click="mobileMenuOpen = false" class="block py-2 text-sm text-slate-300 hover:text-white">Projects</Link>
        <Link href="/desktop" @click="mobileMenuOpen = false" class="block py-2 text-sm text-slate-300 hover:text-white">Desktop</Link>
        <Link href="/pricing" @click="mobileMenuOpen = false" class="block py-2 text-sm text-emerald-400 font-bold">Pricing</Link>
        <div class="pt-3 border-t border-midnight-800 flex flex-col gap-2">
          <template v-if="user">
            <Link href="/tasks" class="rounded-xl bg-emerald-500 px-4 py-2 text-center text-xs font-bold text-midnight-950">Enter Workspace</Link>
          </template>
          <template v-else>
            <a href="/auth/github" class="rounded-xl bg-emerald-500 px-4 py-2 text-center text-xs font-bold text-midnight-950 flex items-center justify-center gap-2">
              <Icons name="Github" :size="15" />
              <span>Sign in with GitHub</span>
            </a>
          </template>
        </div>
      </div>
    </header>

    <!-- MAIN PRICING HERO -->
    <main class="relative z-10 mx-auto max-w-7xl px-6 pt-16 pb-28">
      <!-- Title & Intro Header -->
      <div class="text-center max-w-3xl mx-auto">
        <div class="inline-flex items-center gap-2 rounded-full border border-phantom-cyan/30 bg-phantom-cyan/10 px-4 py-1.5 text-xs font-semibold text-phantom-cyan shadow-inner mb-6">
          <Icons name="Zap" :size="14" class="text-phantom-mint" />
          <span>Flexible, Transparent Commercial Tiers</span>
        </div>

        <h1 class="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white leading-[1.15]">
          Predictable scale for<br />
          <span class="bg-gradient-to-r from-phantom-cyan via-phantom-mint to-talisman-gold bg-clip-text text-transparent">
            Supervised Vibe Coding & Agent Fleets
          </span>
        </h1>

        <p class="mt-6 text-base sm:text-lg text-slate-400 leading-relaxed">
          From solo developers vibe coding with Antigravity 2.0 to enterprise engineering fleets running multi-agent swarms with strict verification evidence and zero-defect quality gates.
        </p>

        <!-- MONTHLY / YEARLY TOGGLE -->
        <div class="mt-10 inline-flex items-center justify-center rounded-2xl border border-midnight-700/80 bg-midnight-900/90 p-1.5 shadow-2xl backdrop-blur-lg">
          <button
            type="button"
            @click="billingCycle = 'monthly'"
            :class="[
              'relative rounded-xl px-5 py-2.5 text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer',
              billingCycle === 'monthly'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-midnight-950 font-bold shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-slate-200'
            ]"
          >
            Monthly Billing
          </button>

          <button
            type="button"
            @click="billingCycle = 'yearly'"
            :class="[
              'relative flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer',
              billingCycle === 'yearly'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-midnight-950 font-bold shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-slate-200'
            ]"
          >
            <span>Annual Billing</span>
            <span class="rounded-full bg-talisman-gold/20 border border-talisman-gold/40 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-talisman-gold shadow-sm animate-pulse">
              Save 20%
            </span>
          </button>
        </div>
      </div>

      <!-- 4 TIER CARDS GRID -->
      <div class="mt-16 grid gap-8 lg:grid-cols-4 md:grid-cols-2 grid-cols-1 items-stretch">
        <div
          v-for="plan in effectivePlans"
          :key="plan.slug"
          :class="[
            'relative flex flex-col justify-between rounded-3xl p-7 transition-all duration-300 backdrop-blur-xl',
            plan.is_popular
              ? 'border-2 border-phantom-cyan/70 bg-gradient-to-b from-midnight-900/90 via-midnight-850/80 to-midnight-900/95 shadow-2xl shadow-phantom-cyan/15 ring-1 ring-phantom-cyan/40 -translate-y-2'
              : 'border border-midnight-800/80 bg-midnight-900/60 hover:border-midnight-700 hover:bg-midnight-900/80 shadow-xl'
          ]"
        >
          <!-- Popular Highlight Badge -->
          <div
            v-if="plan.is_popular"
            class="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-phantom-cyan via-teal-400 to-emerald-400 px-4 py-1 text-[11px] font-black uppercase tracking-wider text-midnight-950 shadow-md shadow-phantom-cyan/30"
          >
            ★ Most Popular
          </div>

          <!-- Card Header & Pricing -->
          <div>
            <div class="flex items-center justify-between">
              <h3 class="text-xl font-extrabold text-white tracking-tight">{{ plan.name }}</h3>
              <span
                v-if="plan.slug === 'enterprise'"
                class="rounded-md border border-phantom-purple/40 bg-phantom-purple/10 px-2 py-0.5 text-[10px] font-bold text-phantom-lavender uppercase"
              >
                Custom Scale
              </span>
              <span
                v-else-if="plan.slug === 'community'"
                class="rounded-md border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-[10px] font-bold text-slate-300 uppercase"
              >
                Free Tier
              </span>
            </div>

            <p class="mt-2 text-xs text-slate-400 leading-relaxed min-h-[36px]">
              {{ plan.tagline }}
            </p>

            <!-- Price Display -->
            <div class="mt-6 flex items-baseline gap-1.5 pb-6 border-b border-midnight-800/80">
              <span class="text-4xl sm:text-5xl font-black tracking-tight text-white">
                ${{ getPlanPrice(plan) }}
              </span>
              <span class="text-sm font-medium text-slate-400">
                {{ plan.price_monthly === 0 ? 'forever' : '/ month' }}
              </span>
            </div>

            <!-- Annual Billing Subtext -->
            <div class="mt-2 text-[11px] text-slate-400 min-h-[20px]">
              <span v-if="billingCycle === 'yearly' && plan.price_yearly > 0" class="text-phantom-mint font-semibold">
                ✓ ${{ getAnnualBilledAmount(plan) }} billed annually (20% off)
              </span>
              <span v-else-if="plan.price_monthly > 0 && billingCycle === 'monthly'" class="text-slate-500">
                Billed ${{ plan.price_monthly }} monthly
              </span>
              <span v-else class="text-slate-500">
                No credit card required
              </span>
            </div>

            <!-- Key Quota Badges -->
            <div class="mt-6 grid grid-cols-2 gap-2 text-[11px]">
              <div class="rounded-xl border border-midnight-800 bg-midnight-950/60 p-2.5">
                <span class="text-slate-500 block text-[10px] uppercase font-bold">Runners</span>
                <span class="text-white font-bold">{{ plan.max_runners ? `${plan.max_runners} concurrent` : 'Unlimited' }}</span>
              </div>
              <div class="rounded-xl border border-midnight-800 bg-midnight-950/60 p-2.5">
                <span class="text-slate-500 block text-[10px] uppercase font-bold">Seats</span>
                <span class="text-white font-bold">{{ plan.max_seats ? `${plan.max_seats} seat${plan.max_seats > 1 ? 's' : ''}` : 'Unlimited' }}</span>
              </div>
            </div>

            <!-- Plan Features List -->
            <div class="mt-6 space-y-3 text-xs">
              <div
                v-for="(feature, idx) in plan.features"
                :key="idx"
                class="flex items-start gap-2.5 text-slate-300"
              >
                <div class="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                  <Icons name="Check" :size="11" :stroke-width="3" />
                </div>
                <span class="leading-snug">{{ feature }}</span>
              </div>
            </div>
          </div>

          <!-- Bottom Action CTA -->
          <div class="mt-8 pt-4 border-t border-midnight-800/60">
            <template v-if="getPlanCta(plan).isModal">
              <button
                type="button"
                @click="handleCtaClick(plan)"
                class="w-full rounded-2xl border border-phantom-purple/50 bg-gradient-to-r from-phantom-purple/20 to-phantom-neon/20 px-4 py-3.5 text-center text-xs sm:text-sm font-bold text-phantom-lavender hover:bg-phantom-purple/30 hover:border-phantom-purple hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer shadow-lg shadow-phantom-purple/10"
              >
                {{ getPlanCta(plan).label }}
              </button>
            </template>
            <template v-else-if="getPlanCta(plan).isCurrent">
              <a
                :href="getPlanCta(plan).href"
                class="block w-full rounded-2xl border border-midnight-700 bg-midnight-800/60 px-4 py-3.5 text-center text-xs sm:text-sm font-bold text-slate-400 hover:text-white hover:bg-midnight-800 transition-all cursor-pointer"
              >
                {{ getPlanCta(plan).label }}
              </a>
            </template>
            <template v-else>
              <a
                :href="getPlanCta(plan).href"
                :class="[
                  'block w-full rounded-2xl px-4 py-3.5 text-center text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer shadow-lg',
                  plan.is_popular
                    ? 'bg-gradient-to-r from-emerald-400 via-teal-400 to-phantom-cyan text-midnight-950 font-black shadow-emerald-500/30 hover:scale-[1.02] active:scale-[0.98]'
                    : 'border border-midnight-700 bg-midnight-800/90 text-white hover:border-emerald-500/50 hover:bg-midnight-700/80 active:scale-[0.98]'
                ]"
              >
                {{ getPlanCta(plan).label }}
              </a>
            </template>
          </div>
        </div>
      </div>

      <!-- DETAILED FEATURE COMPARISON MATRIX -->
      <section class="mt-28 border-t border-midnight-800/80 pt-20">
        <div class="text-center max-w-2xl mx-auto mb-14">
          <p class="text-xs font-bold tracking-wider uppercase text-phantom-mint">In-Depth Capability Breakdown</p>
          <h2 class="mt-2 text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Compare all plan capabilities & quotas
          </h2>
          <p class="mt-3 text-sm text-slate-400">
            Transparent breakdown of execution limits, protocol connectors, SLAs, and security controls.
          </p>
        </div>

        <!-- Matrix Table Container -->
        <div class="overflow-x-auto rounded-3xl border border-midnight-800/90 bg-midnight-900/50 shadow-2xl backdrop-blur-xl">
          <table class="w-full text-left border-collapse text-xs sm:text-sm">
            <!-- Table Header -->
            <thead>
              <tr class="border-b border-midnight-800 bg-midnight-950/80">
                <th class="p-5 font-bold text-white w-2/5">Capabilities & Quotas</th>
                <th class="p-5 font-bold text-slate-300 text-center w-[15%]">Community</th>
                <th class="p-5 font-bold text-phantom-cyan text-center w-[15%] bg-phantom-cyan/5">
                  Pro Developer
                </th>
                <th class="p-5 font-bold text-slate-300 text-center w-[15%]">Team / Startup</th>
                <th class="p-5 font-bold text-phantom-lavender text-center w-[15%]">Enterprise</th>
              </tr>
            </thead>

            <!-- Table Body Categories -->
            <tbody v-for="(cat, catIdx) in matrixCategories" :key="catIdx" class="divide-y divide-midnight-800/50">
              <tr class="bg-midnight-950/40">
                <td colspan="5" class="py-3 px-5 text-xs font-extrabold uppercase tracking-wider text-talisman-gold bg-midnight-900/80">
                  {{ cat.category }}
                </td>
              </tr>
              <tr
                v-for="(row, rowIdx) in cat.rows"
                :key="rowIdx"
                class="hover:bg-midnight-800/30 transition-colors"
              >
                <td class="p-4 sm:p-5 text-slate-200 font-medium">
                  <div class="font-semibold text-white">{{ row.name }}</div>
                  <div v-if="row.tooltip" class="text-[11px] text-slate-500 mt-0.5">{{ row.tooltip }}</div>
                </td>

                <!-- Community Value -->
                <td class="p-4 sm:p-5 text-center text-slate-400">
                  <template v-if="typeof row.community === 'boolean'">
                    <span v-if="row.community" class="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">✓</span>
                    <span v-else class="text-slate-600 font-bold">—</span>
                  </template>
                  <template v-else>
                    <span class="font-medium text-slate-300">{{ row.community }}</span>
                  </template>
                </td>

                <!-- Pro Developer Value (Highlighted Column) -->
                <td class="p-4 sm:p-5 text-center text-phantom-cyan bg-phantom-cyan/5 font-semibold">
                  <template v-if="typeof row.pro === 'boolean'">
                    <span v-if="row.pro" class="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">✓</span>
                    <span v-else class="text-slate-600 font-bold">—</span>
                  </template>
                  <template v-else>
                    <span>{{ row.pro }}</span>
                  </template>
                </td>

                <!-- Team Value -->
                <td class="p-4 sm:p-5 text-center text-slate-300">
                  <template v-if="typeof row.team === 'boolean'">
                    <span v-if="row.team" class="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">✓</span>
                    <span v-else class="text-slate-600 font-bold">—</span>
                  </template>
                  <template v-else>
                    <span class="font-medium text-slate-200">{{ row.team }}</span>
                  </template>
                </td>

                <!-- Enterprise Value -->
                <td class="p-4 sm:p-5 text-center text-phantom-lavender font-semibold">
                  <template v-if="typeof row.enterprise === 'boolean'">
                    <span v-if="row.enterprise" class="inline-flex h-5 w-5 items-center justify-center rounded-full bg-phantom-purple/20 text-phantom-lavender">✓</span>
                    <span v-else class="text-slate-600 font-bold">—</span>
                  </template>
                  <template v-else>
                    <span>{{ row.enterprise }}</span>
                  </template>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- FREQUENTLY ASKED QUESTIONS SECTION -->
      <section class="mt-28 border-t border-midnight-800/80 pt-20">
        <div class="text-center max-w-2xl mx-auto mb-14">
          <p class="text-xs font-bold tracking-wider uppercase text-talisman-gold">Clear Answers</p>
          <h2 class="mt-2 text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Frequently Asked Questions
          </h2>
          <p class="mt-3 text-sm text-slate-400">
            Have questions about billing cycles, runner allocation, or security protocols?
          </p>
        </div>

        <div class="max-w-3xl mx-auto space-y-4">
          <div
            v-for="(faq, idx) in faqs"
            :key="idx"
            class="rounded-2xl border border-midnight-800/90 bg-midnight-900/50 backdrop-blur-md overflow-hidden transition-all duration-200"
          >
            <button
              type="button"
              @click="toggleFaq(idx)"
              class="w-full flex items-center justify-between p-5 text-left text-sm sm:text-base font-bold text-white hover:text-phantom-mint transition-colors cursor-pointer"
            >
              <span>{{ faq.question }}</span>
              <Icons
                name="ChevronDown"
                :size="18"
                :class="[
                  'text-slate-400 transition-transform duration-200 shrink-0 ml-4',
                  openFaqIndex === idx ? 'rotate-180 text-phantom-mint' : ''
                ]"
              />
            </button>

            <div
              v-show="openFaqIndex === idx"
              class="px-5 pb-5 text-xs sm:text-sm text-slate-400 leading-relaxed border-t border-midnight-800/40 pt-3"
            >
              {{ faq.answer }}
            </div>
          </div>
        </div>
      </section>

      <!-- BOTTOM READY TO START BANNER -->
      <section class="mt-28 rounded-3xl border border-midnight-800/80 bg-gradient-to-b from-midnight-900/90 via-midnight-850/80 to-midnight-950 p-8 sm:p-14 text-center shadow-2xl relative overflow-hidden">
        <div class="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-48 w-96 rounded-full bg-emerald-500/20 blur-[90px]" />
        
        <div class="relative z-10 max-w-2xl mx-auto">
          <div class="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-bold text-emerald-400 mb-6">
            <span>🚀 1-Click Instant Onboarding</span>
          </div>

          <h2 class="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Ready to supervise your AI coding agent fleet?
          </h2>

          <p class="mt-4 text-sm sm:text-base text-slate-400">
            Start free with GitHub OAuth in under 30 seconds. Seamlessly upgrade as your project and concurrent runner requirements grow.
          </p>

          <div class="mt-8 flex flex-wrap items-center justify-center gap-4">
            <template v-if="user">
              <a
                href="/tasks"
                class="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-400 via-teal-400 to-phantom-cyan px-8 py-4 text-sm font-black text-midnight-950 shadow-xl shadow-emerald-500/25 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
              >
                <span>Enter Workspace</span>
                <span>→</span>
              </a>
            </template>
            <template v-else>
              <a
                href="/auth/github"
                class="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-emerald-400 via-teal-400 to-phantom-cyan px-8 py-4 text-sm font-black text-midnight-950 shadow-xl shadow-emerald-500/25 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
              >
                <Icons name="Github" :size="18" />
                <span>Start Free with GitHub</span>
              </a>
            </template>

            <button
              type="button"
              @click="isContactModalOpen = true"
              class="rounded-2xl border border-midnight-700 bg-midnight-850 px-6 py-4 text-sm font-bold text-slate-300 hover:border-midnight-600 hover:text-white transition-all cursor-pointer"
            >
              Talk to Enterprise Sales
            </button>
          </div>
        </div>
      </section>
    </main>

    <!-- ENTERPRISE CONTACT SALES MODAL -->
    <div
      v-if="isContactModalOpen"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-midnight-950/80 backdrop-blur-md"
      @click.self="isContactModalOpen = false"
    >
      <div class="relative w-full max-w-lg rounded-3xl border border-midnight-700 bg-midnight-900 p-7 shadow-2xl shadow-midnight-950/80 animate-in fade-in zoom-in-95 duration-200">
        <!-- Modal Header -->
        <div class="flex items-center justify-between pb-4 border-b border-midnight-800">
          <div class="flex items-center gap-2.5">
            <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-phantom-purple/20 text-phantom-lavender border border-phantom-purple/30">
              <Icons name="Shield" :size="18" />
            </div>
            <div>
              <h3 class="text-lg font-bold text-white">Enterprise Capacity & Custom SLA</h3>
              <p class="text-xs text-slate-400">Dedicated appliances, custom MCP, and SAML SSO</p>
            </div>
          </div>
          <button
            type="button"
            @click="isContactModalOpen = false"
            class="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-midnight-800 transition-colors"
          >
            <Icons name="X" :size="18" />
          </button>
        </div>

        <!-- Success feedback -->
        <div v-if="contactSubmitted" class="py-10 text-center space-y-3">
          <div class="inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 text-2xl font-bold">
            ✓
          </div>
          <h4 class="text-lg font-bold text-white">Inquiry Received!</h4>
          <p class="text-xs text-slate-400 max-w-xs mx-auto">
            Our Enterprise solutions team will contact you within 4 business hours to discuss custom capacity and custom procurement agreements.
          </p>
        </div>

        <!-- Contact Form -->
        <form v-else @submit.prevent="submitContactForm" class="mt-5 space-y-4 text-xs">
          <div>
            <label class="block font-semibold text-slate-300 mb-1">Your Full Name</label>
            <input
              v-model="contactForm.name"
              type="text"
              required
              placeholder="e.g. Linus Torvalds"
              class="w-full rounded-xl border border-midnight-700 bg-midnight-950 px-3.5 py-2.5 text-white placeholder-slate-500 focus:border-phantom-cyan focus:outline-none"
            />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block font-semibold text-slate-300 mb-1">Work Email</label>
              <input
                v-model="contactForm.email"
                type="email"
                required
                placeholder="you@company.com"
                class="w-full rounded-xl border border-midnight-700 bg-midnight-950 px-3.5 py-2.5 text-white placeholder-slate-500 focus:border-phantom-cyan focus:outline-none"
              />
            </div>
            <div>
              <label class="block font-semibold text-slate-300 mb-1">Company / Organization</label>
              <input
                v-model="contactForm.company"
                type="text"
                required
                placeholder="e.g. Acme Corp"
                class="w-full rounded-xl border border-midnight-700 bg-midnight-950 px-3.5 py-2.5 text-white placeholder-slate-500 focus:border-phantom-cyan focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label class="block font-semibold text-slate-300 mb-1">Engineering Team Size</label>
            <select
              v-model="contactForm.teamSize"
              class="w-full rounded-xl border border-midnight-700 bg-midnight-950 px-3.5 py-2.5 text-white focus:border-phantom-cyan focus:outline-none"
            >
              <option value="10-25">10 – 25 Engineers</option>
              <option value="25-100">25 – 100 Engineers</option>
              <option value="100-500">100 – 500 Engineers</option>
              <option value="500+">500+ Engineers (Global Enterprise)</option>
            </select>
          </div>

          <div>
            <label class="block font-semibold text-slate-300 mb-1">Requirements / Custom Architecture Needs</label>
            <textarea
              v-model="contactForm.message"
              rows="3"
              placeholder="Tell us about your on-premise runner, SAML SSO, or custom MCP integration requirements..."
              class="w-full rounded-xl border border-midnight-700 bg-midnight-950 px-3.5 py-2.5 text-white placeholder-slate-500 focus:border-phantom-cyan focus:outline-none"
            ></textarea>
          </div>

          <div class="pt-2 flex items-center justify-between">
            <a
              href="mailto:sales@taskhub.dev?subject=Enterprise%20Plan%20Inquiry"
              class="text-slate-400 hover:text-slate-200 underline text-[11px]"
            >
              Or email sales@taskhub.dev directly
            </a>

            <button
              type="submit"
              class="rounded-xl bg-gradient-to-r from-phantom-purple to-phantom-neon px-5 py-2.5 text-xs font-bold text-white hover:opacity-90 active:scale-95 transition-all cursor-pointer"
            >
              Send Request →
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- FOOTER -->
    <footer class="border-t border-midnight-800/80 bg-midnight-950 px-6 py-12 text-xs text-slate-500">
      <div class="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-6">
        <div class="flex items-center gap-3">
          <img src="/brand/midnight-hub-mark.svg?v=20260829" alt="Midnight Hub" class="h-6 w-6 rounded-lg object-contain" />
          <span class="font-bold text-slate-300">Midnight Hub</span>
          <span>· Supervised AI Agent Execution Engine</span>
        </div>

        <div class="flex items-center gap-6 text-slate-400">
          <Link href="/" class="hover:text-white transition-colors">Overview</Link>
          <Link href="/tasks" class="hover:text-white transition-colors">Workspace</Link>
          <Link href="/projects" class="hover:text-white transition-colors">Projects</Link>
          <Link href="/desktop" class="hover:text-white transition-colors">Desktop</Link>
          <Link href="/pricing" class="hover:text-white transition-colors text-emerald-400 font-semibold">Pricing</Link>
          <a href="https://github.com/macatung/task-hub" target="_blank" rel="noopener noreferrer" class="hover:text-white transition-colors">GitHub</a>
        </div>

        <p>© 2026 Macatung Dev. Released under the MIT License.</p>
      </div>
    </footer>
  </div>
</template>

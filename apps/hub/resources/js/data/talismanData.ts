import type { TalismanPreset } from '../types/portfolio';

export const talismanPresets: TalismanPreset[] = [
  {
    id: 'bua-no-bug',
    title: 'ZERO BUG DIRECTIVE',
    runeTop: '// PROTOCOL: ZERO_BUG',
    codeSnippet: 'try { code(); } catch { /* NEVER FAILS */ }',
    meaning: 'Guarantees code integrity: 0 compile errors, 0 runtime warnings, 100% test pass rate!',
    colorScheme: 'yellow'
  },
  {
    id: 'bua-friday-deploy',
    title: 'FRIDAY DEPLOY DIRECTIVE',
    runeTop: '// PROTOCOL: FRIDAY_DEPLOY',
    codeSnippet: 'git push origin main --force-peace',
    meaning: 'Friday 5:00 PM production deployment runs flawlessly with zero outages and peaceful weekends!',
    colorScheme: 'crimson'
  },
  {
    id: 'bua-x2-salary',
    title: 'CAREER VELOCITY DIRECTIVE',
    runeTop: '// PROTOCOL: SALARY_BOOST',
    codeSnippet: 'developer.salary = developer.salary * 2;',
    meaning: 'Amplifies compensation negotiation leverage, high-impact career progression, and executive approvals!',
    colorScheme: 'purple'
  },
  {
    id: 'bua-no-conflict',
    title: 'ZERO CONFLICT REBASE',
    runeTop: '// PROTOCOL: ZERO_CONFLICT',
    codeSnippet: 'git rebase main --auto-resolve-peace',
    meaning: 'Silky smooth Git rebases with zero merge conflicts, seamless code reviews, and frictionless integration!',
    colorScheme: 'cyan'
  },
  {
    id: 'bua-fix-prod-12am',
    title: 'MIDNIGHT PROD RECOVERY',
    runeTop: '// PROTOCOL: MIDNIGHT_REVIVE',
    codeSnippet: 'if (isMidnight && prodDown) { revive(); }',
    meaning: 'Unlocks nocturnal flow state, pinpoints root cause within minutes, and restores mission-critical services!',
    colorScheme: 'yellow'
  },
  {
    id: 'bua-clean-code',
    title: 'CLEAN ARCHITECTURE DIRECTIVE',
    runeTop: '// PROTOCOL: CLEAN_CODE',
    codeSnippet: 'const perfection = KISS && DRY && SOLID;',
    meaning: 'Elegant, modular craftsmanship adhering to SOLID principles, high maintainability, and clean code standards!',
    colorScheme: 'cyan'
  }
];

import type { TalismanPreset } from '../types/portfolio';

export const talismanPresets: TalismanPreset[] = [
  {
    id: 'bua-no-bug',
    title: 'BÙA CODE 0 BUG',
    runeTop: '// PROTOCOL: ZERO_BUG',
    codeSnippet: 'try { code(); } catch { /* NEVER FAILS */ }',
    meaning: 'Bảo hộ toàn vẹn mã nguồn, compile 0 error, runtime 0 warning, test pass 100%!',
    colorScheme: 'yellow'
  },
  {
    id: 'bua-friday-deploy',
    title: 'BÙA DEPLOY THỨ 6',
    runeTop: '// PROTOCOL: FRIDAY_DEPLOY',
    codeSnippet: 'git push origin main --force-peace',
    meaning: 'Deploy production lúc 5h chiều thứ Sáu mà server vẫn bình yên, an tâm ngủ trọn cuối tuần!',
    colorScheme: 'crimson'
  },
  {
    id: 'bua-x2-salary',
    title: 'BÙA TĂNG LƯƠNG X2',
    runeTop: '// PROTOCOL: SALARY_BOOST',
    codeSnippet: 'developer.salary = developer.salary * 2;',
    meaning: 'Tăng cường phúc khí đàm phán, offer ngập tràn, thăng tiến thần tốc, sếp duyệt ngân sách ngay!',
    colorScheme: 'purple'
  },
  {
    id: 'bua-no-conflict',
    title: 'BÙA 0 CONFLICT',
    runeTop: '// PROTOCOL: ZERO_CONFLICT',
    codeSnippet: 'git rebase main --auto-resolve-peace',
    meaning: 'Git merge mượt như lụa, không một vết conflict, đồng nghiệp hòa thuận, team lead vỗ tay!',
    colorScheme: 'cyan'
  },
  {
    id: 'bua-fix-prod-12am',
    title: 'BÙA FIX PROD NỬA ĐÊM',
    runeTop: '// PROTOCOL: MIDNIGHT_REVIVE',
    codeSnippet: 'if (isMidnight && prodDown) { revive(); }',
    meaning: 'Kích hoạt linh cảm tối cao lúc 12 giờ đêm, tìm ra root cause trong 3 phút, cứu nguy hệ thống!',
    colorScheme: 'yellow'
  },
  {
    id: 'bua-clean-code',
    title: 'BÙA CLEAN ARCHITECTURE',
    runeTop: '// PROTOCOL: CLEAN_CODE',
    codeSnippet: 'const perfection = KISS && DRY && SOLID;',
    meaning: 'Code đẹp như tuyệt tác nghệ thuật, module hóa hoàn hảo, ai đọc cũng trầm trồ thán phục!',
    colorScheme: 'cyan'
  }
];

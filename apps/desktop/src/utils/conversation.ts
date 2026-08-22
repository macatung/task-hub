export type ConversationMode = 'discovery' | 'task' | 'docs';

export type InitialRequestContext = {
  mode: ConversationMode;
  note?: string;
  task?: { issueKey?: string; title?: string } | null;
  projectTitle?: string | null;
};

const clean = (value?: string) => value?.trim() || '';

export const buildInitialRequest = ({ mode, note, task, projectTitle }: InitialRequestContext): string => {
  const instruction = clean(note);
  if (mode === 'discovery') return instruction;
  if (mode === 'task') {
    const taskLabel = [task?.issueKey, task?.title].filter(Boolean).join(' · ') || 'task đã chọn';
    return [`Thực thi ${taskLabel}.`, instruction].filter(Boolean).join('\n\n');
  }
  const projectLabel = projectTitle || 'project đã chọn';
  return [`Quét repository và tạo/cập nhật bộ tài liệu chuẩn cho ${projectLabel}.`, instruction].filter(Boolean).join('\n\n');
};

export const normalizeConversationText = (value?: string) => clean(value).replace(/\s+/g, ' ').toLocaleLowerCase();

export const consumePendingUserEcho = (pending: string[], incoming?: string) => {
  const normalized = normalizeConversationText(incoming);
  const index = pending.indexOf(normalized);
  if (index < 0) return { duplicate: false, pending };
  return { duplicate: true, pending: pending.filter((_, itemIndex) => itemIndex !== index) };
};

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import {
  Sparkles,
  Wand2,
  FileText,
  Target,
  Mail,
  Check,
  Copy,
  X,
  Send,
  Plus,
} from 'lucide-vue-next';
import type { TaskItem } from '../../composables/useTaskSync';

interface MessageItem {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  checklistSuggestions?: string[];
  notesSuggestion?: string;
  timestamp: string;
}

const props = defineProps<{
  isOpen: boolean;
  task: TaskItem | null;
  initialAction?: 'breakdown' | 'summary' | 'draft' | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'apply-subtasks', subtasks: string[]): void;
  (e: 'apply-notes', notes: string): void;
}>();

const messages = ref<MessageItem[]>([
  {
    id: 'welcome',
    sender: 'assistant',
    text: 'Chào bạn! Tôi là Trợ lý AI của Task Hub. Tôi có thể giúp bạn chia nhỏ công việc thành các bước dễ làm, tóm tắt tiến độ hoặc viết email báo cáo nhanh chóng.',
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  },
]);

const userInput = ref('');
const isGenerating = ref(false);
const chatContainer = ref<HTMLElement | null>(null);

const scrollToBottom = async () => {
  await nextTick();
  if (chatContainer.value) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
  }
};

const triggerAction = (action: 'breakdown' | 'summary' | 'priority' | 'draft') => {
  if (!props.task) {
    messages.value.push({
      id: `msg-${Date.now()}`,
      sender: 'assistant',
      text: 'Vui lòng chọn một công việc cụ thể để tôi có thể hỗ trợ bạn chính xác nhất nhé!',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });
    void scrollToBottom();
    return;
  }

  isGenerating.value = true;
  const currentTask = props.task;

  let promptLabel = '';
  let responseText = '';
  let checklistItems: string[] | undefined;
  let notesDraft: string | undefined;

  if (action === 'breakdown') {
    promptLabel = `Chia nhỏ việc: "${currentTask.title}"`;
    checklistItems = generateBreakdownSteps(currentTask.title, currentTask.description);
    responseText = `Tôi đã phân tích công việc **"${currentTask.title}"** và đề xuất chia thành ${checklistItems.length} bước thực hiện cụ thể:

${checklistItems.map((step, i) => `${i + 1}. ${step}`).join('\n')}

Bạn có thể bấm nút **"Áp dụng vào checklist"** bên dưới để thêm trực tiếp vào công việc này nhé!`;
  } else if (action === 'summary') {
    promptLabel = `Tóm tắt việc: "${currentTask.title}"`;
    const priorityLabel = currentTask.priority === 'urgent' ? 'Khẩn cấp' : currentTask.priority === 'high' ? 'Cao' : 'Bình thường';
    const dueInfo = currentTask.due_date ? `Hạn chót: ${currentTask.due_date}` : 'Chưa đặt hạn';
    responseText = `**Tóm tắt công việc:**
- **Tiêu đề:** ${currentTask.title}
- **Mức độ ưu tiên:** ${priorityLabel}
- **Thời hạn:** ${dueInfo}
- **Ghi chú hiện có:** ${currentTask.description || 'Chưa có ghi chú chi tiết.'}

💡 **Gợi ý:** Hãy hoàn thành các bước quan trọng đầu tiên vào khung giờ buổi sáng để đạt hiệu suất cao nhất.`;
  } else if (action === 'priority') {
    promptLabel = `Đề xuất mức độ ưu tiên cho "${currentTask.title}"`;
    const isUrgent = currentTask.title.toLowerCase().includes('gấp') || currentTask.title.toLowerCase().includes('khẩn') || currentTask.due_date === new Date().toISOString().split('T')[0];
    const recPriority = isUrgent ? 'Khẩn cấp (Urgent)' : 'Ưu tiên Cao (High)';
    responseText = `**Đề xuất mức ưu tiên:** **${recPriority}**

📌 **Lý do:**
- Công việc: *${currentTask.title}*
- ${currentTask.due_date ? `Đã có hạn hoàn thành (${currentTask.due_date}), nên cần được xử lý sớm tránh trễ deadline.` : 'Nên đặt mục tiêu hoàn thành trong tuần này.'}
- Phù hợp phân bổ vào phiên làm việc tập trung (Pomodoro).`;
  } else if (action === 'draft') {
    promptLabel = `Soạn email báo cáo tiến độ: "${currentTask.title}"`;
    notesDraft = `Kính gửi Anh/Chị,

Em xin phép cập nhật tiến độ công việc "${currentTask.title}":
- Hiện trạng: Đang triển khai đúng kế hoạch.
- Các đầu việc đã và đang hoàn thành theo checklist.
- Dự kiến hoàn tất: ${currentTask.due_date || 'Theo đúng tiến độ đã thống nhất'}.

Nếu có thông tin bổ sung, em sẽ gửi cập nhật sớm nhất.
Trân trọng cảm ơn Anh/Chị!`;
    responseText = `Tôi đã soạn sẵn bản thảo email/báo cáo tiến độ cho bạn:

\`\`\`
${notesDraft}
\`\`\`

Bạn có thể sao chép nhanh hoặc bấm **"Lưu vào ghi chú"** bên dưới!`;
  }

  // Push user prompt and assistant response
  messages.value.push({
    id: `u-${Date.now()}`,
    sender: 'user',
    text: promptLabel,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  });

  setTimeout(() => {
    messages.value.push({
      id: `a-${Date.now()}`,
      sender: 'assistant',
      text: responseText,
      checklistSuggestions: checklistItems,
      notesSuggestion: notesDraft,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });
    isGenerating.value = false;
    void scrollToBottom();
  }, 400);
};

const sendMessage = () => {
  const q = userInput.value.trim();
  if (!q) return;

  messages.value.push({
    id: `u-${Date.now()}`,
    sender: 'user',
    text: q,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  });
  userInput.value = '';
  isGenerating.value = true;
  void scrollToBottom();

  setTimeout(() => {
    let reply = '';
    let checklist: string[] | undefined;
    const lower = q.toLowerCase();

    if (lower.includes('chia nhỏ') || lower.includes('bước') || lower.includes('checklist')) {
      checklist = generateBreakdownSteps(props.task ? props.task.title : q, null);
      reply = `Dưới đây là các bước gợi ý cho bạn:\n\n${checklist.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\nBạn có muốn thêm ngay vào danh sách việc cần làm không?`;
    } else if (lower.includes('email') || lower.includes('báo cáo') || lower.includes('soạn')) {
      reply = `Tôi đã chuẩn bị mẫu báo cáo ngắn gọn:\n\n"Chào anh/chị, xin gửi báo cáo cập nhật tiến độ công việc. Mọi hạng mục cơ bản đã sẵn sàng và đang hoàn thiện theo đúng lịch hẹn."`;
    } else {
      reply = `Cảm ơn bạn đã hỏi! Đối với "${q}", bạn nên bắt đầu bằng việc xác định mục tiêu rõ ràng, chia việc thành từng khối 25 phút tập trung và ghi nhận kết quả ngay khi xong. Cần tôi hỗ trợ thêm chi tiết nào không?`;
    }

    messages.value.push({
      id: `a-${Date.now()}`,
      sender: 'assistant',
      text: reply,
      checklistSuggestions: checklist,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });
    isGenerating.value = false;
    void scrollToBottom();
  }, 500);
};

// Heuristic step generator for non-tech Vietnamese office tasks
const generateBreakdownSteps = (title: string, _desc: string | null): string[] => {
  const t = title.toLowerCase();
  if (t.includes('báo cáo') || t.includes('report')) {
    return [
      'Thu thập số liệu và dữ liệu liên quan',
      'Lập dàn ý chính và biểu đồ tóm tắt',
      'Viết dự thảo nội dung báo cáo',
      'Rà soát lỗi chính tả và định dạng văn bản',
      'Gửi cấp trên/khách hàng duyệt và lưu trữ',
    ];
  }
  if (t.includes('họp') || t.includes('meeting')) {
    return [
      'Chuẩn bị chương trình họp (Agenda) và tài liệu',
      'Gửi thư mời và link họp cho các thành viên',
      'Ghi chép biên bản cuộc họp (Meeting Notes)',
      'Tổng hợp các đầu việc cần làm (Action Items) sau họp',
      'Gửi email tổng kết cho toàn đội ngũ',
    ];
  }
  if (t.includes('thiết kế') || t.includes('design') || t.includes('slide')) {
    return [
      'Nghiên cứu yêu cầu và phong cách mong muốn',
      'Lên phác thảo khung bố cục (wireframe/draft)',
      'Thiết kế chi tiết các màn hình hoặc trang trình chiếu',
      'Lấy phản hồi từ đồng nghiệp/khách hàng',
      'Xuất file hoàn thiện và bàn giao',
    ];
  }
  if (t.includes('gửi') || t.includes('liên hệ') || t.includes('khách hàng') || t.includes('email')) {
    return [
      'Tìm kiếm thông tin liên hệ và lịch sử trao đổi',
      'Soạn nội dung thông điệp ngắn gọn, rõ ý',
      'Kiểm tra file đính kèm trước khi bấm gửi',
      'Ghi nhận trạng thái phản hồi và lịch hẹn follow-up',
    ];
  }
  return [
    'Xác định rõ kết quả đầu ra cần đạt được',
    'Chuẩn bị tài liệu và công cụ cần thiết',
    'Thực hiện phần việc trọng tâm (tập trung 25-45 phút)',
    'Kiểm tra lại kết quả và ghi chú bàn giao',
  ];
};

watch(
  () => props.initialAction,
  (action) => {
    if (action) {
      triggerAction(action === 'summary' ? 'summary' : action === 'draft' ? 'draft' : 'breakdown');
    }
  },
  { immediate: true }
);

const copyToClipboard = (text: string) => {
  void navigator.clipboard.writeText(text);
};
</script>

<template>
  <transition
    enter-active-class="transform transition ease-in-out duration-250"
    enter-from-class="translate-x-full"
    enter-to-class="translate-x-0"
    leave-active-class="transform transition ease-in-out duration-200"
    leave-from-class="translate-x-0"
    leave-to-class="translate-x-full"
  >
    <div
      v-if="isOpen"
      class="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-[#0c0d12]/98 backdrop-blur-xl border-l border-[#232430] shadow-2xl flex flex-col text-zinc-100"
    >
      <!-- Top header -->
      <div class="px-5 py-4 border-b border-[#232430] flex items-center justify-between bg-[#14151c]/60">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white font-bold text-sm">
            <Sparkles class="w-4 h-4" />
          </div>
          <div>
            <div class="flex items-center gap-1.5 font-semibold text-sm text-zinc-100">
              Trợ lý AI Task Hub
              <span class="px-1.5 py-0.2 text-[10px] bg-indigo-500/15 text-indigo-300 font-medium rounded-full border border-indigo-500/30">Hỗ trợ nhanh</span>
            </div>
            <p class="text-xs text-zinc-400 truncate max-w-[220px]">
              {{ task ? `Đang xem: ${task.title}` : 'Sẵn sàng trợ giúp công việc' }}
            </p>
          </div>
        </div>

        <button
          @click="emit('close')"
          class="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#1c1d27] transition-colors cursor-pointer"
          title="Đóng trợ lý"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Quick Action Chips -->
      <div class="px-4 py-2.5 bg-[#090a0f] border-b border-[#232430] flex items-center gap-2 overflow-x-auto no-scrollbar text-xs">
        <button
          @click="triggerAction('breakdown')"
          class="px-2.5 py-1.5 rounded-lg bg-[#14151c] hover:bg-indigo-600/20 border border-[#232430] hover:border-indigo-500/40 text-zinc-300 hover:text-indigo-200 flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer"
        >
          <Wand2 class="w-3.5 h-3.5 text-indigo-400" />
          <span>Chia nhỏ việc</span>
        </button>
        <button
          @click="triggerAction('summary')"
          class="px-2.5 py-1.5 rounded-lg bg-[#14151c] hover:bg-sky-600/20 border border-[#232430] hover:border-sky-500/40 text-zinc-300 hover:text-sky-200 flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer"
        >
          <FileText class="w-3.5 h-3.5 text-sky-400" />
          <span>Tóm tắt</span>
        </button>
        <button
          @click="triggerAction('priority')"
          class="px-2.5 py-1.5 rounded-lg bg-[#14151c] hover:bg-amber-600/20 border border-[#232430] hover:border-amber-500/40 text-zinc-300 hover:text-amber-200 flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer"
        >
          <Target class="w-3.5 h-3.5 text-amber-400" />
          <span>Gợi ý ưu tiên</span>
        </button>
        <button
          @click="triggerAction('draft')"
          class="px-2.5 py-1.5 rounded-lg bg-[#14151c] hover:bg-purple-600/20 border border-[#232430] hover:border-purple-500/40 text-zinc-300 hover:text-purple-200 flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer"
        >
          <Mail class="w-3.5 h-3.5 text-purple-400" />
          <span>Soạn email</span>
        </button>
      </div>

      <!-- Messages container -->
      <div ref="chatContainer" class="flex-1 overflow-y-auto p-4 space-y-4 text-sm custom-scrollbar">
        <div
          v-for="msg in messages"
          :key="msg.id"
          class="flex flex-col"
          :class="msg.sender === 'user' ? 'items-end' : 'items-start'"
        >
          <div
            class="max-w-[85%] rounded-2xl p-3.5 leading-relaxed shadow-sm transition-all"
            :class="[
              msg.sender === 'user'
                ? 'bg-indigo-600 text-white rounded-tr-xs'
                : 'bg-[#14151c] border border-[#232430] text-zinc-200 rounded-tl-xs'
            ]"
          >
            <div class="whitespace-pre-line text-sm">{{ msg.text }}</div>

            <!-- Suggestion Action Buttons -->
            <div v-if="msg.checklistSuggestions && msg.checklistSuggestions.length" class="mt-3 pt-2.5 border-t border-[#232430] flex flex-wrap gap-2">
              <button
                @click="emit('apply-subtasks', msg.checklistSuggestions)"
                class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/25 transition-all cursor-pointer"
              >
                <Plus class="w-3.5 h-3.5" />
                <span>Áp dụng vào checklist</span>
              </button>
              <button
                @click="copyToClipboard(msg.checklistSuggestions.join('\n'))"
                class="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#18181b] hover:bg-[#27272a] border border-[#27272a] text-zinc-300 rounded-lg text-xs transition-colors cursor-pointer"
              >
                <Copy class="w-3 h-3" />
                <span>Sao chép</span>
              </button>
            </div>

            <div v-if="msg.notesSuggestion" class="mt-3 pt-2.5 border-t border-[#232430] flex flex-wrap gap-2">
              <button
                @click="emit('apply-notes', msg.notesSuggestion)"
                class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/25 transition-all cursor-pointer"
              >
                <Check class="w-3.5 h-3.5" />
                <span>Lưu vào ghi chú của việc</span>
              </button>
              <button
                @click="copyToClipboard(msg.notesSuggestion)"
                class="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#18181b] hover:bg-[#27272a] border border-[#27272a] text-zinc-300 rounded-lg text-xs transition-colors cursor-pointer"
              >
                <Copy class="w-3 h-3" />
                <span>Sao chép</span>
              </button>
            </div>
          </div>
          <span class="text-[10px] text-zinc-500 mt-1 px-1">{{ msg.timestamp }}</span>
        </div>

        <!-- Thinking indicator -->
        <div v-if="isGenerating" class="flex items-center gap-2 text-xs text-zinc-400 pl-2">
          <div class="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></div>
          <div class="w-2 h-2 rounded-full bg-violet-400 animate-pulse delay-100"></div>
          <div class="w-2 h-2 rounded-full bg-purple-400 animate-pulse delay-200"></div>
          <span>AI đang suy nghĩ...</span>
        </div>
      </div>

      <!-- Chat input -->
      <div class="p-3.5 border-t border-[#232430] bg-[#090a0f]">
        <form @submit.prevent="sendMessage" class="flex items-center gap-2">
          <input
            v-model="userInput"
            type="text"
            placeholder="Hỏi AI bất kỳ điều gì về công việc này..."
            class="flex-1 px-3.5 py-2.5 rounded-xl bg-[#14151c] border border-[#232430] text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-all"
          />
          <button
            type="submit"
            :disabled="!userInput.trim() || isGenerating"
            class="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
            title="Gửi"
          >
            <Send class="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>

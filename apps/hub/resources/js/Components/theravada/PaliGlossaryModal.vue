<script setup lang="ts">
import { ref, computed } from 'vue';
import { mindfulBell } from '@/audio/mindfulBellAudio';

export interface PaliTermItem {
  term: string;
  vietnamese: string;
  category: 'Cốt Lõi' | 'Thiền Định' | 'Tâm Lý' | 'Đạo Lộ' | 'Tam Tướng';
  definition: string;
  source?: string;
}

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const searchQuery = ref('');
const selectedCategory = ref<string>('all');

const paliGlossaryList: PaliTermItem[] = [
  { term: 'Anicca', vietnamese: 'Vô thường', category: 'Tam Tướng', definition: 'Tánh biến dịch, không bất biến, sinh diệt liên tục trong từng sát-na của mọi pháp hữu vi.' },
  { term: 'Dukkha', vietnamese: 'Khổ não / Bất toàn', category: 'Tam Tướng', definition: 'Sự bất toại nguyện, xung đột, không hoàn hảo vốn có của đời sống ngũ uẩn.' },
  { term: 'Anattā', vietnamese: 'Vô ngã', category: 'Tam Tướng', definition: 'Không có một linh hồn hay thực thể bất biến làm chủ thể vĩnh viễn (Không có Ta, Không phải của Ta).' },
  { term: 'Nibbāna', vietnamese: 'Niết-bàn', category: 'Cốt Lõi', definition: 'Sự dập tắt hoàn toàn ba ngọn lửa Tham, Sân, Si; cảnh giới tịch diệt tối thượng không còn tái sinh.' },
  { term: 'Sati', vietnamese: 'Chánh niệm', category: 'Thiền Định', definition: 'Sự ghi nhận tỉnh thức, biết rõ những gì đang xảy ra trong thân và tâm ở giây phút hiện tại.' },
  { term: 'Sampajañña', vietnamese: 'Tỉnh giác', category: 'Thiền Định', definition: 'Trí hiểu biết rõ ràng mục đích, lợi ích và sự thích hợp của từng hành động.' },
  { term: 'Samatha', vietnamese: 'Thiền Chỉ / Định', category: 'Thiền Định', definition: 'Phương pháp gom tâm an trú vào một đối tượng duy nhất (như hơi thở, đề mục kasina) để đạt các tầng Sơ thiền đến Tứ thiền.' },
  { term: 'Vipassanā', vietnamese: 'Thiền Quán / Minh Sát Tuệ', category: 'Thiền Định', definition: 'Phương pháp quán chiếu thấy rõ Tam Tướng (Vô thường, Khổ, Vô ngã) của Danh Sắc để phát triển tuệ giác giải thoát.' },
  { term: 'Paṭiccasamuppāda', vietnamese: 'Duyên Khởi', category: 'Cốt Lõi', definition: 'Quy luật tương sinh tương duyên của 12 nhân duyên: Vô minh, Hành, Thức, Danh Sắc, Lục Nhập, Xúc, Thọ, Ái, Thủ, Hữu, Sinh, Lão Tử.' },
  { term: 'Kamma', vietnamese: 'Nghiệp', category: 'Đạo Lộ', definition: 'Hành động có tác ý (Cetanā) qua Thân, Khẩu, Ý dẫn đến quả báo tương ứng trong hiện tại và vị lai.' },
  { term: 'Sīla', vietnamese: 'Giới hạnh', category: 'Đạo Lộ', definition: 'Nền tảng đạo đức thanh tịnh (Ngũ giới, Bát giới, Giới Tỳ-kheo) bảo vệ thân tâm khỏi các ác nghiệp.' },
  { term: 'Samādhi', vietnamese: 'Định tâm', category: 'Đạo Lộ', definition: 'Trạng thái tâm gom tụ, an tịnh, bất động trước các trần cảnh.' },
  { term: 'Paññā', vietnamese: 'Trí tuệ', category: 'Đạo Lộ', definition: 'Tuệ giác thấu suốt Tứ Thánh Đế và thực tướng của vạn pháp.' },
  { term: 'Mettā', vietnamese: 'Tâm Từ', category: 'Tâm Lý', definition: 'Tình thương yêu vô bờ bến mong cầu an lạc và hạnh phúc cho muôn loài chúng sinh.' },
  { term: 'Karuṇā', vietnamese: 'Tâm Bi', category: 'Tâm Lý', definition: 'Lòng trắc ẩn, xót thương muốn cứu vớt chúng sinh thoát khỏi đau khổ.' },
  { term: 'Muditā', vietnamese: 'Tâm Hỷ', category: 'Tâm Lý', definition: 'Niềm vui mừng hoan hỷ khi thấy người khác thành tựu hạnh phúc, không ganh ghét đố kỵ.' },
  { term: 'Upekkhā', vietnamese: 'Tâm Xả', category: 'Tâm Lý', definition: 'Sự bình thản, buông xả, tâm không nghiêng ngả trước 8 ngọn gió đời (được-mất, khen-chê, vinh-nhục, vui-khổ).' },
  { term: 'Cattāro Satipaṭṭhānā', vietnamese: 'Tứ Niệm Xứ', category: 'Thiền Định', definition: 'Bốn nền tảng thiết lập Chánh niệm: Quán Thân (Kāya), Quán Thọ (Vedanā), Quán Tâm (Citta), Quán Pháp (Dhamma).' },
  { term: 'Nīvaraṇa', vietnamese: 'Năm Triền Cái', category: 'Tâm Lý', definition: 'Năm chướng ngại che lấp tâm trí: Tham dục, Sân hận, Hôn trầm thụy miên, Trạo cử hối quá, Hoài nghi.' },
  { term: 'Khandha', vietnamese: 'Năm Uẩn', category: 'Tâm Lý', definition: 'Năm tập hợp cấu thành con người: Sắc uẩn (Rūpa), Thọ uẩn (Vedanā), Tưởng uẩn (Saññā), Hành uẩn (Saṅkhāra), Thức uẩn (Viññāṇa).' },
  { term: 'Magga-Phala', vietnamese: 'Đạo & Quả', category: 'Đạo Lộ', definition: 'Bốn tầng bậc giác ngộ Thánh nhân: Nhập Lưu (Sotāpanna), Nhất Lai (Sakadāgāmī), Bất Lai (Anāgāmī), A-la-hán (Arahant).' },
  { term: 'Bhāvanā', vietnamese: 'Tu tập / Thiền dưỡng', category: 'Đạo Lộ', definition: 'Sự rèn luyện, trau dồi và làm cho tâm trí ngày càng phát triển thanh cao.' },
];

const filteredTerms = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  return paliGlossaryList.filter(item => {
    const matchesQuery = !query ||
      item.term.toLowerCase().includes(query) ||
      item.vietnamese.toLowerCase().includes(query) ||
      item.definition.toLowerCase().includes(query);
    const matchesCat = selectedCategory.value === 'all' || item.category === selectedCategory.value;
    return matchesQuery && matchesCat;
  });
});

const handleClose = () => {
  emit('close');
};

const handleTermClick = () => {
  mindfulBell.strikeWoodenFish();
};
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 bg-stone-950/85 backdrop-blur-md animate-fade-in"
    @click.self="handleClose"
  >
    <div
      class="relative w-full max-w-3xl max-h-[92vh] sm:max-h-[85vh] flex flex-col rounded-2xl sm:rounded-3xl bg-stone-900 border border-amber-500/30 text-stone-100 shadow-2xl overflow-hidden font-sans"
      :style="{ boxShadow: '0 25px 60px -15px rgba(217, 119, 6, 0.25)' }"
    >
      <!-- Header -->
      <div class="flex items-center justify-between p-3.5 sm:p-6 border-b border-amber-500/20 bg-stone-950/70 gap-2">
        <div class="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <span class="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/30 text-lg sm:text-xl text-amber-400 shrink-0">
            ☸️
          </span>
          <div class="min-w-0">
            <h3 class="text-base sm:text-lg font-serif font-bold text-amber-200 tracking-tight truncate">
              Từ Điển Thuật Ngữ Pāḷi
            </h3>
            <p class="text-[10px] sm:text-xs text-stone-400 font-sans truncate">
              Tra cứu nhanh 20+ thuật ngữ Pāḷi cốt lõi trong Tam Tạng & Vipassanā
            </p>
          </div>
        </div>

        <button
          @click="handleClose"
          class="text-stone-400 hover:text-white p-2 rounded-xl hover:bg-stone-800 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer shrink-0"
          aria-label="Đóng"
        >
          ✕
        </button>
      </div>

      <!-- Search & Filters -->
      <div class="p-3 sm:p-5 border-b border-stone-800 bg-stone-900/90 flex flex-col sm:flex-row gap-2.5 sm:gap-3">
        <div class="relative flex-1">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Tìm theo thuật ngữ Pāḷi, tiếng Việt hoặc ý nghĩa..."
            class="w-full pl-9 pr-4 py-2.5 rounded-xl bg-stone-950/80 border border-stone-700 text-xs sm:text-sm text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
          />
          <span class="absolute left-3 top-2.5 text-stone-500 text-xs sm:text-sm">🔍</span>
        </div>

        <div class="flex flex-wrap gap-1 sm:gap-1.5">
          <button
            v-for="cat in ['all', 'Tam Tướng', 'Cốt Lõi', 'Thiền Định', 'Đạo Lộ', 'Tâm Lý']"
            :key="cat"
            @click="selectedCategory = cat"
            :class="[
              'px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-serif transition-colors min-h-[32px]',
              selectedCategory === cat
                ? 'bg-amber-500 text-stone-950 font-bold shadow-md'
                : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
            ]"
          >
            {{ cat === 'all' ? 'Tất Cả' : cat }}
          </button>
        </div>
      </div>

      <!-- Terms List Body -->
      <div class="flex-1 overflow-y-auto p-3.5 sm:p-6 space-y-2.5 sm:space-y-3 divide-y divide-stone-800/60">
        <div
          v-for="item in filteredTerms"
          :key="item.term"
          class="pt-2.5 sm:pt-3 first:pt-0 group cursor-pointer"
          @click="handleTermClick"
        >
          <div class="flex flex-wrap items-baseline justify-between gap-1.5 sm:gap-2 mb-1">
            <div class="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <h4 class="text-sm sm:text-base font-serif font-bold text-amber-300 group-hover:text-amber-200 transition-colors">
                {{ item.term }}
              </h4>
              <span class="text-xs sm:text-sm font-sans text-stone-300 font-medium italic">
                ({{ item.vietnamese }})
              </span>
            </div>
            <span class="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-sans font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {{ item.category }}
            </span>
          </div>
          <p class="text-xs sm:text-sm text-stone-300 font-sans leading-relaxed">
            {{ item.definition }}
          </p>
        </div>

        <div v-if="filteredTerms.length === 0" class="py-10 sm:py-12 text-center text-stone-500 font-serif text-xs sm:text-sm">
          Không tìm thấy thuật ngữ nào phù hợp với từ khóa "{{ searchQuery }}".
        </div>
      </div>

      <!-- Footer Info -->
      <div class="p-3 sm:p-4 bg-stone-950/80 border-t border-stone-800 text-[11px] sm:text-xs text-stone-400 flex items-center justify-between gap-2">
        <span class="italic truncate">☸️ "Pháp nhãn thanh tịnh, thấu rõ vạn pháp"</span>
        <button
          @click="handleClose"
          class="px-3.5 sm:px-4 py-1.5 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 text-xs font-serif font-bold transition-all shrink-0 cursor-pointer min-h-[36px]"
        >
          Đóng
        </button>
      </div>
    </div>
  </div>
</template>

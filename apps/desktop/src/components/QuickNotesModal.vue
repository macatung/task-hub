<script setup lang="ts">
import { ref, onMounted } from 'vue';

const emit = defineEmits<{
  (e: 'close'): void;
}>();

interface TodoItem {
  id: string;
  text: string;
  done: boolean;
}

const todos = ref<TodoItem[]>([]);
const newTodoText = ref('');
const scratchpad = ref('');

const loadData = () => {
  try {
    const savedTodos = localStorage.getItem('macatung_desktop_todos');
    if (savedTodos) todos.value = JSON.parse(savedTodos);
    else {
      todos.value = [
        { id: '1', text: 'Hoàn thành module quan trọng nhất hôm nay', done: false },
        { id: '2', text: 'Code review & dọn dẹp pull requests', done: false },
        { id: '3', text: 'Kiểm tra lại task đang chờ review', done: false },
      ];
    }

    const savedNotes = localStorage.getItem('macatung_desktop_scratchpad');
    if (savedNotes) scratchpad.value = savedNotes;
  } catch (e) {
    console.warn(e);
  }
};

const saveData = () => {
  try {
    localStorage.setItem('macatung_desktop_todos', JSON.stringify(todos.value));
    localStorage.setItem('macatung_desktop_scratchpad', scratchpad.value);
  } catch (e) {
    console.warn(e);
  }
};

const addTodo = () => {
  if (!newTodoText.value.trim()) return;
  todos.value.push({
    id: Date.now().toString(),
    text: newTodoText.value.trim(),
    done: false,
  });
  newTodoText.value = '';
  saveData();
};

const toggleTodo = (index: number) => {
  todos.value[index].done = !todos.value[index].done;
  saveData();
};

const removeTodo = (index: number) => {
  todos.value.splice(index, 1);
  saveData();
};

const onScratchpadChange = () => {
  saveData();
};

onMounted(() => {
  loadData();
});
</script>

<template>
  <div class="w-80 sm:w-96 rounded-3xl p-5 bg-slate-950/98 text-stone-100 border-2 border-emerald-500/80 shadow-[0_20px_50px_rgba(0,0,0,0.9)] backdrop-blur-2xl no-drag select-none text-left font-sans ring-1 ring-emerald-400/30">
    <!-- Header -->
    <div class="flex items-center justify-between pb-2.5 mb-3 border-b border-emerald-500/30">
      <div class="flex items-center gap-2 text-xs font-bold text-emerald-300">
        <span>📋</span>
        <span>TOP VIỆC CẦN LÀM & NHÁP NHANH</span>
      </div>
      <button
        @click="$emit('close')"
        class="text-stone-400 hover:text-white p-1 rounded-lg bg-slate-900 cursor-pointer text-xs"
      >
        ✕
      </button>
    </div>

    <!-- Add Task Input -->
    <div class="flex gap-1.5 mb-3">
      <input
        v-model="newTodoText"
        @keyup.enter="addTodo"
        type="text"
        placeholder="+ Thêm mục tiêu quan trọng..."
        class="flex-1 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 focus:border-emerald-400 text-xs text-white placeholder-slate-500 outline-none"
      />
      <button
        @click="addTodo"
        class="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs cursor-pointer"
      >
        Thêm
      </button>
    </div>

    <!-- Todo List -->
    <div class="space-y-1.5 max-h-36 overflow-y-auto mb-3 pr-1">
      <div
        v-for="(item, index) in todos"
        :key="item.id"
        class="flex items-center justify-between p-2 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 text-xs group"
      >
        <label class="flex items-center gap-2 cursor-pointer flex-1 select-none truncate">
          <input
            type="checkbox"
            :checked="item.done"
            @change="toggleTodo(index)"
            class="accent-emerald-500 w-3.5 h-3.5 cursor-pointer"
          />
          <span :class="{ 'line-through text-slate-500': item.done, 'text-slate-200': !item.done }" class="truncate">
            {{ item.text }}
          </span>
        </label>
        <button
          @click="removeTodo(index)"
          class="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 p-1 text-[10px] cursor-pointer transition-opacity"
          title="Xóa"
        >
          ✕
        </button>
      </div>
    </div>

    <!-- Quick Scratchpad -->
    <div class="pt-2 border-t border-slate-800">
      <label class="text-[10px] font-mono text-slate-400 block mb-1">📝 Sổ tay nháp ý tưởng nhanh:</label>
      <textarea
        v-model="scratchpad"
        @input="onScratchpadChange"
        rows="2"
        placeholder="Ghi nhanh ghi chú, link tài liệu hoặc lệnh terminal..."
        class="w-full p-2 rounded-xl bg-slate-900 border border-slate-800 focus:border-emerald-400 text-xs text-slate-200 placeholder-slate-600 outline-none resize-none font-mono"
      ></textarea>
    </div>
  </div>
</template>

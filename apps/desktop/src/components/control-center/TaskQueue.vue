<script setup lang="ts">
import { computed, ref } from "vue";
import type { ProjectItem, TaskItem } from "../../composables/useTaskSync";

const props = defineProps<{
  tasks: TaskItem[];
  projects: ProjectItem[];
  selectedId: number | null;
  loading: boolean;
  embedded?: boolean;
}>();

const emit = defineEmits<{
  select: [task: TaskItem];
  requirement: [];
  openHub: [];
}>();

const project = ref("all");
const status = ref("all");
const priority = ref("all");
const searchQuery = ref("");
const activeTab = ref<"active" | "team">("active");

const computeDependencyState = (task: TaskItem) => {
  const dependencies = task.dependencies || [];
  const targetFor = (
    dependency: NonNullable<TaskItem["dependencies"]>[number],
  ) =>
    props.tasks.find(
      (candidate) => candidate.id === dependency.depends_on_task_id,
    ) ||
    dependency.depends_on ||
    null;
  const pending = dependencies.filter((dependency) => {
    const target = targetFor(dependency);
    return !target || target.status !== 'done';
  });
  const dependents = props.tasks
    .filter((candidate) => candidate.id !== task.id)
    .filter((candidate) =>
      (candidate.dependencies || []).some(
        (dependency) => dependency.depends_on_task_id === task.id,
      ),
    )
    .map((candidate) => candidate.issue_key || `#${candidate.id}`);
  const reconsidered = task.status === "done" && pending.length > 0;
  const dependentReconsideration = props.tasks
    .filter(
      (candidate) => candidate.id !== task.id && candidate.status !== "todo",
    )
    .filter((candidate) =>
      (candidate.dependencies || []).some(
        (dependency) => dependency.depends_on_task_id === task.id,
      ),
    )
    .map((candidate) => candidate.issue_key || `#${candidate.id}`);
  return {
    total: dependencies.length,
    labels: dependencies.map(
      (dependency) =>
        targetFor(dependency)?.issue_key || `#${dependency.depends_on_task_id}`,
    ),
    pendingLabels: pending.map(
      (dependency) =>
        targetFor(dependency)?.issue_key || `#${dependency.depends_on_task_id}`,
    ),
    dependents,
    reconsidered,
    dependentReconsideration,
  };
};

const dependencyCache = computed(() => {
  const map = new Map<number, ReturnType<typeof computeDependencyState>>();
  for (const task of props.tasks) {
    map.set(task.id, computeDependencyState(task));
  }
  return map;
});

const dependencyState = (task: TaskItem) =>
  dependencyCache.value.get(task.id) || computeDependencyState(task);

const taskMeta = (task: TaskItem) => ({
  blocked: dependencyState(task).pendingLabels.length > 0,
  runnable: ["todo", "in_progress"].includes(task.status),
});

const filteredTasks = computed(() =>
  props.tasks.filter((task) => {
    const matchProject = project.value === "all" || String(task.project_id) === project.value;
    const matchStatus = status.value === "all" || task.status === status.value;
    const matchPriority = priority.value === "all" || task.priority === priority.value;
    const matchSearch = !searchQuery.value || 
      task.title.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      (task.issue_key && task.issue_key.toLowerCase().includes(searchQuery.value.toLowerCase())) ||
      (task.description && task.description.toLowerCase().includes(searchQuery.value.toLowerCase()));
    return matchProject && matchStatus && matchPriority && matchSearch;
  })
);

// 3 Phân nhóm trạng thái thông minh theo AgentsRoom
const needInputTasks = computed(() =>
  filteredTasks.value.filter(
    (task) =>
      task.status === "review" ||
      taskMeta(task).blocked ||
      dependencyState(task).reconsidered
  )
);

const activeTasks = computed(() =>
  filteredTasks.value.filter(
    (task) =>
      task.status === "in_progress" &&
      !taskMeta(task).blocked &&
      !dependencyState(task).reconsidered
  )
);

const viewedTasks = computed(() =>
  filteredTasks.value.filter(
    (task) =>
      !needInputTasks.value.some((t) => t.id === task.id) &&
      !activeTasks.value.some((t) => t.id === task.id)
  )
);

const childCount = (epicId: number) =>
  props.tasks.filter(
    (task) => task.epic_id === epicId && task.issue_type !== "epic",
  ).length;

const taskTypeLabel = (task: TaskItem) => {
  if (task.issue_type === "epic") return "EPIC";
  if (task.issue_type === "story") return "STORY";
  if (task.issue_type === "bug") return "BUG";
  return "TASK";
};

const taskTypeIcon = (task: TaskItem) => {
  if (task.issue_type === "epic") return "codicon-layers";
  if (task.issue_type === "story") return "codicon-bookmark";
  if (task.issue_type === "bug") return "codicon-bug";
  return "codicon-checklist";
};

const taskTypeBg = (task: TaskItem) => {
  if (task.issue_type === "epic") return "from-purple-600 to-indigo-700";
  if (task.issue_type === "story") return "from-emerald-600 to-teal-700";
  if (task.issue_type === "bug") return "from-rose-600 to-red-700";
  return "from-amber-600 to-orange-700";
};

const taskTypeBadge = (task: TaskItem) => {
  if (task.issue_type === "epic") return "bg-purple-950/60 border-purple-500/40 text-purple-300";
  if (task.issue_type === "story") return "bg-emerald-950/60 border-emerald-500/40 text-emerald-300";
  if (task.issue_type === "bug") return "bg-rose-950/60 border-rose-500/40 text-rose-300";
  return "bg-[#11182c] border-[#141b2d] text-zinc-400";
};

const priorityBadge = (task: TaskItem) => {
  if (task.priority === "urgent" || task.priority === "high") {
    return { label: "Ưu tiên cao", class: "bg-rose-950/60 border-rose-500/40 text-rose-300" };
  }
  if (task.priority === "medium") {
    return { label: "Trung bình", class: "bg-amber-950/60 border-amber-500/40 text-amber-300" };
  }
  return null;
};

const statusDotColor = (task: TaskItem) => {
  if (task.status === "in_progress") return "bg-[#00f5a0] ring-2 ring-emerald-500/40 animate-pulse";
  if (task.status === "review" || taskMeta(task).blocked) return "bg-[#f59e0b] ring-2 ring-amber-500/40";
  if (task.status === "done") return "bg-[#00f5d4]";
  return "bg-zinc-500";
};

const viewMode = ref<"tree" | "flat">("tree");
const expandedEpics = ref<Record<number, boolean>>({});

const isEpicExpanded = (epicId: number) => expandedEpics.value[epicId] !== false;

const toggleEpic = (epicId: number, e?: Event) => {
  if (e) e.stopPropagation();
  expandedEpics.value[epicId] = !isEpicExpanded(epicId);
};

interface EpicTreeGroup {
  epic: TaskItem;
  children: TaskItem[];
  completedCount: number;
  totalCount: number;
  progressPercent: number;
}

const epics = computed(() =>
  props.tasks.filter((t) => t.issue_type === "epic")
);

const epicGroups = computed((): EpicTreeGroup[] => {
  return epics.value
    .map((epic) => {
      const allChildren = props.tasks.filter(
        (t) => t.epic_id === epic.id && t.issue_type !== "epic"
      );
      const filteredChildren = filteredTasks.value.filter(
        (t) => t.epic_id === epic.id && t.issue_type !== "epic"
      );
      const completedCount = allChildren.filter((t) => t.status === "done").length;
      const totalCount = allChildren.length;
      const progressPercent =
        totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
      return {
        epic,
        children: filteredChildren,
        completedCount,
        totalCount,
        progressPercent,
      };
    })
    .filter((group) => {
      const epicMatches = filteredTasks.value.some((t) => t.id === group.epic.id);
      return epicMatches || group.children.length > 0;
    });
});

const standaloneTasks = computed(() => {
  const allEpicIds = new Set(epics.value.map((e) => e.id));
  return filteredTasks.value.filter(
    (t) => t.issue_type !== "epic" && (!t.epic_id || !allEpicIds.has(t.epic_id))
  );
});
</script>

<template>
  <aside class="cc-sidebar select-none bg-[#070b14] border-r border-[#141b2d]">
    <!-- Top Mini-Dock Navigation (AgentsRoom style) -->
    <div class="px-3 pt-3 pb-2 border-b border-[#141b2d]">
      <div class="flex items-center gap-2 rounded-2xl bg-[#0c1220] p-1.5 border border-[#141b2d]">
        <button class="grid h-8 w-8 place-items-center rounded-xl bg-[#11182c] text-zinc-300 hover:text-white transition shrink-0" title="Trang chủ">
          <i class="codicon codicon-home text-sm shrink-0"></i>
        </button>
        <button class="grid h-8 w-8 place-items-center rounded-xl bg-zinc-800 text-zinc-300 border border-zinc-700 hover:text-white transition shrink-0" title="Tác nhân đang chạy">
          <i class="codicon codicon-layers text-sm shrink-0"></i>
        </button>
        <button class="grid h-8 w-8 place-items-center rounded-xl bg-zinc-800 text-zinc-300 border border-zinc-700 hover:text-white transition shrink-0" title="Tính năng AI">
          <i class="codicon codicon-sparkle text-sm shrink-0"></i>
        </button>
        <button class="grid h-8 w-8 place-items-center rounded-xl border border-dashed border-zinc-600 text-zinc-400 hover:text-white hover:border-zinc-400 transition ml-auto shrink-0" title="Thêm mới" @click="emit('requirement')">
          <i class="codicon codicon-add text-sm shrink-0"></i>
        </button>
      </div>

      <!-- Project Filter Dropdown -->
      <div class="mt-2.5 flex items-center justify-between">
        <div class="flex items-center gap-1.5 rounded-lg px-1.5 py-1 bg-[#0c1220] border border-[#141b2d] w-full">
          <i class="codicon codicon-project text-xs text-zinc-400 shrink-0"></i>
          <select
            v-model="project"
            class="bg-transparent text-xs font-bold text-zinc-100 focus:outline-none w-full cursor-pointer truncate"
          >
            <option value="all" class="bg-[#070b14]">Tất cả dự án ({{ tasks.length }})</option>
            <option v-for="p in projects" :key="p.id" :value="String(p.id)" class="bg-[#070b14]">
              {{ p.title }} ({{ tasks.filter(t => t.project_id === p.id).length }})
            </option>
          </select>
        </div>
      </div>

      <!-- Filter Tabs & Tree/Flat View Switcher -->
      <div class="mt-2 flex items-center justify-between gap-1">
        <div class="flex items-center gap-1">
          <button 
            class="inline-flex items-center justify-center shrink-0 gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition"
            :class="status === 'all' ? 'bg-zinc-800 text-zinc-100 border border-zinc-700 shadow-sm' : 'text-zinc-400 hover:text-zinc-200'"
            @click="status = 'all'"
          >
            <span class="h-1.5 w-1.5 rounded-full bg-zinc-400 shrink-0"></span>
            <span class="leading-none">Tất cả ({{ filteredTasks.length }})</span>
          </button>
          <button 
            class="inline-flex items-center justify-center shrink-0 gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition"
            :class="status === 'in_progress' ? 'bg-zinc-800 text-amber-300 border border-amber-600/40 shadow-sm' : 'text-zinc-400 hover:text-zinc-200'"
            @click="status = status === 'in_progress' ? 'all' : 'in_progress'"
          >
            <span class="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0"></span>
            <span class="leading-none">Đang chạy</span>
          </button>
        </div>

        <!-- View Mode Switcher -->
        <div class="flex items-center bg-[#0c1220] border border-[#141b2d] rounded-lg p-0.5 shrink-0">
          <button
            class="px-2 py-0.5 rounded text-[10px] font-semibold transition inline-flex items-center justify-center gap-1 shrink-0"
            :class="viewMode === 'tree' ? 'bg-zinc-800 text-zinc-100 border border-zinc-700 shadow-xs' : 'text-zinc-400 hover:text-zinc-200'"
            title="Xem dạng cây phân cấp Epic"
            @click="viewMode = 'tree'"
          >
            <i class="codicon codicon-list-tree text-[11px] shrink-0"></i>
            <span class="leading-none">Cây</span>
          </button>
          <button
            class="px-2 py-0.5 rounded text-[10px] font-semibold transition inline-flex items-center justify-center gap-1 shrink-0"
            :class="viewMode === 'flat' ? 'bg-zinc-800 text-zinc-100 border border-zinc-700 shadow-xs' : 'text-zinc-400 hover:text-zinc-200'"
            title="Xem dạng danh sách phẳng"
            @click="viewMode = 'flat'"
          >
            <i class="codicon codicon-list-flat text-[11px] shrink-0"></i>
            <span class="leading-none">Phẳng</span>
          </button>
        </div>
      </div>

      <!-- Search Box -->
      <div class="mt-2 relative flex items-center">
        <i class="codicon codicon-search absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-500 shrink-0"></i>
        <input 
          v-model="searchQuery" 
          type="text" 
          placeholder="Tìm kiếm tác vụ / issue…"
          class="w-full rounded-xl bg-[#0c1220] border border-[#141b2d] pl-8 pr-7 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-600"
        />
        <i class="codicon codicon-sparkle absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-500 shrink-0"></i>
      </div>
    </div>

    <!-- Task List (Tree View by Default or Flat View) -->
    <!-- Tree View: Epic Hierarchy with nested Child tasks -->
    <div v-if="viewMode === 'tree'" class="min-h-0 flex-1 overflow-y-auto p-2.5 space-y-3">
      <!-- Empty state -->
      <div v-if="!epicGroups.length && !standaloneTasks.length" class="p-4 text-center text-xs text-zinc-500">
        <p>Chưa có tác vụ hoặc epic nào trong dự án này.</p>
        <div class="mt-3 flex justify-center gap-2">
          <button class="cc-button text-xs" @click="emit('requirement')">Yêu cầu mới</button>
          <button class="cc-button text-xs" @click="emit('openHub')">Mở Hub</button>
        </div>
      </div>

      <!-- Epic Groups (Tree hierarchy) -->
      <div v-if="epicGroups.length" class="space-y-3">
        <div class="mb-1.5 flex items-center justify-between px-1">
          <div class="flex items-center gap-1.5 text-[10px] font-bold tracking-wider uppercase text-purple-400">
            <span class="h-1.5 w-1.5 rounded-full bg-purple-500"></span>
            <span>CHUỖI EPIC ({{ epicGroups.length }})</span>
          </div>
        </div>

        <div v-for="group in epicGroups" :key="group.epic.id" class="rounded-2xl border border-purple-500/30 bg-[#0c1220] p-2 transition-all space-y-2">
          <!-- Epic Header Card -->
          <div
            class="group rounded-xl border p-2.5 text-left transition-all relative overflow-hidden cursor-pointer"
            :class="
              selectedId === group.epic.id
                ? 'border-purple-500/80 bg-[#16102a] shadow-[0_0_16px_rgba(157,78,221,0.25)]'
                : 'border-purple-500/20 bg-[#0e1424] hover:border-purple-500/50 hover:bg-[#141b2d]'
            "
            @click="emit('select', group.epic)"
          >
            <div class="flex items-start gap-2">
              <!-- Expand / Collapse chevron -->
              <button
                type="button"
                class="mt-1 inline-flex items-center justify-center shrink-0 h-5 w-5 rounded text-purple-400 hover:bg-purple-900/50 hover:text-purple-200 transition"
                :title="isEpicExpanded(group.epic.id) ? 'Thu gọn' : 'Mở rộng'"
                @click.stop="toggleEpic(group.epic.id, $event)"
              >
                <i
                  class="codicon text-xs transition-transform duration-200 shrink-0"
                  :class="isEpicExpanded(group.epic.id) ? 'codicon-chevron-down' : 'codicon-chevron-right'"
                ></i>
              </button>

              <!-- Epic Icon Avatar with Status Dot -->
              <div class="relative shrink-0 mt-0.5 flex items-center justify-center">
                <div
                  class="inline-flex items-center justify-center shrink-0 h-7 w-7 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-700 text-white shadow-sm ring-1 ring-white/10"
                  :title="taskTypeLabel(group.epic)"
                >
                  <i class="codicon text-xs shrink-0" :class="taskTypeIcon(group.epic)"></i>
                </div>
                <span class="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full shrink-0" :class="statusDotColor(group.epic)"></span>
              </div>

              <!-- Epic Info -->
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="font-mono text-[10px] font-bold text-purple-300">
                    {{ group.epic.issue_key || `#${group.epic.id}` }}
                  </span>
                  <span class="rounded-full px-1.5 py-0.2 text-[8px] font-black tracking-wider uppercase border bg-purple-950/60 border-purple-500/40 text-purple-300 inline-flex items-center justify-center shrink-0">
                    EPIC
                  </span>
                  <span
                    v-if="priorityBadge(group.epic)"
                    class="rounded-full px-1.5 py-0.2 text-[8px] font-bold border inline-flex items-center justify-center shrink-0"
                    :class="priorityBadge(group.epic)?.class"
                  >
                    {{ priorityBadge(group.epic)?.label }}
                  </span>
                  <span class="cc-task-secondary-meta text-[9px] font-semibold text-purple-300 ml-auto">
                    {{ group.totalCount }} task con
                  </span>
                </div>

                <!-- Epic Title -->
                <h3 class="text-xs font-bold text-zinc-100 group-hover:text-purple-300 transition line-clamp-2 mt-1 leading-snug font-['Space_Grotesk']">
                  {{ group.epic.title }}
                </h3>

                <!-- Progress Bar -->
                <div class="mt-2 space-y-1">
                  <div class="flex items-center justify-between text-[9px] text-purple-300/90 font-medium">
                    <span>Tiến độ: {{ group.completedCount }}/{{ group.totalCount }} hoàn tất</span>
                    <span class="font-bold text-purple-200 font-mono">{{ group.progressPercent }}%</span>
                  </div>
                  <div class="h-1.5 w-full rounded-full bg-[#04070d] border border-purple-900/40 overflow-hidden">
                    <div
                      class="h-full bg-gradient-to-r from-purple-500 to-[#00f5a0] transition-all duration-300"
                      :style="{ width: `${group.progressPercent}%` }"
                    ></div>
                  </div>
                </div>

                <!-- Dependency constraints notes -->
                <div v-if="dependencyState(group.epic).total" class="mt-1.5 pt-1 border-t border-[#141b2d] text-[9px] text-zinc-500">
                  <p>Depends on {{ dependencyState(group.epic).labels.join(", ") }}</p>
                  <p v-if="dependencyState(group.epic).pendingLabels.length" class="font-semibold text-amber-400">
                    Blocked by {{ dependencyState(group.epic).pendingLabels.join(", ") }}
                  </p>
                  <p v-else-if="!['todo', 'in_progress'].includes(group.epic.status)" class="font-semibold text-zinc-500">
                    {{ group.epic.status === "review" ? "Waiting for Hub review" : "Completed — reopen on Hub to run again" }}
                  </p>
                  <p v-if="dependencyState(group.epic).reconsidered" class="font-semibold text-rose-400">
                    Needs review: a prerequisite moved back from done
                  </p>
                </div>
                <div v-if="dependencyState(group.epic).dependents.length" class="mt-0.5 text-[9px] text-zinc-500">
                  <p>Unlocks {{ dependencyState(group.epic).dependents.join(", ") }}</p>
                  <p v-if="dependencyState(group.epic).dependentReconsideration.length" class="font-semibold text-rose-400">
                    Reconsider dependent work: {{ dependencyState(group.epic).dependentReconsideration.join(", ") }}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Child Tasks Sub-tree (Branches) -->
          <div
            v-if="isEpicExpanded(group.epic.id) && group.children.length"
            class="border-l-2 border-purple-500/30 ml-4 pl-3 space-y-1.5 mt-1"
          >
            <button
              v-for="task in group.children"
              :key="task.id"
              class="group w-full rounded-xl border p-2 text-left transition-all relative overflow-hidden"
              :class="
                selectedId === task.id
                  ? 'border-[#00f5a0]/80 bg-[#11182c] shadow-[0_0_16px_rgba(0,245,160,0.2)]'
                  : 'border-[#141b2d] bg-[#0c1220] hover:border-[#00f5a0]/40 hover:bg-[#11182c]'
              "
              @click="emit('select', task)"
            >
              <div class="flex items-start gap-2">
                <!-- Status indicator dot & icon -->
                <div class="relative shrink-0 mt-0.5 flex items-center justify-center">
                  <div
                    class="inline-flex items-center justify-center shrink-0 h-6 w-6 rounded-lg bg-gradient-to-tr text-white shadow-sm ring-1 ring-white/10 text-[10px]"
                    :class="taskTypeBg(task)"
                    :title="taskTypeLabel(task)"
                  >
                    <i class="codicon text-xs shrink-0" :class="taskTypeIcon(task)"></i>
                  </div>
                  <span class="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full shrink-0" :class="statusDotColor(task)"></span>
                </div>

                <!-- Info -->
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-1 flex-wrap">
                    <span class="font-mono text-[10px] font-bold text-[#00f5a0]">
                      {{ task.issue_key || `#${task.id}` }}
                    </span>
                    <span
                      class="rounded-full px-1.5 py-0.2 text-[8px] font-black tracking-wider uppercase border inline-flex items-center justify-center shrink-0"
                      :class="taskTypeBadge(task)"
                    >
                      {{ taskTypeLabel(task) }}
                    </span>
                    <span
                      v-if="priorityBadge(task)"
                      class="rounded-full px-1.5 py-0.2 text-[8px] font-bold border inline-flex items-center justify-center shrink-0"
                      :class="priorityBadge(task)?.class"
                    >
                      {{ priorityBadge(task)?.label }}
                    </span>
                    <span v-if="task.status === 'in_progress'" class="text-[9px] text-[#00f5a0] font-medium ml-auto animate-pulse">● Đang chạy</span>
                    <span v-else-if="task.status === 'done'" class="text-[9px] font-semibold text-[#00f5d4] ml-auto">Đã xong</span>
                  </div>

                  <h4 class="text-xs font-bold text-zinc-100 group-hover:text-[#00f5a0] transition line-clamp-2 mt-0.5 leading-snug">
                    {{ task.title }}
                  </h4>

                  <p v-if="task.description" class="truncate text-[10px] text-zinc-500 mt-0.5">
                    {{ task.description }}
                  </p>

                  <!-- Dependency constraints notes -->
                  <div v-if="dependencyState(task).total" class="mt-1 pt-1 border-t border-[#141b2d] text-[9px] text-zinc-500">
                    <p>Depends on {{ dependencyState(task).labels.join(", ") }}</p>
                    <p v-if="dependencyState(task).pendingLabels.length" class="font-semibold text-amber-400">
                      Blocked by {{ dependencyState(task).pendingLabels.join(", ") }}
                    </p>
                    <p v-else-if="!['todo', 'in_progress'].includes(task.status)" class="font-semibold text-zinc-500">
                      {{ task.status === "review" ? "Waiting for Hub review" : "Completed — reopen on Hub to run again" }}
                    </p>
                    <p v-if="dependencyState(task).reconsidered" class="font-semibold text-rose-400">
                      Needs review: a prerequisite moved back from done
                    </p>
                  </div>
                  <div v-if="dependencyState(task).dependents.length" class="mt-0.5 text-[9px] text-zinc-500">
                    <p>Unlocks {{ dependencyState(task).dependents.join(", ") }}</p>
                    <p v-if="dependencyState(task).dependentReconsideration.length" class="font-semibold text-rose-400">
                      Reconsider dependent work: {{ dependencyState(task).dependentReconsideration.join(", ") }}
                    </p>
                  </div>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>

      <!-- Standalone Tasks (Without Epic) -->
      <div v-if="standaloneTasks.length" class="space-y-2">
        <div class="mb-1.5 flex items-center justify-between px-1">
          <div class="flex items-center gap-1.5 text-[10px] font-bold tracking-wider uppercase text-zinc-400">
            <span class="h-1.5 w-1.5 rounded-full bg-zinc-500 shrink-0"></span>
            <span>TÁC VỤ ĐỘC LẬP ({{ standaloneTasks.length }})</span>
          </div>
        </div>

        <div class="space-y-1.5">
          <button
            v-for="task in standaloneTasks"
            :key="task.id"
            class="group w-full rounded-2xl border p-2.5 text-left transition-all relative overflow-hidden"
            :class="
              selectedId === task.id
                ? 'border-[#00f5a0]/80 bg-[#11182c] shadow-[0_0_16px_rgba(0,245,160,0.2)]'
                : 'border-[#141b2d] bg-[#0c1220] hover:border-[#00f5a0]/40 hover:bg-[#11182c]'
            "
            @click="emit('select', task)"
          >
            <div class="flex items-start gap-2.5">
              <div class="relative shrink-0 mt-0.5 flex items-center justify-center">
                <div
                  class="inline-flex items-center justify-center shrink-0 h-8 w-8 rounded-xl bg-gradient-to-tr text-white shadow-sm ring-1 ring-white/10"
                  :class="taskTypeBg(task)"
                  :title="taskTypeLabel(task)"
                >
                  <i class="codicon text-sm shrink-0" :class="taskTypeIcon(task)"></i>
                </div>
                <span class="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full shrink-0" :class="statusDotColor(task)"></span>
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="font-mono text-[10px] font-bold text-[#00f5a0]">
                    {{ task.issue_key || `#${task.id}` }}
                  </span>
                  <span
                    class="rounded-full px-1.5 py-0.2 text-[8px] font-black tracking-wider uppercase border inline-flex items-center justify-center shrink-0"
                    :class="taskTypeBadge(task)"
                  >
                    {{ taskTypeLabel(task) }}
                  </span>
                  <span
                    v-if="priorityBadge(task)"
                    class="rounded-full px-1.5 py-0.2 text-[8px] font-bold border inline-flex items-center justify-center shrink-0"
                    :class="priorityBadge(task)?.class"
                  >
                    {{ priorityBadge(task)?.label }}
                  </span>
                  <span v-if="task.status === 'in_progress'" class="text-[9px] text-[#00f5a0] font-medium ml-auto animate-pulse">● Đang chạy</span>
                  <span v-else-if="task.status === 'done'" class="text-[9px] font-semibold text-[#00f5d4] ml-auto">Đã xong</span>
                </div>

                <h3 class="text-xs font-bold text-zinc-100 group-hover:text-[#00f5a0] transition line-clamp-2 mt-1 leading-snug">
                  {{ task.title }}
                </h3>

                <p v-if="task.description" class="truncate text-[10px] text-zinc-500 mt-0.5">
                  {{ task.description }}
                </p>

                <!-- Dependency constraints notes -->
                <div v-if="dependencyState(task).total" class="mt-1.5 pt-1 border-t border-[#141b2d] text-[9px] text-zinc-500">
                  <p>Depends on {{ dependencyState(task).labels.join(", ") }}</p>
                  <p v-if="dependencyState(task).pendingLabels.length" class="font-semibold text-amber-400">
                    Blocked by {{ dependencyState(task).pendingLabels.join(", ") }}
                  </p>
                  <p v-else-if="!['todo', 'in_progress'].includes(task.status)" class="font-semibold text-zinc-500">
                    {{ task.status === "review" ? "Waiting for Hub review" : "Completed — reopen on Hub to run again" }}
                  </p>
                  <p v-if="dependencyState(task).reconsidered" class="font-semibold text-rose-400">
                    Needs review: a prerequisite moved back from done
                  </p>
                </div>
                <div v-if="dependencyState(task).dependents.length" class="mt-0.5 text-[9px] text-zinc-500">
                  <p>Unlocks {{ dependencyState(task).dependents.join(", ") }}</p>
                  <p v-if="dependencyState(task).dependentReconsideration.length" class="font-semibold text-rose-400">
                    Reconsider dependent work: {{ dependencyState(task).dependentReconsideration.join(", ") }}
                  </p>
                </div>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>

    <!-- Flat List (Categorized in 3 Sections: CẦN XỬ LÝ, ĐANG THỰC HIỆN, TẤT CẢ TÁC VỤ) -->
    <div v-else class="min-h-0 flex-1 overflow-y-auto p-2.5 space-y-3">
      <!-- Section 1: CẦN XỬ LÝ (Need Action / Review / Blocked) -->
      <div v-if="needInputTasks.length">
        <div class="mb-1.5 flex items-center justify-between px-1">
          <div class="flex items-center gap-1.5 text-[10px] font-bold tracking-wider uppercase text-amber-500">
            <span class="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0"></span>
            <span>CẦN XỬ LÝ ({{ needInputTasks.length }})</span>
          </div>
        </div>

        <div class="space-y-1.5">
          <button
            v-for="task in needInputTasks"
            :key="task.id"
            class="group w-full rounded-2xl border p-2.5 text-left transition-all relative overflow-hidden"
            :class="
              selectedId === task.id
                ? 'border-[#00f5a0]/80 bg-[#11182c] shadow-[0_0_16px_rgba(0,245,160,0.2)]'
                : 'border-[#141b2d] bg-[#0c1220] hover:border-[#00f5a0]/40 hover:bg-[#11182c]'
            "
            @click="emit('select', task)"
          >
            <div class="flex items-start gap-2.5">
              <!-- Task Type Icon Avatar with Status Dot -->
              <div class="relative shrink-0 mt-0.5 flex items-center justify-center">
                <div
                  class="inline-flex items-center justify-center shrink-0 h-8 w-8 rounded-xl bg-gradient-to-tr text-white shadow-sm ring-1 ring-white/10"
                  :class="taskTypeBg(task)"
                  :title="taskTypeLabel(task)"
                >
                  <i class="codicon text-sm shrink-0" :class="taskTypeIcon(task)"></i>
                </div>
                <span class="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full shrink-0" :class="statusDotColor(task)"></span>
              </div>

              <!-- Info -->
              <div class="min-w-0 flex-1">
                <!-- Top Row: Issue Key + Type Badge + Priority Badge + Epic Child Count -->
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="font-mono text-[10px] font-bold text-[#00f5a0]">
                    {{ task.issue_key || `#${task.id}` }}
                  </span>
                  <span
                    class="rounded-full px-1.5 py-0.2 text-[8px] font-black tracking-wider uppercase border inline-flex items-center justify-center shrink-0"
                    :class="taskTypeBadge(task)"
                  >
                    {{ taskTypeLabel(task) }}
                  </span>
                  <span
                    v-if="priorityBadge(task)"
                    class="rounded-full px-1.5 py-0.2 text-[8px] font-bold border inline-flex items-center justify-center shrink-0"
                    :class="priorityBadge(task)?.class"
                  >
                    {{ priorityBadge(task)?.label }}
                  </span>
                  <span
                    v-if="task.issue_type === 'epic'"
                    class="cc-task-secondary-meta text-[9px] font-semibold text-purple-400 ml-auto"
                  >
                    {{ childCount(task.id) }} task con
                  </span>
                </div>

                <!-- Task Title (Primary) -->
                <h3 class="text-xs font-bold text-zinc-100 group-hover:text-[#00f5a0] transition line-clamp-2 mt-1 leading-snug">
                  {{ task.title }}
                </h3>

                <!-- Description snippet if available -->
                <p v-if="task.description" class="truncate text-[10px] text-zinc-500 mt-0.5">
                  {{ task.description }}
                </p>

                <!-- Dependency constraints notes (Required by test suite) -->
                <div v-if="dependencyState(task).total" class="mt-1.5 pt-1 border-t border-[#141b2d] text-[9px] text-zinc-500">
                  <p>Depends on {{ dependencyState(task).labels.join(", ") }}</p>
                  <p v-if="dependencyState(task).pendingLabels.length" class="font-semibold text-amber-400">
                    Blocked by {{ dependencyState(task).pendingLabels.join(", ") }}
                  </p>
                  <p v-else-if="!['todo', 'in_progress'].includes(task.status)" class="font-semibold text-zinc-500">
                    {{ task.status === "review" ? "Waiting for Hub review" : "Completed — reopen on Hub to run again" }}
                  </p>
                  <p v-if="dependencyState(task).reconsidered" class="font-semibold text-rose-400">
                    Needs review: a prerequisite moved back from done
                  </p>
                </div>
                <div v-if="dependencyState(task).dependents.length" class="mt-0.5 text-[9px] text-zinc-500">
                  <p>Unlocks {{ dependencyState(task).dependents.join(", ") }}</p>
                  <p v-if="dependencyState(task).dependentReconsideration.length" class="font-semibold text-rose-400">
                    Reconsider dependent work: {{ dependencyState(task).dependentReconsideration.join(", ") }}
                  </p>
                </div>
              </div>
            </div>
          </button>
        </div>
      </div>

      <!-- Section 2: ĐANG THỰC HIỆN (Active / Running) -->
      <div v-if="activeTasks.length">
        <div class="mb-1.5 flex items-center justify-between px-1">
          <div class="flex items-center gap-1.5 text-[10px] font-bold tracking-wider uppercase text-emerald-400">
            <span class="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
            <span>ĐANG THỰC HIỆN ({{ activeTasks.length }})</span>
          </div>
        </div>

        <div class="space-y-1.5">
          <button
            v-for="task in activeTasks"
            :key="task.id"
            class="group w-full rounded-2xl border p-2.5 text-left transition-all relative overflow-hidden"
            :class="
              selectedId === task.id
                ? 'border-[#00f5a0]/80 bg-[#11182c] shadow-[0_0_16px_rgba(0,245,160,0.2)]'
                : 'border-[#141b2d] bg-[#0c1220] hover:border-[#00f5a0]/40 hover:bg-[#11182c]'
            "
            @click="emit('select', task)"
          >
            <div class="flex items-start gap-2.5">
              <div class="relative shrink-0 mt-0.5 flex items-center justify-center">
                <div
                  class="inline-flex items-center justify-center shrink-0 h-8 w-8 rounded-xl bg-gradient-to-tr text-white shadow-sm ring-1 ring-white/10"
                  :class="taskTypeBg(task)"
                  :title="taskTypeLabel(task)"
                >
                  <i class="codicon text-sm shrink-0" :class="taskTypeIcon(task)"></i>
                </div>
                <span class="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full shrink-0" :class="statusDotColor(task)"></span>
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="font-mono text-[10px] font-bold text-[#00f5a0]">
                    {{ task.issue_key || `#${task.id}` }}
                  </span>
                  <span
                    class="rounded-full px-1.5 py-0.2 text-[8px] font-black tracking-wider uppercase border inline-flex items-center justify-center shrink-0"
                    :class="taskTypeBadge(task)"
                  >
                    {{ taskTypeLabel(task) }}
                  </span>
                  <span
                    v-if="priorityBadge(task)"
                    class="rounded-full px-1.5 py-0.2 text-[8px] font-bold border inline-flex items-center justify-center shrink-0"
                    :class="priorityBadge(task)?.class"
                  >
                    {{ priorityBadge(task)?.label }}
                  </span>
                  <span class="text-[9px] text-[#00f5a0] font-medium ml-auto animate-pulse">● Đang chạy</span>
                </div>

                <h3 class="text-xs font-bold text-zinc-100 group-hover:text-[#00f5a0] transition line-clamp-2 mt-1 leading-snug">
                  {{ task.title }}
                </h3>

                <p v-if="task.description" class="truncate text-[10px] text-zinc-500 mt-0.5">
                  {{ task.description }}
                </p>
              </div>
            </div>
          </button>
        </div>
      </div>

      <!-- Section 3: TẤT CẢ TÁC VỤ (All / Done / Todo) -->
      <div>
        <div class="mb-1.5 flex items-center justify-between px-1">
          <div class="flex items-center gap-1.5 text-[10px] font-bold tracking-wider uppercase text-zinc-500">
            <span class="h-1.5 w-1.5 rounded-full bg-zinc-600 shrink-0"></span>
            <span>TẤT CẢ TÁC VỤ ({{ viewedTasks.length }})</span>
          </div>
        </div>

        <div v-if="!viewedTasks.length && !needInputTasks.length && !activeTasks.length" class="p-4 text-center text-xs text-zinc-500">
          <p>Chưa có tác vụ hoặc epic nào trong dự án này.</p>
          <div class="mt-3 flex justify-center gap-2">
            <button class="cc-button text-xs" @click="emit('requirement')">Yêu cầu mới</button>
            <button class="cc-button text-xs" @click="emit('openHub')">Mở Hub</button>
          </div>
        </div>

        <div class="space-y-1.5">
          <button
            v-for="task in viewedTasks"
            :key="task.id"
            class="group w-full rounded-2xl border p-2.5 text-left transition-all relative overflow-hidden"
            :class="
              selectedId === task.id
                ? 'border-[#00f5a0]/80 bg-[#11182c] shadow-[0_0_16px_rgba(0,245,160,0.2)]'
                : 'border-[#141b2d] bg-[#0c1220] hover:border-[#00f5a0]/40 hover:bg-[#11182c]'
            "
            @click="emit('select', task)"
          >
            <div class="flex items-start gap-2.5">
              <div class="relative shrink-0 mt-0.5 flex items-center justify-center">
                <div
                  class="inline-flex items-center justify-center shrink-0 h-8 w-8 rounded-xl bg-gradient-to-tr text-white shadow-sm ring-1 ring-white/10"
                  :class="taskTypeBg(task)"
                  :title="taskTypeLabel(task)"
                >
                  <i class="codicon text-sm shrink-0" :class="taskTypeIcon(task)"></i>
                </div>
                <span class="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full shrink-0" :class="statusDotColor(task)"></span>
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="font-mono text-[10px] font-bold text-[#00f5a0]">
                    {{ task.issue_key || `#${task.id}` }}
                  </span>
                  <span
                    class="rounded-full px-1.5 py-0.2 text-[8px] font-black tracking-wider uppercase border inline-flex items-center justify-center shrink-0"
                    :class="taskTypeBadge(task)"
                  >
                    {{ taskTypeLabel(task) }}
                  </span>
                  <span
                    v-if="priorityBadge(task)"
                    class="rounded-full px-1.5 py-0.2 text-[8px] font-bold border inline-flex items-center justify-center shrink-0"
                    :class="priorityBadge(task)?.class"
                  >
                    {{ priorityBadge(task)?.label }}
                  </span>
                  <span v-if="task.issue_type === 'epic'" class="text-[9px] font-semibold text-purple-400 ml-auto">
                    {{ childCount(task.id) }} task con
                  </span>
                  <span v-else-if="task.status === 'done'" class="text-[9px] font-semibold text-[#00f5d4] ml-auto">
                    Đã xong
                  </span>
                </div>

                <h3 class="text-xs font-bold text-zinc-100 group-hover:text-[#00f5a0] transition line-clamp-2 mt-1 leading-snug">
                  {{ task.title }}
                </h3>

                <p v-if="task.description" class="truncate text-[10px] text-zinc-500 mt-0.5">
                  {{ task.description }}
                </p>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>

    <!-- Bottom Dock: TẠO YÊU CẦU, CẦN LÀM, KIẾN THỨC -->
    <div class="border-t border-[#141b2d] p-2 bg-[#070b14]">
      <div class="grid grid-cols-3 gap-1">
        <!-- Cần làm (Todo) -->
        <button 
          class="flex flex-col items-center justify-center rounded-xl p-1.5 hover:bg-[#0c1220] transition text-zinc-400 hover:text-zinc-200"
          :title="`Có ${tasks.filter(t => t.status === 'todo').length} việc cần làm`"
          @click="status = status === 'todo' ? 'all' : 'todo'"
        >
          <div class="relative flex items-center justify-center">
            <i class="codicon codicon-checklist text-sm shrink-0"></i>
            <span class="absolute -top-1.5 -right-2 inline-flex items-center justify-center shrink-0 h-3.5 min-w-3.5 rounded-full bg-zinc-800 border border-zinc-700 px-1 text-[8px] font-bold text-zinc-200 font-mono">
              {{ tasks.filter(t => t.status === 'todo').length }}
            </span>
          </div>
          <span class="text-[9px] font-semibold tracking-wider mt-1 text-zinc-400">CẦN LÀM</span>
        </button>

        <!-- Tạo Backlog (Requirement) -->
        <button 
          class="flex flex-col items-center justify-center rounded-xl p-1.5 hover:bg-[#0c1220] transition text-zinc-400 hover:text-zinc-200"
          title="Mở trình soạn thảo yêu cầu bằng AI"
          @click="emit('requirement')"
        >
          <div class="relative flex items-center justify-center">
            <i class="codicon codicon-sparkle text-sm shrink-0"></i>
            <span class="absolute -top-1.5 -right-2 inline-flex items-center justify-center shrink-0 h-3.5 min-w-3.5 rounded-full bg-zinc-800 border border-zinc-700 px-1 text-[8px] font-bold text-zinc-200 font-mono">
              AI
            </span>
          </div>
          <span class="text-[9px] font-semibold tracking-wider mt-1 text-zinc-400">YÊU CẦU</span>
        </button>

        <!-- Web Hub -->
        <button 
          class="flex flex-col items-center justify-center rounded-xl p-1.5 hover:bg-[#0c1220] transition text-zinc-400 hover:text-zinc-200"
          title="Mở Task Hub trên trình duyệt"
          @click="emit('openHub')"
        >
          <div class="relative flex items-center justify-center">
            <i class="codicon codicon-globe text-sm shrink-0"></i>
            <span class="absolute -top-1.5 -right-2 inline-flex items-center justify-center shrink-0 h-3.5 min-w-3.5 rounded-full bg-zinc-800 border border-zinc-700 px-1 text-[8px] font-bold text-zinc-200 font-mono">
              {{ projects.length }}
            </span>
          </div>
          <span class="text-[9px] font-semibold tracking-wider mt-1 text-zinc-400">WEB HUB</span>
        </button>
      </div>
    </div>
  </aside>
</template>

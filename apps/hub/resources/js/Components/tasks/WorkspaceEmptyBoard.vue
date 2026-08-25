<script setup lang="ts">
import Icons from '@/Components/ui/Icons.vue';

defineProps<{ dark?: boolean; hasProject?: boolean }>();
const emit = defineEmits<{ createTask: []; planWithAi: [] }>();
</script>

<template>
  <section :class="['workspace-empty-board', dark ? 'workspace-empty-board--dark' : 'workspace-empty-board--light']">
    <div class="workspace-empty-board__hero">
      <div class="workspace-empty-board__icon"><Icons name="Layers" :size="24" /></div>
      <p class="workspace-empty-board__eyebrow">Ready when you are</p>
      <h2>{{ hasProject ? 'Turn your project into a delivery plan' : 'Create your first delivery workspace' }}</h2>
      <p>{{ hasProject ? 'Add a focused task, attach the context, then dispatch it to the right agent.' : 'Add a project to organize its work, evidence, releases, and agent runs in one place.' }}</p>
      <div class="workspace-empty-board__actions">
        <button type="button" class="workspace-empty-board__primary" @click="emit('createTask')">
          <Icons name="CheckSquare" :size="16" /> Create a task
        </button>
        <button type="button" class="workspace-empty-board__secondary" @click="emit('planWithAi')">
          <Icons name="Sparkles" :size="16" /> Plan with AI
        </button>
      </div>
    </div>
    <ol class="workspace-empty-board__steps" aria-label="Recommended delivery workflow">
      <li><span>01</span><div><strong>Define the outcome</strong><small>Capture a concise task and acceptance criteria.</small></div></li>
      <li><span>02</span><div><strong>Add working context</strong><small>Attach docs, code references, and delivery constraints.</small></div></li>
      <li><span>03</span><div><strong>Dispatch with evidence</strong><small>Review agent results, checks, and handoff before merge.</small></div></li>
    </ol>
  </section>
</template>

export type DiscoveryTask = {
  ref: string;
  title: string;
  story_points: number;
  acceptance_criteria: string[];
  depends_on: string[];
};

export type DiscoveryStory = {
  title: string;
  story_points: number;
  acceptance_criteria: string[];
  tasks: DiscoveryTask[];
};

export type DiscoveryPlan = {
  summary: string;
  assumptions: string[];
  affected_docs: string[];
  architecture_notes: string[];
  risks: string[];
  epic: { title: string; description?: string };
  stories: DiscoveryStory[];
};

export type DiscoveryPlanParseResult = {
  plan: DiscoveryPlan | null;
  errors: string[];
  source: 'agent_message' | 'raw_output' | 'none';
};

const FIBONACCI_POINTS = new Set([1, 2, 3, 5, 8]);
const marker = /<task-hub-discovery-plan>\s*([\s\S]*?)\s*<\/task-hub-discovery-plan>/gi;

const stringList = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : [];

const toTask = (value: any): DiscoveryTask => ({
  ref: typeof value?.ref === 'string' ? value.ref.trim() : '',
  title: typeof value?.title === 'string' ? value.title.trim() : '',
  story_points: Number(value?.story_points),
  acceptance_criteria: stringList(value?.acceptance_criteria),
  depends_on: stringList(value?.depends_on),
});

const toStory = (value: any): DiscoveryStory => ({
  title: typeof value?.title === 'string' ? value.title.trim() : '',
  story_points: Number(value?.story_points),
  acceptance_criteria: stringList(value?.acceptance_criteria),
  tasks: Array.isArray(value?.tasks) ? value.tasks.map(toTask) : [],
});

const toPlan = (value: any): DiscoveryPlan => ({
  summary: typeof value?.summary === 'string' ? value.summary.trim() : '',
  assumptions: stringList(value?.assumptions),
  affected_docs: stringList(value?.affected_docs),
  architecture_notes: stringList(value?.architecture_notes),
  risks: stringList(value?.risks),
  epic: {
    title: typeof value?.epic?.title === 'string' ? value.epic.title.trim() : '',
    description: typeof value?.epic?.description === 'string' ? value.epic.description.trim() : undefined,
  },
  stories: Array.isArray(value?.stories) ? value.stories.map(toStory) : [],
});

export const validateDiscoveryPlan = (plan: DiscoveryPlan): string[] => {
  const errors: string[] = [];
  if (!plan.summary) errors.push('Plan summary is missing.');
  if (!plan.epic.title) errors.push('Epic is missing.');
  if (!plan.stories.length) errors.push('Plan requires at least one User Story.');

  const refs = new Set<string>();
  const dependencies: Array<{ ref: string; dependsOn: string }> = [];
  plan.stories.forEach((story, storyIndex) => {
    if (!story.title) errors.push(`User Story ${storyIndex + 1} is missing a title.`);
    if (!FIBONACCI_POINTS.has(story.story_points)) errors.push(`User Story “${story.title || storyIndex + 1}” requires Fibonacci story points (1, 2, 3, 5, 8).`);
    if (!story.acceptance_criteria.length) errors.push(`User Story “${story.title || storyIndex + 1}” is missing acceptance criteria.`);
    if (!story.tasks.length) errors.push(`User Story “${story.title || storyIndex + 1}” has no implementation tasks.`);
    story.tasks.forEach((task, taskIndex) => {
      const label = task.title || `Task ${taskIndex + 1}`;
      if (!task.ref) errors.push(`${label} is missing a unique ref.`);
      else if (refs.has(task.ref)) errors.push(`Task ref “${task.ref}” is duplicated.`);
      else refs.add(task.ref);
      if (!task.title) errors.push(`Task ${task.ref || taskIndex + 1} is missing a title.`);
      if (!FIBONACCI_POINTS.has(task.story_points)) errors.push(`${label} requires Fibonacci story points (1, 2, 3, 5, 8).`);
      if (task.story_points > 8) errors.push(`${label} exceeds 8 story points and must be decomposed.`);
      if (!task.acceptance_criteria.length) errors.push(`${label} is missing acceptance criteria.`);
      task.depends_on.forEach((dependsOn) => dependencies.push({ ref: task.ref || label, dependsOn }));
    });
  });

  dependencies.forEach(({ ref, dependsOn }) => {
    if (!refs.has(dependsOn)) errors.push(`Task “${ref}” depends on nonexistent ref: “${dependsOn}”.`);
    if (ref === dependsOn) errors.push(`Task “${ref}” cannot depend on itself.`);
  });
  return errors;
};

export const parseDiscoveryPlan = (input: string, source: DiscoveryPlanParseResult['source'] = 'agent_message'): DiscoveryPlanParseResult => {
  if (!input.trim()) return { plan: null, errors: ['No plan response received from local agent.'], source: 'none' };
  const matches = [...input.matchAll(marker)];
  const json = matches.at(-1)?.[1];
  if (!json) return { plan: null, errors: ['Agent did not return a standard plan payload. Please request agent to correct the plan.'], source };
  try {
    const plan = toPlan(JSON.parse(json));
    return { plan, errors: validateDiscoveryPlan(plan), source };
  } catch {
    return { plan: null, errors: ['Plan payload is not valid JSON. Please request agent to correct the plan.'], source };
  }
};

export const serializeDiscoveryPlanContract = () => `
At the very end of your response, return exactly one machine-readable plan enclosed in these markers (no markdown fence):
<task-hub-discovery-plan>
{"summary":"...","assumptions":["..."],"affected_docs":["..."],"architecture_notes":["..."],"risks":["..."],"epic":{"title":"...","description":"..."},"stories":[{"title":"...","story_points":3,"acceptance_criteria":["..."],"tasks":[{"ref":"api","title":"...","story_points":3,"acceptance_criteria":["..."],"depends_on":[]}]}]}
</task-hub-discovery-plan>
`;

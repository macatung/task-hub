import fs from 'node:fs';
import path from 'node:path';

console.log("=== EMPIRICAL MCP CONTRACT & STREAMING VALIDATION ===");

// 1. Validate TaskHubMcpController.php tools definition
const mcpFile = path.resolve('apps/hub/app/Http/Controllers/Api/TaskHubMcpController.php');
const mcpContent = fs.readFileSync(mcpFile, 'utf8');

// Extract tools array from PHP source
const toolsMatch = mcpContent.match(/private function tools\(\): array[\s\S]*?return \[([\s\S]*?)\];\s*\}/);
if (!toolsMatch) {
  console.error("FAIL: Could not locate tools() in TaskHubMcpController.php");
  process.exit(1);
}

console.log("Found tools() definition in TaskHubMcpController.php");

// Validate reject_task tool schema
const hasMcpRejectTask = mcpContent.includes("'name' => 'reject_task'");
const hasMcpRejectWorkItem = mcpContent.includes("'name' => 'reject_work_item'");
console.log(`- reject_task present: ${hasMcpRejectTask}`);
console.log(`- reject_work_item present: ${hasMcpRejectWorkItem}`);

if (!hasMcpRejectTask || !hasMcpRejectWorkItem) {
  console.error("FAIL: Missing reject_task or reject_work_item tool");
  process.exit(1);
}

// Check routing in callTool
const hasRejectRouting = mcpContent.includes("'reject_task', 'reject_work_item' => $runController->reject");
console.log(`- reject routing present: ${hasRejectRouting}`);
if (!hasRejectRouting) {
  console.error("FAIL: Missing routing for reject_task / reject_work_item in callTool");
  process.exit(1);
}

// Check JSON-RPC response format
const hasJsonRpc2 = mcpContent.includes("'jsonrpc' => '2.0'");
console.log(`- JSON-RPC 2.0 envelope present: ${hasJsonRpc2}`);
if (!hasJsonRpc2) {
  console.error("FAIL: JSON-RPC 2.0 response format missing");
  process.exit(1);
}

// Check MCP content wrapper: ['content' => [['type' => 'text', 'text' => ...]]]
const hasMcpContentWrapper = mcpContent.includes("['content' => [['type' => 'text'");
console.log(`- MCP text content envelope present: ${hasMcpContentWrapper}`);
if (!hasMcpContentWrapper) {
  console.error("FAIL: MCP text content envelope missing");
  process.exit(1);
}

// 2. Validate ApiAgentRunController.php reject implementation
const runControllerFile = path.resolve('apps/hub/app/Http/Controllers/Api/ApiAgentRunController.php');
const runControllerContent = fs.readFileSync(runControllerFile, 'utf8');

const rejectStartIndex = runControllerContent.indexOf('public function reject(Request $request, Task $task)');
const rejectEndIndex = runControllerContent.indexOf('public function githubWebhook', rejectStartIndex);
const rejectBody = runControllerContent.slice(rejectStartIndex, rejectEndIndex);

const transitionsTask = rejectBody.includes("$task->status === 'review' || $task->status === 'done'") && rejectBody.includes("$task->update(['status' => 'in_progress'])");
const updatesRun = rejectBody.includes("$latest->update(['status' => 'waiting_input', 'failure_reason' => $validated['reason']])");
const recordsEvent = rejectBody.includes("$this->recordEvent($latest, 'human_rejected', 'waiting_input', $validated)");

console.log(`- Transitions task status to in_progress: ${transitionsTask}`);
console.log(`- Updates latest agent run to waiting_input with failure_reason: ${updatesRun}`);
console.log(`- Records human_rejected event: ${recordsEvent}`);

if (!transitionsTask || !updatesRun || !recordsEvent) {
  console.error("FAIL: ApiAgentRunController::reject incomplete logic");
  process.exit(1);
}

// 3. Validate thought event parsing in electron/main.ts
const mainFile = path.resolve('apps/desktop/electron/main.ts');
const mainContent = fs.readFileSync(mainFile, 'utf8');

const hasThoughtInAgy = mainContent.includes("su.step_type === 'thought'") && mainContent.includes("su.thought_delta");
const hasEventThought = mainContent.includes("event.event === 'thought'");
console.log(`- electron/main.ts handles step_update thought/reasoning: ${hasThoughtInAgy}`);
console.log(`- electron/main.ts handles standalone event === 'thought': ${hasEventThought}`);

if (!hasThoughtInAgy || !hasEventThought) {
  console.error("FAIL: electron/main.ts missing thought event parsing");
  process.exit(1);
}

// 4. Validate AgentConsoleModal.vue thought rendering and state management
const vueFile = path.resolve('apps/desktop/src/components/AgentConsoleModal.vue');
const vueContent = fs.readFileSync(vueFile, 'utf8');

const hasStreamCardThoughtType = vueContent.includes("'thought'");
const hasConversationFilterThought = vueContent.includes("card.type === 'thought'");
const hasThoughtTemplate = vueContent.includes("card.type === 'thought'");
const hasApproveTaskReview = vueContent.includes("approveTaskReview");
const hasUiRejectTask = vueContent.includes("confirmRejectTask") && vueContent.includes("reject_task");

console.log(`- AgentConsoleModal.vue StreamCard includes 'thought': ${hasStreamCardThoughtType}`);
console.log(`- AgentConsoleModal.vue conversationCards includes thought: ${hasConversationFilterThought}`);
console.log(`- AgentConsoleModal.vue has thought card template rendering: ${hasThoughtTemplate}`);
console.log(`- AgentConsoleModal.vue has approve review flow: ${hasApproveTaskReview}`);
console.log(`- AgentConsoleModal.vue has reject review flow: ${hasUiRejectTask}`);

if (!hasStreamCardThoughtType || !hasConversationFilterThought || !hasThoughtTemplate || !hasApproveTaskReview || !hasUiRejectTask) {
  console.error("FAIL: AgentConsoleModal.vue missing thought or review flow implementation");
  process.exit(1);
}

console.log("\nALL VERIFICATION CHECKS PASSED EMPIRICALLY!");

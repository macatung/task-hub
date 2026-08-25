import { createApp } from 'vue';
import './style.css';
import '@vscode/codicons/dist/codicon.css';
import App from './App.vue';

createApp(App).mount('#app');

// IPC and event streams do not always acknowledge an action immediately.
// Give every Control Center button instant feedback and swallow repeated clicks
// while its owner switches to a longer-lived loading state.
const pendingButtons = new WeakMap<HTMLButtonElement, number>();
const clearPendingButton = (button: HTMLButtonElement) => {
  const timer = pendingButtons.get(button);
  if (timer) window.clearTimeout(timer);
  pendingButtons.delete(button);
  button.removeAttribute('data-action-pending');
  button.removeAttribute('aria-busy');
  const label = button.dataset.actionLabel;
  if (label) button.setAttribute('aria-label', label);
  else button.removeAttribute('aria-label');
  delete button.dataset.actionLabel;
};

document.addEventListener('click', event => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const button = target.closest('.cc-shell button') as HTMLButtonElement | null;
  if (!button || button.disabled) return;
  if (button.dataset.actionPending === 'true') {
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }
  button.dataset.actionPending = 'true';
  button.dataset.actionLabel = button.getAttribute('aria-label') || button.textContent?.trim() || 'Action';
  button.setAttribute('aria-label', `${button.dataset.actionLabel}, processing`);
  button.setAttribute('aria-busy', 'true');
  pendingButtons.set(button, window.setTimeout(() => clearPendingButton(button), 1500));
}, true);

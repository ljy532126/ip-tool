import { ref } from 'vue';

const toasts = ref([]);
let tid = 0;

export function useToast() {
  function add(msg, type = 'success') {
    const id = ++tid;
    toasts.value.push({ id, msg, type });
    setTimeout(() => {
      const i = toasts.value.findIndex(t => t.id === id);
      if (i > -1) toasts.value.splice(i, 1);
    }, 2500);
  }
  return { toasts, add };
}

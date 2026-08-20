import { ref } from 'vue';

const isLeavesEnabled = ref<boolean>(true);

export function useZenAtmosphere() {
  const toggleLeaves = () => {
    isLeavesEnabled.value = !isLeavesEnabled.value;
  };

  const setLeaves = (val: boolean) => {
    isLeavesEnabled.value = val;
  };

  return {
    isLeavesEnabled,
    toggleLeaves,
    setLeaves
  };
}

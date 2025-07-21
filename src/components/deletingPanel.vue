<template>
  <div class="deleting-panel">
    <v-sheet class="mx-auto">
      <div class="deleting-panel__title text-h4 mb-4 d-flex justify-center">
        Deleting Panel
      </div>

      <v-form ref="form">
        <div style="min-height: 80px">
          <v-select
            v-if="!isDeletingRandom"
            v-model="selectedRowsToDelete"
            :items="availableRowIndices"
            :rules="[(v) => !!v.length || 'At least one row must be selected']"
            label="Rows to delete"
            multiple
            chips
            clearable
          ></v-select>

          <div v-else class="random-deletion-controls">
            <v-slider
              v-model="randomRowsToDeleteQuantity"
              :rules="[(v) => v > 0 || 'Must delete at least one row']"
              :min="1"
              :max="maxAvailableRows"
              :step="1"
              thumb-label
              color="orange"
              label="Rows to delete"
            ></v-slider>

            <v-slider
              v-model="randomAttributesToDeleteQuantity"
              :rules="[(v) => v > 0 || 'Must delete at least one attribute']"
              :min="1"
              :max="10"
              :step="1"
              thumb-label
              color="red"
              label="Attributes to delete per row"
            ></v-slider>

            <div class="deletion-summary">
              <div>Attributes to delete: {{ randomAttributesToDeleteQuantity }}</div>
              <div>Rows to delete: {{ randomRowsToDeleteQuantity }}</div>
              <div class="font-weight-bold">Total changes: {{ totalDeletionCount }}</div>
            </div>
          </div>
        </div>

        <v-checkbox
          v-model="isDeletingRandom"
          label="Random deletion"
          @change="handleDeletionModeChange"
        ></v-checkbox>

        <div class="action-buttons">
          <v-btn
            :disabled="isDeleteDisabled"
            color="success"
            class="mt-4"
            block
            @click="handleDelete"
          >
            Delete Data
          </v-btn>

          <transition name="fade">
            <v-btn
              v-if="showResetButton"
              color="error"
              class="mt-4"
              block
              @click="resetForm"
            >
              Reset Form
            </v-btn>
          </transition>
        </div>
      </v-form>
    </v-sheet>

    <transition name="fade">
      <v-alert
        v-if="isInfoVisible"
        type="success"
        title="Deletion Complete"
        class="mt-4 deletion-alert"
        text="Data has been successfully modified. Check the data table or graphs to see changes."
      ></v-alert>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, watch } from "vue";
import { useDataStore } from "@/store/index";
import { useDataDeleting } from "@/composables/dataDeleting";

const emit = defineEmits(["openModal"]);
const props = defineProps({
  restoreAccepted: Boolean,
});

const store = useDataStore();
const form = ref(null);

const {
  deleteData,
  isDeletingRandom,
  isInfoVisible,
  randomRowsToDeleteQuantity,
  randomAttributesToDeleteQuantity,
  selectedRowsToDelete,
  resetDeletionParameters,
} = useDataDeleting();

// Computed properties
const availableRowIndices = computed(() =>
  Array.from({ length: store.getTableItems.length }, (_, i) => i).filter(
    (index) => store.getTableItems[index]?.status !== "deleted"
  )
);

const maxAvailableRows = computed(
  () => store.getTableItems.filter((item) => item.status !== "deleted").length
);

const totalDeletionCount = computed(
  () => randomAttributesToDeleteQuantity.value * randomRowsToDeleteQuantity.value
);

const isDeleteDisabled = computed(
  () =>
    store.getDeletedRows.length > 0 ||
    (isDeletingRandom.value
      ? randomRowsToDeleteQuantity.value < 1
      : selectedRowsToDelete.value.length < 1)
);

const showResetButton = computed(
  () => !isDeletingRandom.value && selectedRowsToDelete.value.length > 0
);

// Methods
function resetForm() {
  if (form.value) {
    form.value.reset();
  }
  resetDeletionParameters();
}

function handleDeletionModeChange() {
  selectedRowsToDelete.value = [];
  randomRowsToDeleteQuantity.value = 1;
  randomAttributesToDeleteQuantity.value = 1;
}

function handleDelete() {
  if (form.value && !form.value.validate()) return;

  emit("openModal");
}

// Watchers
watch(
  () => props.restoreAccepted,
  (newVal) => {
    if (newVal) {
      deleteData();
    }
  }
);
</script>

<style lang="scss" scoped>
.deleting-panel {
  position: relative;

  .random-deletion-controls {
    margin-top: 12px;
  }

  .deletion-summary {
    margin-top: 16px;
    padding: 8px;
    background-color: #3b1818;
    border-radius: 14px;
  }

  .action-buttons {
    width: 50%;
    display: flex;
    flex-direction: column;
  }

  .deletion-alert {
    position: absolute;
    bottom: auto;
    left: 20px;
    transform: translateX(-50%);
    z-index: 100;
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

<template>
  <div class="restoring-panel">
    <v-dialog v-model="restoreDialog" width="500" persistent>
      <template v-slot:activator="{ props }">
        <v-btn
          :disabled="!hasDeletedRows"
          color="primary"
          variant="outlined"
          v-bind="props"
          class="restore-button"
          @click="prepareRestoration"
        >
          <v-icon start>mdi-restore</v-icon>
          Restore Data ({{ deletedRowsCount }})
          <v-tooltip v-if="!hasDeletedRows" activator="parent" location="bottom">
            No deleted data available to restore
          </v-tooltip>
        </v-btn>
      </template>

      <v-card>
        <v-card-title class="d-flex justify-space-between align-center">
          <span>Restoration Options</span>
          <v-btn icon @click="restoreDialog = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-card-title>

        <v-card-text>
          <v-select
            v-model="selectedMethod"
            :items="restorationMethods"
            label="Restoration Method"
            class="mb-4"
          ></v-select>

          <div v-if="selectedMethod === 'K-Nearest Neighbors'">
            <v-slider
              v-model="kValue"
              label="Number of Neighbors (k)"
              min="1"
              max="10"
              step="1"
              thumb-label
            ></v-slider>

            <v-select
              v-model="distanceMetric"
              :items="distanceMetrics"
              label="Distance Metric"
              class="mb-2"
            ></v-select>

            <v-select
              v-model="normalizationMethod"
              :items="normalizationMethods"
              label="Normalization Method"
            ></v-select>
          </div>

          <v-alert v-if="hasDeletedRows" type="info" class="mt-4">
            {{ deletedRowsCount }} deleted records will be processed
          </v-alert>
        </v-card-text>

        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="error" @click="restoreDialog = false">Cancel</v-btn>
          <v-btn color="success" @click="executeRestoration" :loading="isRestoring">
            Restore
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="restoreSuccess" color="success" timeout="5000">
      Successfully restored {{ actualRestoredCount }} records
      <template v-slot:actions>
        <v-btn variant="text" @click="restoreSuccess = false">Close</v-btn>
      </template>
    </v-snackbar>

    <v-snackbar v-model="restoreError" color="error" timeout="5000">
      {{ errorMessage }}
      <template v-slot:actions>
        <v-btn variant="text" @click="restoreError = false">Close</v-btn>
      </template>
    </v-snackbar>
  </div>
</template>

<script setup>
import { ref, computed } from "vue";
import { useDataRestore } from "@/composables/dataRestore";
import { useDataStore } from "@/store/index";

const { restoreData, getDeletedRows, restoredRows } = useDataRestore();
const store = useDataStore();

// State
const restoreDialog = ref(false);
const restoreSuccess = ref(false);
const restoreError = ref(false);
const errorMessage = ref("");
const isRestoring = ref(false);
const selectedMethod = ref("K-Nearest Neighbors");
const kValue = ref(3);
const distanceMetric = ref("Euclidean");
const normalizationMethod = ref("Min-Max");
const actualRestoredCount = ref(0);

// Constants
const restorationMethods = ["K-Nearest Neighbors", "Mean Value", "Median Value"];
const distanceMetrics = ["Euclidean", "Cosine", "Pearson"];
const normalizationMethods = ["Min-Max", "Z-Score"];

// Computed
const hasDeletedRows = computed(() => {
  const deletedRows = store.getDeletedRows || getDeletedRows || [];
  return deletedRows.length > 0;
});

const deletedRowsCount = computed(() => {
  const deletedRows = store.getDeletedRows || getDeletedRows || [];
  return deletedRows.length;
});

// Methods
function prepareRestoration() {
  console.log("Preparing restoration...");
  console.log("Deleted rows available:", deletedRowsCount.value);

  // Reset to default values when opening dialog
  selectedMethod.value = "K-Nearest Neighbors";
  kValue.value = 3;
  distanceMetric.value = "Euclidean";
  normalizationMethod.value = "Min-Max";
  actualRestoredCount.value = 0;
}

async function executeRestoration() {
  isRestoring.value = true;
  restoreError.value = false;

  try {
    console.log("Starting restoration with method:", selectedMethod.value);

    const config = {
      type: selectedMethod.value,
    };

    // Add KNN specific parameters if needed
    if (selectedMethod.value === "K-Nearest Neighbors") {
      config.k = kValue.value;
      config.distanceMetric = distanceMetric.value;
      config.normalization = normalizationMethod.value;
    }

    console.log("Restoration config:", config);

    // Execute restoration
    const restoredCount = await restoreData(config);

    console.log("Restoration completed. Count:", restoredCount);

    actualRestoredCount.value = restoredCount || 0;

    if (actualRestoredCount.value > 0) {
      restoreSuccess.value = true;
    } else {
      errorMessage.value = "No records were restored. Check console for details.";
      restoreError.value = true;
    }
  } catch (error) {
    console.error("Restoration error:", error);
    errorMessage.value = `Restoration failed: ${error.message}`;
    restoreError.value = true;
    actualRestoredCount.value = 0;
  } finally {
    isRestoring.value = false;
    restoreDialog.value = false;
  }
}
</script>

<style scoped>
.restoring-panel {
  display: inline-block;
  margin: 8px;
}

.restore-button {
  min-width: 150px;
}

.v-card-title {
  background-color: #1976d2;
  color: white;
  padding: 16px;
}
</style>

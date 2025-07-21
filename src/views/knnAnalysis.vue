<template>
  <v-card style="min-width: 50%">
    <v-card-title>KNN Analysis</v-card-title>
    <v-card-text>
      <v-alert v-if="dataIssues.length" type="warning" class="mb-4">
        <div v-for="(issue, i) in dataIssues" :key="i">{{ issue }}</div>
      </v-alert>

      <v-select v-model="knnConfig.k" :items="[1, 3, 5, 7]" label="k value"></v-select>
      <v-select
        v-model="knnConfig.distanceMetric"
        :items="['Euclidean', 'Manhattan']"
        label="Distance Metric"
      ></v-select>

      <v-btn @click="runAnalysis" color="primary" class="mt-4"> Run Analysis </v-btn>

      <div v-if="results" class="mt-4">
        <h3>Fold Accuracies:</h3>
        <div v-for="(acc, i) in results" :key="i">Fold {{ i + 1 }}: {{ acc }}%</div>
        <v-divider class="my-2"></v-divider>
        <strong>Average: {{ averageAccuracy }}%</strong>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup>
import { ref, computed } from "vue";
import { useDataRestore } from "@/composables/dataRestore";

const { knnConfig, inspectData, crossValidate } = useDataRestore();
const dataIssues = ref([]);
const results = ref(null);

const averageAccuracy = computed(() => {
  if (!results.value) return 0;
  return (
    results.value.reduce((a, b) => a + parseFloat(b), 0) / results.value.length
  ).toFixed(2);
});

async function runAnalysis() {
  dataIssues.value = inspectData().issues;
  if (dataIssues.value.length > 0) return;

  results.value = await crossValidate();
}
</script>

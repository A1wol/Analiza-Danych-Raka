import { useDataStore } from "@/store/index";
import { ref } from "vue";

export function useDataRestore() {
  const store = useDataStore();
  const restoredRows = ref([]);
  const knnResults = ref([]);
  const performanceMetrics = ref(null);
  const algorithmAnalysis = ref(null);

  const knnConfig = ref({
    k: 3,
    distanceMetric: 'Euclidean',
    normalization: 'Min-Max',
    aggregation: 'Mode'  // Changed default aggregation to 'Mode' for classification
  });

  // Improved distance metrics with NaN handling
  const distanceMetrics = {
    Euclidean: (x, y, features) => {
      let sum = 0;
      let validFeatures = 0;
      for (const f of features) {
        if (!isNaN(x[f]) && !isNaN(y[f])) {
          sum += Math.pow(x[f] - y[f], 2);
          validFeatures++;
        }
      }
      return validFeatures > 0 ? Math.sqrt(sum / validFeatures) : Infinity;
    },
    Manhattan: (x, y, features) => {
      let sum = 0;
      let validFeatures = 0;
      for (const f of features) {
        if (!isNaN(x[f]) && !isNaN(y[f])) {
          sum += Math.abs(x[f] - y[f]);
          validFeatures++;
        }
      }
      return validFeatures > 0 ? sum / validFeatures : Infinity;
    },
    Cosine: (x, y, features) => {
      let dot = 0, normX = 0, normY = 0;
      let validFeatures = 0;
      for (const f of features) {
        if (!isNaN(x[f]) && !isNaN(y[f])) {
          dot += x[f] * y[f];
          normX += Math.pow(x[f], 2);
          normY += Math.pow(y[f], 2);
          validFeatures++;
        }
      }
      if (validFeatures === 0) return Infinity;
      normX = Math.sqrt(normX);
      normY = Math.sqrt(normY);
      return 1 - (dot / (normX * normY + 1e-10));
    }
  };

  // Update inspectData()
  function inspectData() {
    const data = prepareData();
    const features = Object.keys(data[0]).filter(
      k => !['id', 'decision', 'status', 'deletedAt'].includes(k)
    );

    const issues = features.map(f => {
      const invalidCount = data.filter(row => isNaN(row[f])).length;
      return invalidCount > 0 ? `${f} has ${invalidCount} invalid values` : null;
    }).filter(Boolean);

    return {
      classCounts: {
        class2: data.filter(row => row.decision === 2).length,
        class4: data.filter(row => row.decision === 4).length
      },
      issues
    };
  }

  // Add this function to clean and prepare your data
  function prepareData() {
    const validFeatures = [
      'radius', 'texture', 'perimeter', 'area',
      'smoothness', 'compactness', 'concavity',
      'concavePoints', 'symmetry', 'fractalDimension'
    ];

    return store.getActiveRows
      .map(item => {
        // Clean and convert each feature
        const cleaned = {
          id: item.id,
          decision: parseInt(String(item.decision).replace(/\r/g, '').trim()),
          status: item.status
        };

        validFeatures.forEach(f => {
          // Convert to number and handle NaN cases
          const numValue = parseFloat(item[f]);
          cleaned[f] = isNaN(numValue) ? 0 : numValue;
        });

        return cleaned;
      })
      .filter(item => item.decision === 2 || item.decision === 4);
  }

  function normalizeData(trainData, testData, method, features) {
    const stats = {};

    // Calculate stats only from training data
    features.forEach(f => {
      const values = trainData
        .map(row => parseFloat(row[f]))
        .filter(v => !isNaN(v) && v !== null && v !== undefined);

      if (values.length === 0) {
        console.warn(`Feature ${f} has no valid values`);
        return;
      }

      if (method === 'Min-Max') {
        stats[f] = {
          min: Math.min(...values),
          max: Math.max(...values)
        };
      } else if (method === 'Z-Score') {
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const std = Math.sqrt(values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length);
        stats[f] = { mean, std };
      }
    });

    const normalize = (row, stats) => {
      const normalized = { ...row };
      features.forEach(f => {
        if (!stats[f]) {
          normalized[f] = 0; // Default value for invalid features
          return;
        }

        const value = parseFloat(row[f]);
        if (isNaN(value)) {
          normalized[f] = 0;
          return;
        }

        if (method === 'Min-Max') {
          const range = stats[f].max - stats[f].min;
          normalized[f] = range > 0 ? (value - stats[f].min) / range : 0;
        } else if (method === 'Z-Score') {
          normalized[f] = stats[f].std > 0 ? (value - stats[f].mean) / stats[f].std : 0;
        }
      });
      return normalized;
    };

    return {
      train: trainData.map(row => normalize(row, stats)),
      test: testData.map(row => normalize(row, stats))
    };
  }


  function stratifiedShuffle(data) {
    const class2 = data.filter(row => row.decision === 2);
    const class4 = data.filter(row => row.decision === 4);

    const shuffle = arr => [...arr].sort(() => Math.random() - 0.5);

    const shuffled = [];
    const maxLength = Math.max(class2.length, class4.length);

    for (let i = 0; i < maxLength; i++) {
      if (i < class2.length) shuffled.push(class2[i]);
      if (i < class4.length) shuffled.push(class4[i]);
    }

    return shuffle(shuffled);
  }

  function findKNN(target, data, features) {
    const cleanTargetDecision = parseInt(String(target.decision).replace(/\r/g, '').trim());

    const normalized = normalizeData(data, [target], knnConfig.value.normalization, features);
    const normTrain = normalized.train;
    const normTarget = normalized.test[0];

    const distances = data.map((row, index) => ({
      row,
      distance: distanceMetrics[knnConfig.value.distanceMetric](
        normTarget,
        normTrain[index],
        features
      ),
      decision: parseInt(String(row.decision).replace(/\r/g, '').trim())
    }));

    return distances
      .sort((a, b) => a.distance - b.distance)
      .slice(0, knnConfig.value.k);
  }

  function crossValidate() {
    const inspection = inspectData();
    if (inspection.issues.length > 0) {
      console.error('Data issues:', inspection.issues);
      return;
    }

    const data = store.getActiveRows
      .map(row => ({
        ...row,
        decision: parseInt(String(row.decision).replace(/\r/g, '').trim())
      }))
      .filter(row => row.decision === 2 || row.decision === 4);

    const features = Object.keys(data[0]).filter(
      k => !['id', 'decision', 'status', 'deletedAt'].includes(k)
    );

    // Stratified shuffle
    const class2 = data.filter(row => row.decision === 2);
    const class4 = data.filter(row => row.decision === 4);
    const shuffled = [...class2, ...class4].sort(() => Math.random() - 0.5);

    const folds = 10;
    const results = [];

    for (let i = 0; i < folds; i++) {
      const testStart = Math.floor(i * shuffled.length / folds);
      const testEnd = Math.floor((i + 1) * shuffled.length / folds);
      const testData = shuffled.slice(testStart, testEnd);
      const trainData = [...shuffled.slice(0, testStart), ...shuffled.slice(testEnd)];

      // Normalize train and test data correctly
      const normalized = normalizeData(trainData, testData, knnConfig.value.normalization, features);
      const normTrain = normalized.train;
      const normTest = normalized.test;

      let correct = 0;
      for (const testRow of normTest) {
        const neighbors = findKNN(testRow, normTrain, features);
        if (neighbors.length > 0) {
          const predicted = aggregateDecisions(neighbors.map(n => n.decision));
          if (predicted === testRow.decision) correct++;
        }
      }

      const accuracy = (correct / normTest.length * 100).toFixed(2);
      console.log(`Fold ${i + 1}: ${accuracy}% accuracy`);
      results.push(accuracy);
    }

    const averageAccuracy = results.reduce((a, b) => a + parseFloat(b), 0) / results.length;
    console.log('Average accuracy:', averageAccuracy + '%');
    performanceMetrics.value = { accuracy: averageAccuracy };
    return results;
  }

  function aggregateDecisions(decisions) {
    switch (knnConfig.value.aggregation) {
      case 'Mode':
        return mode(decisions);
      case 'Mean':
        return Math.round(mean(decisions));
      case 'Median':
        return median(decisions);
      case 'Weighted':
        return mode(decisions);
      default:
        return mode(decisions);
    }
  }

  function calculateConfidence(neighbors) {
    const decisions = neighbors.map(n => n.decision);
    const counts = {};
    decisions.forEach(d => counts[d] = (counts[d] || 0) + 1);
    const maxCount = Math.max(...Object.values(counts));
    return maxCount / decisions.length;
  }

  function calculatePerformanceMetrics(results = knnResults.value) {
    const cm = { truePositive: 0, falsePositive: 0, trueNegative: 0, falseNegative: 0 };

    for (const result of results) {
      if (result.actual === 2 && result.predicted === 2) cm.truePositive++;
      if (result.actual === 4 && result.predicted === 2) cm.falsePositive++;
      if (result.actual === 4 && result.predicted === 4) cm.trueNegative++;
      if (result.actual === 2 && result.predicted === 4) cm.falseNegative++;
    }

    const total = results.length;
    const accuracy = (cm.truePositive + cm.trueNegative) / total;
    const precision = cm.truePositive / (cm.truePositive + cm.falsePositive + 1e-10);
    const recall = cm.truePositive / (cm.truePositive + cm.falseNegative + 1e-10);
    const f1 = 2 * (precision * recall) / (precision + recall + 1e-10);

    performanceMetrics.value = {
      accuracy: accuracy * 100,
      precision: precision * 100,
      recall: recall * 100,
      f1: f1 * 100,
      confusionMatrix: cm,
      totalSamples: total
    };
  }

  function updateAlgorithmAnalysis(operation, time, dataSize) {
    if (!algorithmAnalysis.value) {
      algorithmAnalysis.value = {
        operations: {},
        totalTime: 0,
        memoryUsage: 0
      };
    }

    if (!algorithmAnalysis.value.operations[operation]) {
      algorithmAnalysis.value.operations[operation] = {
        totalTime: 0,
        calls: 0,
        avgTime: 0,
        maxTime: 0,
        dataSize: 0
      };
    }

    const op = algorithmAnalysis.value.operations[operation];
    op.totalTime += time;
    op.calls += 1;
    op.avgTime = op.totalTime / op.calls;
    op.maxTime = Math.max(op.maxTime, time);
    op.dataSize = Math.max(op.dataSize, dataSize);

    algorithmAnalysis.value.totalTime += time;
    algorithmAnalysis.value.memoryUsage = estimateMemoryUsage();
  }

  function estimateMemoryUsage() {
    const activeRows = store.getActiveRows.length;
    const deletedRows = store.getDeletedRows.length;
    const restoredRowsCount = restoredRows.value.length;
    return (activeRows + deletedRows + restoredRowsCount) * 512;
  }

  function mean(values) {
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  function median(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  function mode(values) {
    const freq = {};
    let max = 0, mode = null;
    for (const v of values) {
      freq[v] = (freq[v] || 0) + 1;
      if (freq[v] > max) {
        max = freq[v];
        mode = v;
      }
    }
    return mode;
  }

  function restoreData(config = {}) {
    const startTime = performance.now();
    const restoredCount = { successful: 0, failed: 0 };

    if (config.k) knnConfig.value.k = config.k;
    if (config.distanceMetric) knnConfig.value.distanceMetric = config.distanceMetric;
    if (config.normalization) knnConfig.value.normalization = config.normalization;

    const features = Object.keys(store.getTableItems[0] || {})
      .filter(k => !['id', 'decision', 'status', 'deletedAt', 'fullRowDeleted', 'deletedAttributes'].includes(k));

    if (!store.getDeletedRows || store.getDeletedRows.length === 0) {
      console.log("Brak usuniętych wierszy do odzyskania");
      return 0;
    }

    console.log(`Rozpoczynam odzyskiwanie ${store.getDeletedRows.length} usuniętych wierszy`);

    store.getDeletedRows.forEach((deletedRow, index) => {
      const cleanDecision = parseInt(String(deletedRow.decision).replace(/\r/g, '').trim());

      if (cleanDecision === 2 || cleanDecision === 4) {
        const activeRows = store.getActiveRows.filter(row => {
          const rowDecision = parseInt(String(row.decision).replace(/\r/g, '').trim());
          return rowDecision === cleanDecision;
        });

        if (activeRows.length > 0) {
          const cleanDeletedRow = { ...deletedRow, decision: cleanDecision };
          const neighbors = findKNN(cleanDeletedRow, activeRows, features);

          if (neighbors.length > 0) {
            const restoredRow = {
              ...deletedRow,
              decision: cleanDecision,
              status: 'restored',
              restoredAt: new Date().toISOString(),
              fullRowDeleted: false,
              deletedAttributes: []
            };

            if (deletedRow.deletedAttributes?.length > 0) {
              deletedRow.deletedAttributes.forEach(attr => {
                const values = neighbors.map(n => parseFloat(n.row[attr])).filter(v => !isNaN(v));
                if (values.length > 0) {
                  restoredRow[attr] = config.type === 'Median Value' ? median(values) : mean(values);
                }
              });
            } else {
              features.forEach(f => {
                if (deletedRow[f] === 0 || isNaN(deletedRow[f]) || deletedRow[f] === null) {
                  const values = neighbors.map(n => parseFloat(n.row[f])).filter(v => !isNaN(v));
                  if (values.length > 0) {
                    restoredRow[f] = config.type === 'Median Value' ? median(values) : mean(values);
                  }
                }
              });
            }

            try {
              if (deletedRow.fullRowDeleted) {
                store.tableItems.push(restoredRow);
              } else {
                const rowIndex = store.tableItems.findIndex(item => item.id === deletedRow.id);
                if (rowIndex !== -1) store.tableItems[rowIndex] = restoredRow;
              }

              store.deletedRows = store.deletedRows.filter(row => row.id !== deletedRow.id);
              store.fullDeletions = store.fullDeletions.filter(row => row.id !== deletedRow.id);
              restoredCount.successful++;
            } catch (error) {
              console.error(`Błąd przy przywracaniu wiersza ${deletedRow.id}:`, error);
              restoredCount.failed++;
            }
          } else {
            restoredCount.failed++;
          }
        } else {
          restoredCount.failed++;
        }
      } else {
        restoredCount.failed++;
      }
    });

    updateAlgorithmAnalysis('data_restoration', performance.now() - startTime, store.getDeletedRows.length);
    return restoredCount.successful;
  }

  function analyzeDistanceMetrics() {
    const metrics = Object.keys(distanceMetrics);
    const results = {};

    for (const metric of metrics) {
      const originalMetric = knnConfig.value.distanceMetric;
      knnConfig.value.distanceMetric = metric;

      crossValidate();

      results[metric] = {
        accuracy: performanceMetrics.value?.accuracy || 0,
        f1: performanceMetrics.value?.f1 || 0,
        precision: performanceMetrics.value?.precision || 0,
        recall: performanceMetrics.value?.recall || 0
      };

      knnConfig.value.distanceMetric = originalMetric;
    }

    return results;
  }

  function generateConclusions() {
    const analysis = algorithmAnalysis.value;
    const performance = performanceMetrics.value;

    return {
      algorithmAnalysis: {
        description: "Analiza algorytmu KNN wykazuje jego złożoność czasową O(n*d*k), gdzie n to liczba próbek, d to liczba cech, a k to liczba sąsiadów.",
        timeComplexity: `Średni czas wykonania: ${analysis?.operations?.knn_search?.avgTime?.toFixed(2) || 0} ms`,
        spaceComplexity: `Szacowane zużycie pamięci: ${analysis?.memoryUsage || 0} bajtów`,
        scalability: analysis?.operations?.knn_search?.dataSize > 1000 ? "Dobra skalowalność dla dużych zbiorów danych" : "Optymalna dla małych i średnich zbiorów danych"
      },
      algorithmEfficiency: {
        description: "Efektywność algorytmu KNN w kontekście odzyskiwania danych zależy od wyboru miary odległości, normalizacji i wartości k.",
        bestDistanceMetric: knnConfig.value.distanceMetric,
        bestNormalization: knnConfig.value.normalization,
        recommendedK: knnConfig.value.k,
        overallEfficiency: performance?.accuracy > 85 ? "Wysoka" : performance?.accuracy > 70 ? "Średnia" : "Niska"
      },
      recommendations: [
        "Użyj normalizacji Min-Max dla większości przypadków",
        "Testuj różne wartości k (3, 5, 7) dla optymalnych rezultatów",
        "Miara Euklidesowa sprawdza się dobrze dla danych numerycznych",
        "Regularnie przeprowadzaj kroswalidację dla oceny jakości modelu"
      ]
    };
  }

  return {
    knnConfig,
    knnResults,
    performanceMetrics,
    algorithmAnalysis,
    crossValidate,
    restoredRows,
    restoreData,
    analyzeDistanceMetrics,
    generateConclusions,
    getDeletedRows: () => store.getDeletedRows,
    inspectData
  };
}
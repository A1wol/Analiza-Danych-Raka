import { useDataStore } from "@/store";
import { ref, computed } from "vue";

export function useDataDeleting() {
  const store = useDataStore();

  const isDeletingRandom = ref(true);
  const isInfoVisible = ref(false);
  const randomRowsToDeleteQuantity = ref(0);
  const randomAttributesToDeleteQuantity = ref(0);
  const selectedRowsToDelete = ref([]);

  // WYMAGANIE 6: Ograniczenie liczby usuwanych atrybutów - powyżej 6 usuniętych atrybutów usuwamy wiersz
  const MAX_ATTRIBUTES_TO_DELETE = 6; // Zmienione z 10 na 6
  const MIN_ROWS_TO_DELETE = 1;
  const ATTRIBUTE_THRESHOLD_FOR_FULL_DELETION = 6; // Próg dla pełnego usunięcia wiersza

  // Computed property do pokazania informacji o progach
  const deletionInfo = computed(() => ({
    maxAttributes: MAX_ATTRIBUTES_TO_DELETE,
    threshold: ATTRIBUTE_THRESHOLD_FOR_FULL_DELETION,
    willDeleteFullRow: randomAttributesToDeleteQuantity.value > ATTRIBUTE_THRESHOLD_FOR_FULL_DELETION,
    availableAttributes: getAvailableAttributesCount()
  }));

  // Funkcja do obliczania dostępnych atrybutów
  function getAvailableAttributesCount() {
    const sampleRow = store.getActiveRows[0];
    if (!sampleRow) return 0;

    return Object.keys(sampleRow).filter(
      k => !['id', 'decision', 'status', 'deletedAt', 'fullRowDeleted', 'deletedAttributes'].includes(k)
    ).length;
  }

  // Ulepszona funkcja usuwania z dodatkowymi sprawdzeniami
  function deleteData() {
    if (!validateDeletionParameters()) return;

    const shouldDeleteEntireRow = randomAttributesToDeleteQuantity.value > ATTRIBUTE_THRESHOLD_FOR_FULL_DELETION;

    // Ostrzeżenie użytkownika o pełnym usunięciu
    if (shouldDeleteEntireRow && !isDeletingRandom.value) {
      const confirmFullDeletion = confirm(
        `Wybrano ${randomAttributesToDeleteQuantity.value} atrybutów do usunięcia. ` +
        `Ponieważ przekracza to próg ${ATTRIBUTE_THRESHOLD_FOR_FULL_DELETION} atrybutów, ` +
        `wybrane wiersze zostaną całkowicie usunięte. Czy kontynuować?`
      );
      if (!confirmFullDeletion) return;
    }

    const deleteConfig = {
      isRandom: isDeletingRandom.value,
      forceRowDeletion: shouldDeleteEntireRow,
      propertyQuantity: shouldDeleteEntireRow ? 0 : Math.min(randomAttributesToDeleteQuantity.value, MAX_ATTRIBUTES_TO_DELETE),
      rowQuantity: isDeletingRandom.value ? randomRowsToDeleteQuantity.value : selectedRowsToDelete.value.length,
      rows: isDeletingRandom.value ? [] : selectedRowsToDelete.value
    };

    // Wykonaj usunięcie z pomiarem czasu
    const startTime = performance.now();
    store.deleteTableRows(deleteConfig);
    const endTime = performance.now();

    // Pokaż informacje o operacji
    showDeletionInfo(deleteConfig, endTime - startTime);

    if (!isDeletingRandom.value) {
      selectedRowsToDelete.value = [];
    }
  }

  // Funkcja do wyświetlania informacji o usunięciu
  function showDeletionInfo(config, executionTime) {
    const stats = store.getDeletionStatistics;
    const quality = store.getDataQualityMetrics;

    console.log("=== RAPORT USUWANIA DANYCH ===");
    console.log(`Czas wykonania: ${executionTime.toFixed(2)} ms`);
    console.log(`Typ operacji: ${config.forceRowDeletion ? 'Pełne usunięcie wierszy' : 'Częściowe usunięcie atrybutów'}`);
    console.log(`Liczba przetworzonych wierszy: ${config.rowQuantity}`);

    if (!config.forceRowDeletion) {
      console.log(`Liczba usuniętych atrybutów na wiersz: ${config.propertyQuantity}`);
    }

    console.log(`Całkowita kompletność danych: ${quality.dataCompleteness.toFixed(1)}%`);
    console.log(`Statystyki usunięć:`, stats);

    isInfoVisible.value = true;
  }

  // Ulepszona walidacja parametrów usuwania
  function validateDeletionParameters() {
    if (isDeletingRandom.value) {
      // Walidacja dla losowego usuwania
      if (randomRowsToDeleteQuantity.value < MIN_ROWS_TO_DELETE) {
        console.error(`Należy usunąć co najmniej ${MIN_ROWS_TO_DELETE} wierszy`);
        return false;
      }

      if (randomRowsToDeleteQuantity.value > store.getActiveRows.length) {
        console.error(`Nie można usunąć więcej wierszy niż dostępnych (${store.getActiveRows.length})`);
        return false;
      }

      if (randomAttributesToDeleteQuantity.value < 1) {
        console.error("Należy usunąć co najmniej 1 atrybut");
        return false;
      }

      const availableAttributes = getAvailableAttributesCount();
      if (randomAttributesToDeleteQuantity.value > availableAttributes) {
        console.error(`Nie można usunąć więcej atrybutów niż dostępnych (${availableAttributes})`);
        return false;
      }

    } else {
      // Walidacja dla wybranego usuwania
      if (selectedRowsToDelete.value.length === 0) {
        console.error("Nie wybrano wierszy do usunięcia");
        return false;
      }

      if (selectedRowsToDelete.value.length > store.getActiveRows.length) {
        console.error("Wybrano więcej wierszy niż dostępnych");
        return false;
      }
    }

    return true;
  }

  // Funkcja do resetowania parametrów z dodatkowymi sprawdzeniami
  function resetDeletionParameters() {
    isDeletingRandom.value = false;
    randomRowsToDeleteQuantity.value = 0;
    randomAttributesToDeleteQuantity.value = 0;
    selectedRowsToDelete.value = [];
    isInfoVisible.value = false;

    console.log("Parametry usuwania zostały zresetowane");
  }

  // Funkcja do przewidywania efektów usunięcia
  function predictDeletionImpact() {
    if (!validateDeletionParameters()) return null;

    const currentQuality = store.getDataQualityMetrics;
    const rowsToDelete = isDeletingRandom.value ?
      randomRowsToDeleteQuantity.value :
      selectedRowsToDelete.value.length;

    const willDeleteFullRows = randomAttributesToDeleteQuantity.value > ATTRIBUTE_THRESHOLD_FOR_FULL_DELETION;

    const predictedActiveRows = willDeleteFullRows ?
      currentQuality.activeRecords - rowsToDelete :
      currentQuality.activeRecords; // Wiersze pozostają, ale z usuniętymi atrybutami

    const predictedCompleteness = currentQuality.totalRecords > 0 ?
      (predictedActiveRows / currentQuality.totalRecords) * 100 : 100;

    return {
      currentCompleteness: currentQuality.dataCompleteness,
      predictedCompleteness,
      completenessChange: predictedCompleteness - currentQuality.dataCompleteness,
      willDeleteFullRows,
      affectedRows: rowsToDelete,
      recommendedAction: predictedCompleteness < 50 ?
        "OSTRZEŻENIE: Operacja może znacząco obniżyć jakość danych" :
        "Operacja powinna być bezpieczna"
    };
  }

  // Funkcja do automatycznego doboru optymalnych parametrów
  function suggestOptimalParameters() {
    const quality = store.getDataQualityMetrics;
    const availableAttributes = getAvailableAttributesCount();

    const suggestions = {
      maxSafeRows: Math.floor(quality.activeRecords * 0.2), // Maksymalnie 20% wierszy
      maxSafeAttributes: Math.min(3, availableAttributes), // Maksymalnie 3 atrybuty lub mniej jeśli dostępnych jest mniej
      reasoning: []
    };

    if (quality.dataCompleteness < 80) {
      suggestions.maxSafeRows = Math.floor(quality.activeRecords * 0.1);
      suggestions.reasoning.push("Obniżono limit wierszy z powodu niskiej kompletności danych");
    }

    if (availableAttributes <= 5) {
      suggestions.maxSafeAttributes = 1;
      suggestions.reasoning.push("Ograniczono liczbę atrybutów z powodu małej liczby dostępnych cech");
    }

    suggestions.reasoning.push(`Próg pełnego usunięcia: ${ATTRIBUTE_THRESHOLD_FOR_FULL_DELETION} atrybutów`);

    return suggestions;
  }

  // Funkcja do eksportu raportu usuwania
  function exportDeletionReport() {
    const report = store.exportDeletionReport();
    const impact = predictDeletionImpact();
    const suggestions = suggestOptimalParameters();

    return {
      ...report,
      currentParameters: {
        isDeletingRandom: isDeletingRandom.value,
        rowsToDelete: isDeletingRandom.value ? randomRowsToDeleteQuantity.value : selectedRowsToDelete.value.length,
        attributesToDelete: randomAttributesToDeleteQuantity.value,
        thresholds: {
          maxAttributes: MAX_ATTRIBUTES_TO_DELETE,
          fullDeletionThreshold: ATTRIBUTE_THRESHOLD_FOR_FULL_DELETION
        }
      },
      predictedImpact: impact,
      suggestions
    };
  }

  return {
    // Istniejące właściwości
    isDeletingRandom,
    isInfoVisible,
    randomRowsToDeleteQuantity,
    randomAttributesToDeleteQuantity,
    selectedRowsToDelete,

    // Nowe właściwości
    deletionInfo,

    // Istniejące funkcje
    deleteData,
    resetDeletionParameters,

    // Nowe funkcje
    predictDeletionImpact,
    suggestOptimalParameters,
    exportDeletionReport,

    // Stałe do użycia w interfejsie
    MAX_ATTRIBUTES_TO_DELETE,
    ATTRIBUTE_THRESHOLD_FOR_FULL_DELETION
  };
}
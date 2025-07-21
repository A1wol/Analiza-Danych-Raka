import { defineStore } from 'pinia'
import { sample } from 'underscore'

export const useDataStore = defineStore('dataStore', {
  state: () => ({
    tableItems: [],
    deletedRows: [],
    fullDeletions: [],
    deletionStatistics: {
      totalDeleted: 0,
      partialDeletions: 0,
      fullDeletions: 0,
      attributesDeleted: {}
    }
  }),

  getters: {
    getTableItems: (state) => state.tableItems,
    getDeletedRows: (state) => state.deletedRows,
    getFullDeletions: (state) => state.fullDeletions,
    getDeletionStatistics: (state) => state.deletionStatistics,
    getActiveRows: (state) => state.tableItems.filter(item => item.status !== 'deleted'),
    getPartialDeletions: (state) =>
      state.deletedRows.filter(row => !state.fullDeletions.some(f => f.id === row.id)),

    getDataQualityMetrics: (state) => {
      const total = state.tableItems.length + state.deletedRows.length;
      const active = state.tableItems.filter(item => item.status !== 'deleted').length;

      return {
        totalRecords: total,
        activeRecords: active,
        deletedRecords: state.deletedRows.length,
        dataCompleteness: total > 0 ? (active / total) * 100 : 0
      };
    }
  },

  actions: {
    addTableItems(items) {
      this.tableItems = Array.isArray(items)
        ? items.map(item => ({
          ...item,
          status: item.status || 'active',
          deletedAt: null
        }))
        : []
      this.resetDeletionStatistics();
    },

    resetDeletionStatistics() {
      this.deletionStatistics = {
        totalDeleted: 0,
        partialDeletions: 0,
        fullDeletions: 0,
        attributesDeleted: {}
      };
    },

    updateDeletionStatistics(deletedAttributes, isFullDeletion) {
      this.deletionStatistics.totalDeleted++;

      if (isFullDeletion) {
        this.deletionStatistics.fullDeletions++;
      } else {
        this.deletionStatistics.partialDeletions++;
        deletedAttributes.forEach(attr => {
          this.deletionStatistics.attributesDeleted[attr] =
            (this.deletionStatistics.attributesDeleted[attr] || 0) + 1;
        });
      }
    },

    clearDeletedRows() {
      this.deletedRows = []
      this.fullDeletions = []
      this.resetDeletionStatistics();
    },

    updateRow(updateData) {
      const rowIndex = this.tableItems.findIndex(el => el.id === updateData.id)
      if (rowIndex !== -1) {
        this.tableItems[rowIndex] = {
          ...this.tableItems[rowIndex],
          ...updateData.row,
          status: 'updated'
        }
      }
    },

    restoreRow(rowId) {
      const deletedRowIndex = this.deletedRows.findIndex(row => row.id === rowId)
      if (deletedRowIndex === -1) return

      const deletedRow = this.deletedRows[deletedRowIndex]

      if (deletedRow.fullRowDeleted) {
        // Przywrócenie całkowicie usuniętego wiersza
        this.tableItems.push({
          ...deletedRow,
          status: 'restored',
          deletedAt: null,
          fullRowDeleted: false,
          deletedAttributes: []
        })
      } else {
        // Przywrócenie częściowo usuniętego wiersza
        const existingRowIndex = this.tableItems.findIndex(row => row.id === rowId)
        if (existingRowIndex !== -1) {
          // Przywróć usunięte atrybuty
          deletedRow.deletedAttributes.forEach(attr => {
            if (this.tableItems[existingRowIndex][attr] === 0) {
              this.tableItems[existingRowIndex][attr] = deletedRow[attr]
            }
          })
          this.tableItems[existingRowIndex].status = 'restored'
        }
      }

      // Usuń wiersz z listy usuniętych
      this.deletedRows.splice(deletedRowIndex, 1)
      this.fullDeletions = this.fullDeletions.filter(row => row.id !== rowId)

      // Aktualizuj statystyki
      if (deletedRow.fullRowDeleted) {
        this.deletionStatistics.fullDeletions--
      } else {
        this.deletionStatistics.partialDeletions--
      }
      this.deletionStatistics.totalDeleted--
    },

    markRowAsDeleted(row, isFullDeletion = false, deletedAttributes = []) {
      const deletedAt = new Date().toISOString()
      const deletedRow = {
        ...row,
        deletedAt,
        fullRowDeleted: isFullDeletion,
        deletedAttributes: isFullDeletion ? [] : deletedAttributes,
        status: 'deleted',
      }

      this.deletedRows.push(deletedRow)

      if (isFullDeletion) {
        this.fullDeletions.push(deletedRow)
      }

      this.updateDeletionStatistics(deletedAttributes, isFullDeletion)
      return deletedRow
    },

    clearRowAttributes(row, propertyQuantity) {
      const attributes = Object.keys(row).filter(
        key => !['id', 'decision', 'status', 'deletedAt', 'fullRowDeleted', 'deletedAttributes'].includes(key)
      )
      const maxAttributes = Math.min(propertyQuantity, attributes.length)
      const keysToClear = sample(attributes, maxAttributes)

      const updatedRow = { ...row }
      keysToClear.forEach(key => {
        updatedRow[key] = 0
      })

      updatedRow.status = 'removed'

      return { updatedRow, deletedAttributes: keysToClear }
    },

    deleteTableRows(deleteData) {
      this.deletedRows = []
      this.fullDeletions = []
      this.resetDeletionStatistics()

      if (deleteData.isRandom) {
        this.handleRandomDeletion(deleteData)
      } else {
        this.handleSelectedDeletion(deleteData)
      }
    },

    handleRandomDeletion({ rowQuantity, propertyQuantity, forceRowDeletion }) {
      const validIndices = this.tableItems
        .map((_, index) => index)
        .filter(index => this.tableItems[index].status !== 'deleted')

      const randomIndices = sample(validIndices, Math.min(rowQuantity, validIndices.length))
        .map(index => this.tableItems[index].id)

      this.processDeletions(randomIndices, propertyQuantity, forceRowDeletion)
    },

    handleSelectedDeletion({ rows, propertyQuantity, forceRowDeletion }) {
      const validIds = rows.filter(id =>
        this.tableItems.some(item => item.id === id && item.status !== 'deleted')
      )
      this.processDeletions(validIds, propertyQuantity, forceRowDeletion)
    },

    processDeletions(ids, propertyQuantity, forceRowDeletion) {
      const ATTRIBUTE_DELETION_THRESHOLD = 6
      const isFullDeletion = forceRowDeletion || propertyQuantity > ATTRIBUTE_DELETION_THRESHOLD

      if (isFullDeletion) {
        this.tableItems = this.tableItems.filter(row => {
          if (ids.includes(row.id)) {
            this.markRowAsDeleted(row, true, [])
            return false
          }
          return true
        })
      } else {
        this.tableItems = this.tableItems.map(row => {
          if (ids.includes(row.id)) {
            const { updatedRow, deletedAttributes } = this.clearRowAttributes(row, propertyQuantity)
            this.markRowAsDeleted(row, false, deletedAttributes)
            return updatedRow
          }
          return row
        })
      }
    },

    analyzeDataImpact() {
      const analysis = {
        deletionPattern: {},
        mostAffectedAttributes: [],
        dataIntegrityScore: 0
      }

      const attributeCounts = this.deletionStatistics.attributesDeleted
      const totalAttributes = Object.keys(this.tableItems[0] || {}).filter(
        key => !['id', 'decision', 'status', 'deletedAt', 'fullRowDeleted', 'deletedAttributes'].includes(key)
      ).length

      analysis.mostAffectedAttributes = Object.entries(attributeCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([attr, count]) => ({ attribute: attr, deletionCount: count }))

      const activeRecords = this.getActiveRows.length
      const totalRecords = this.tableItems.length + this.deletedRows.length
      analysis.dataIntegrityScore = totalRecords > 0 ? (activeRecords / totalRecords) * 100 : 100

      analysis.deletionPattern = {
        fullDeletionRate: this.deletionStatistics.totalDeleted > 0 ?
          (this.deletionStatistics.fullDeletions / this.deletionStatistics.totalDeleted) * 100 : 0,
        partialDeletionRate: this.deletionStatistics.totalDeleted > 0 ?
          (this.deletionStatistics.partialDeletions / this.deletionStatistics.totalDeleted) * 100 : 0,
        averageAttributesPerDeletion: this.deletionStatistics.partialDeletions > 0 ?
          Object.values(attributeCounts).reduce((a, b) => a + b, 0) / this.deletionStatistics.partialDeletions : 0
      }

      return analysis
    },

    exportDeletionReport() {
      return {
        timestamp: new Date().toISOString(),
        statistics: this.deletionStatistics,
        dataQuality: this.getDataQualityMetrics,
        impact: this.analyzeDataImpact(),
        recommendations: this.generateDeletionRecommendations()
      }
    },

    generateDeletionRecommendations() {
      const recommendations = []
      const stats = this.deletionStatistics
      const quality = this.getDataQualityMetrics

      if (stats.fullDeletions > stats.partialDeletions) {
        recommendations.push("Rozważ zmniejszenie progu usuwania pełnych wierszy z 6 do wyższej wartości")
      }

      if (quality.dataCompleteness < 70) {
        recommendations.push("Jakość danych spadła poniżej 70% - rozważ implementację bardziej konserwatywnej strategii usuwania")
      }

      if (Object.keys(stats.attributesDeleted).length > 0) {
        const mostDeleted = Object.entries(stats.attributesDeleted)
          .sort(([, a], [, b]) => b - a)[0]
        recommendations.push(`Atrybut '${mostDeleted[0]}' jest najczęściej usuwany (${mostDeleted[1]} razy) - sprawdź jego relevantność`)
      }

      return recommendations
    }
  }
})
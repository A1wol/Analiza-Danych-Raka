<template>
  <div class="data-container">
    <div class="data-tables">
      <!-- Main Data Table -->
      <div class="data-table">
        <v-data-table
          v-model:items-per-page="itemsPerPage"
          :headers="tableHeaders"
          :items="activeTableItems"
          density="compact"
          class="elevation-1 data__table"
          expand-on-click
        >
          <template v-slot:item.status="{ item }">
            <v-chip :color="getRowChipColor(item)" @click.stop="handleStatusClick(item)">
              {{ getRowChipText(item) }}
            </v-chip>
          </template>
          <template v-slot:expanded-row="{ item, columns }">
            <tr>
              <td :colspan="columns.length" style="background-color: rgb(27, 27, 27)">
                <div class="text-h5 ml-5 mt-3">Data Update</div>
                <table-row-update
                  :rowData="item"
                  @update-row="updateRow($event, item.columns.id)"
                />
              </td>
            </tr>
          </template>
        </v-data-table>
        <div class="table-info d-flex justify-end">Click a row to update the data</div>
      </div>

      <!-- Deleted Records Table -->
      <div class="deleted-table">
        <v-data-table
          v-model:items-per-page="itemsPerPage"
          :headers="deletedTableHeaders"
          :items="deletedTableItems"
          density="compact"
          class="elevation-1 deleted__table"
        >
          <template v-slot:top>
            <v-toolbar flat>
              <v-toolbar-title>Deleted Records</v-toolbar-title>
              <v-spacer></v-spacer>
              <v-chip color="error" class="ma-2">
                Total: {{ deletedTableItems.length }}
              </v-chip>
              <v-chip color="warning" class="ma-2">
                Full Deletions: {{ fullDeletionsCount }}
              </v-chip>
              <v-chip color="info" class="ma-2">
                Partial Deletions: {{ partialDeletionsCount }}
              </v-chip>
              <v-btn
                color="primary"
                class="ma-2"
                @click="restoreSelected"
                :disabled="!selectedDeletedRows.length"
              >
                Restore Selected
              </v-btn>
            </v-toolbar>
          </template>
          <template v-slot:item.data-table-select="{ item }">
            <v-checkbox
              v-model="selectedDeletedRows"
              :value="item.props.title.id"
              @click.stop
            ></v-checkbox>
          </template>
          <template v-slot:item.status="{ item }">
            <v-chip :color="item.props?.title?.fullRowDeleted ? 'error' : 'warning'">
              {{
                item.props?.title?.fullRowDeleted ? "fully deleted" : "partially deleted"
              }}
            </v-chip>
          </template>
          <template v-slot:item.deletedAt="{ item }">
            <div>
              {{
                new Date(item.props.title.deletedAt).toLocaleString("pl-PL", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              }}
            </div>
          </template>
          <template v-slot:item.deletedAttributes="{ item }">
            <div
              v-if="
                !item.props?.title?.fullRowDeleted &&
                item.props?.title?.deletedAttributes?.length > 0
              "
            >
              <v-chip
                v-for="attr in item.props.title.deletedAttributes"
                :key="attr"
                size="small"
                color="orange"
                class="ma-1"
              >
                {{ attr }}
              </v-chip>
            </div>
            <div v-else-if="item.props?.title?.fullRowDeleted">
              <v-chip color="error" size="small">All attributes deleted</v-chip>
            </div>
            <div v-else>
              <span class="text-grey">No data</span>
            </div>
          </template>
          <template v-slot:item.actions="{ item }">
            <v-btn
              icon
              color="primary"
              size="small"
              @click.stop="restoreRow(item.props.title.id)"
            >
              <v-icon>mdi-restore</v-icon>
            </v-btn>
          </template>
        </v-data-table>
        <div class="table-info d-flex justify-end">
          Records deleted when more than 6 attributes were reset or manually selected
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from "vue";
import TableRowUpdate from "./tableRowUpdate.vue";
import { useDataStore } from "@/store/index";

const store = useDataStore();
const itemsPerPage = ref(10);
const selectedDeletedRows = ref([]);

const tableHeaders = ref([
  { title: "ID", align: "start", key: "id" },
  { title: "Status", align: "center", key: "status" },
  { title: "Decision", align: "center", key: "decision" },
  { title: "Radius", align: "center", key: "radius" },
  { title: "Texture", align: "center", key: "texture" },
  { title: "Perimeter", align: "center", key: "perimeter" },
  { title: "Area", align: "center", key: "area" },
  { title: "Smoothness", align: "center", key: "smoothness" },
  { title: "Compactness", align: "center", key: "compactness" },
  { title: "Concavity", align: "center", key: "concavity" },
  { title: "Concave Points", align: "center", key: "concavePoints" },
  { title: "Symmetry", align: "center", key: "symmetry" },
  { title: "Fractal Dimension", align: "center", key: "fractalDimension" },
]);

const deletedTableHeaders = ref([
  { title: "", key: "data-table-select", width: "40px" },
  { title: "ID", align: "start", key: "id" },
  { title: "Status", align: "center", key: "status" },
  { title: "Decision", align: "center", key: "decision" },
  { title: "Deleted At", align: "center", key: "deletedAt" },
  { title: "Deleted Attributes", align: "center", key: "deletedAttributes" },
  { title: "Actions", align: "center", key: "actions", sortable: false },
]);

const activeTableItems = computed(() =>
  store.getTableItems.filter((item) => item.status !== "deleted")
);

const deletedTableItems = computed(() => store.getDeletedRows);

const fullDeletionsCount = computed(
  () => store.getDeletedRows.filter((row) => row.fullRowDeleted).length
);

const partialDeletionsCount = computed(
  () => store.getDeletedRows.filter((row) => !row.fullRowDeleted).length
);

function getRowChipColor(row) {
  const status = row.props?.title?.status;
  if (status === "removed") return "error";
  if (status === "restored") return "primary";
  if (status === "updated") return "blue";
  return "green";
}

function getRowChipText(row) {
  const status = row.props?.title?.status;
  if (status === "removed") return "deleted";
  if (status === "restored") return "restored";
  if (status === "updated") return "updated";
  return "active";
}

function handleStatusClick(item) {
  if (item.props?.title?.status === "deleted") {
    restoreRow(item.props.title.id);
  }
}

function updateRow(row, itemID) {
  let updateData = {
    id: itemID,
    row: { status: "updated", ...row },
  };
  store.updateRow(updateData);
}

function restoreRow(rowId) {
  store.restoreRow(rowId);
  selectedDeletedRows.value = selectedDeletedRows.value.filter((id) => id !== rowId);
}

function restoreSelected() {
  selectedDeletedRows.value.forEach((id) => {
    store.restoreRow(id);
  });
  selectedDeletedRows.value = [];
}
</script>

<style scoped lang="scss">
.data-container {
  padding: 20px;
}

.data-tables {
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
}

.data-table,
.deleted-table {
  overflow: hidden;
}

.data__table,
.deleted__table {
  border: 1px solid white;
  -webkit-box-shadow: 1px 3px 24px 3px rgba(66, 68, 90, 1);
  -moz-box-shadow: 1px 3px 24px 3px rgba(66, 68, 90, 1);
  box-shadow: 1px 3px 24px 3px rgba(66, 68, 90, 1);
}

.table-info {
  padding: 8px;
  font-size: 0.8rem;
  color: #aaa;
}

::v-deep .v-data-table {
  &__tr:hover {
    color: white;
    font-weight: bold;
  }
}
</style>

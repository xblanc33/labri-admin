<template>
  <section class="structures">
    <header class="page-header">
      <div>
        <h2>Structures</h2>
        <p>Visualisez les structures de chaque laboratoire ainsi que leurs dépendances.</p>
      </div>
      <button class="secondary" @click="loadStructures" :disabled="loading">
        <span v-if="loading">Actualisation…</span>
        <span v-else>Actualiser</span>
      </button>
    </header>

    <div v-if="loading" class="panel info">
      Chargement des structures…
    </div>
    <div v-else-if="error" class="panel error">
      <p>{{ error }}</p>
      <button class="primary" @click="loadStructures">Réessayer</button>
    </div>
    <template v-else>
      <article
        v-for="group in structuresByLab"
        :key="group.id"
        class="panel"
      >
        <h3>{{ group.nom }}</h3>
        <div class="table-wrapper">
          <table class="structures-table">
            <thead>
              <tr>
                <th>Structure</th>
                <th>Acronyme</th>
                <th>Type</th>
                <th>Structure parente</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="structure in group.items" :key="structure.id">
                <td>
                  <RouterLink :to="`/structures/${structure.id}`">
                    {{ structure.nom }}
                  </RouterLink>
                </td>
                <td>{{ structure.acronyme }}</td>
                <td>{{ structure.kind_nom }}</td>
                <td>
                  <span v-if="structure.parent_nom">{{ structure.parent_nom }}</span>
                  <span v-else>—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>
    </template>
  </section>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { RouterLink } from "vue-router";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

const structures = ref([]);
const loading = ref(false);
const error = ref("");

async function loadStructures() {
  loading.value = true;
  error.value = "";
  try {
    const response = await fetch(`${API_BASE}/structures`);
    if (!response.ok) {
      const details = await response.json().catch(() => ({}));
      throw new Error(details.error || `Erreur (${response.status})`);
    }
    const data = await response.json();
    structures.value = data;
  } catch (err) {
    error.value = err.message ?? "Impossible de charger les structures.";
  } finally {
    loading.value = false;
  }
}

const structuresByLab = computed(() => {
  const map = new Map();
  structures.value.forEach((structure) => {
    if (!map.has(structure.laboratoire)) {
      map.set(structure.laboratoire, {
        id: structure.laboratoire,
        nom: structure.laboratoire_nom,
        items: [],
      });
    }
    map.get(structure.laboratoire).items.push(structure);
  });

  map.forEach((group) => {
    group.items.sort((a, b) => {
      if (a.structure_parent === b.structure_parent) {
        return a.nom.localeCompare(b.nom);
      }
      if (a.structure_parent == null) return -1;
      if (b.structure_parent == null) return 1;
      return a.structure_parent - b.structure_parent;
    });
  });

  return Array.from(map.values()).sort((a, b) => a.nom.localeCompare(b.nom));
});

onMounted(() => {
  loadStructures();
});
</script>

<style scoped>
.structures {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.panel {
  background: #ffffff;
  border-radius: 12px;
  padding: 1.75rem;
  box-shadow: 0 10px 30px rgba(20, 33, 61, 0.08);
}

.panel.info {
  text-align: center;
}

.panel.error {
  border-left: 4px solid #dc2626;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.table-wrapper {
  overflow-x: auto;
}

.structures-table {
  width: 100%;
  border-collapse: collapse;
}

.structures-table th,
.structures-table td {
  padding: 0.75rem 1rem;
  text-align: left;
  border-bottom: 1px solid rgba(20, 33, 61, 0.08);
}

.structures-table th {
  background: rgba(20, 33, 61, 0.05);
  font-weight: 600;
}

.structures-table a {
  color: #14213d;
  text-decoration: none;
  font-weight: 600;
}

.structures-table a:hover {
  text-decoration: underline;
}

.primary,
.secondary {
  border: none;
  border-radius: 999px;
  padding: 0.6rem 1.2rem;
  font-weight: 600;
  cursor: pointer;
}

.primary {
  background: #fca311;
  color: #14213d;
}

.secondary {
  background: #e5e7eb;
  color: #14213d;
}

@media (max-width: 760px) {
  .page-header {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>

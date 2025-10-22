<template>
  <section class="structure-detail">
    <header class="page-header">
      <div>
        <h2>{{ structure?.nom || "Structure" }}</h2>
        <p v-if="structure" class="subtitle">
          Type : <strong>{{ structure.kind_nom }}</strong> — Acronyme :
          <strong>{{ structure.acronyme }}</strong>
        </p>
        <p v-if="structure" class="subtitle">
          Laboratoire :
          <strong>{{ structure.laboratoire_nom }}</strong>
        </p>
      </div>
      <RouterLink class="secondary" to="/structures">Retour</RouterLink>
    </header>

    <div v-if="loading" class="panel info">Chargement…</div>
    <div v-else-if="error" class="panel error">
      <p>{{ error }}</p>
      <button class="primary" @click="loadData">Réessayer</button>
    </div>

    <template v-else-if="structure">
      <article class="panel">
        <h3>Détails</h3>
        <dl class="details">
          <div>
            <dt>Type</dt>
            <dd>{{ structure.kind_nom }}</dd>
          </div>
          <div>
            <dt>Acronyme</dt>
            <dd>{{ structure.acronyme }}</dd>
          </div>
          <div>
            <dt>Structure parente</dt>
            <dd>
              <RouterLink
                v-if="structure.structure_parent"
                :to="`/structures/${structure.structure_parent}`"
              >
                {{ structure.parent_nom }}
              </RouterLink>
              <span v-else>—</span>
            </dd>
          </div>
          <div>
            <dt>Date de création</dt>
            <dd>{{ formatDate(structure.date_creation) }}</dd>
          </div>
        </dl>
      </article>

      <article class="panel">
        <div class="panel-header">
          <h3>Personnes affectées</h3>
          <span v-if="personnes.length">{{ personnes.length }} personne(s)</span>
        </div>
        <div v-if="!personnes.length" class="empty">
          Aucune personne n'est affectée à cette structure.
        </div>
        <div v-else class="table-wrapper">
          <table class="people-table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Prénom</th>
                <th>Sexe</th>
                <th>Nationalité</th>
                <th>Date de naissance</th>
                <th>Date d'affectation</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="personne in personnes" :key="personne.id">
                <td>{{ personne.nom }}</td>
                <td>{{ personne.prenom }}</td>
                <td>{{ renderSexe(personne.sexe) }}</td>
                <td>{{ personne.nationalite_nom || "—" }}</td>
                <td>{{ formatDate(personne.date_naissance) }}</td>
                <td>{{ formatDate(personne.date_debut) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>
    </template>
  </section>
</template>

<script setup>
import { ref, onMounted, watch } from "vue";
import { RouterLink, useRoute } from "vue-router";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

const route = useRoute();
const structureId = ref(route.params.structureId);

const structure = ref(null);
const personnes = ref([]);
const loading = ref(false);
const error = ref("");

async function fetchJSON(url) {
  const response = await fetch(url);
  if (!response.ok) {
    const details = await response.json().catch(() => ({}));
    throw new Error(details.error || `Erreur (${response.status})`);
  }
  return response.json();
}

function renderSexe(id) {
  switch (id) {
    case 1:
      return "Femme";
    case 2:
      return "Homme";
    case 3:
      return "Autre";
    default:
      return "—";
  }
}

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

async function loadData() {
  const id = parseInt(structureId.value, 10);
  if (Number.isNaN(id)) {
    error.value = "Identifiant de structure invalide.";
    return;
  }
  loading.value = true;
  error.value = "";
  try {
    const [structureData, personnesData] = await Promise.all([
      fetchJSON(`${API_BASE}/structures/${id}`),
      fetchJSON(`${API_BASE}/structures/${id}/personnes`),
    ]);
    structure.value = structureData;
    personnes.value = personnesData;
  } catch (err) {
    error.value = err.message ?? "Impossible de charger la structure.";
    structure.value = null;
    personnes.value = [];
  } finally {
    loading.value = false;
  }
}

onMounted(loadData);

watch(
  () => route.params.structureId,
  (newId) => {
    structureId.value = newId;
    loadData();
  }
);
</script>

<style scoped>
.structure-detail {
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

.subtitle {
  margin: 0.25rem 0 0;
  color: #4b5563;
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

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.details {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem 1.5rem;
  margin: 0;
}

.details dt {
  font-weight: 600;
  color: #14213d;
}

.details dd {
  margin: 0.25rem 0 0;
  color: #4b5563;
}

.table-wrapper {
  overflow-x: auto;
  margin-top: 1rem;
}

.people-table {
  width: 100%;
  border-collapse: collapse;
}

.people-table th,
.people-table td {
  padding: 0.75rem 1rem;
  text-align: left;
  border-bottom: 1px solid rgba(20, 33, 61, 0.08);
}

.people-table th {
  background: rgba(20, 33, 61, 0.05);
  font-weight: 600;
}

.empty {
  color: #6b7280;
  font-style: italic;
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
  text-decoration: none;
  display: inline-flex;
  align-items: center;
}

@media (max-width: 760px) {
  .page-header {
    flex-direction: column;
    align-items: stretch;
  }

  .panel-header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>

<template>
  <section class="labs">
    <header class="page-header">
      <div>
        <h2>Laboratoires</h2>
        <p>
          Créez de nouveaux laboratoires, consultez les fiches existantes et
          complétez la hiérarchie avec les tutelles et structures associées.
        </p>
      </div>
      <button class="secondary" @click="refresh" :disabled="loading">
        <span v-if="loading">Actualisation…</span>
        <span v-else>Actualiser la liste</span>
      </button>
    </header>

    <article class="panel">
      <h3>Ajouter un laboratoire</h3>
      <form class="form-grid" @submit.prevent="createLaboratory">
        <label>
          Nom
          <input v-model="labForm.nom" type="text" required />
        </label>
        <label>
          Acronyme
          <input v-model="labForm.acronyme" type="text" required />
        </label>
        <label>
          Numéro
          <input v-model.number="labForm.numero" type="number" min="0" required />
        </label>
        <label>
          Date de création
          <input v-model="labForm.date_creation" type="date" required />
        </label>
        <button class="primary" type="submit" :disabled="creatingLab">
          <span v-if="creatingLab">Enregistrement…</span>
          <span v-else>Créer le laboratoire</span>
        </button>
      </form>
    </article>

    <article class="panel">
      <h3>Laboratoires enregistrés</h3>
      <ul class="lab-list">
        <li
          v-for="lab in labs"
          :key="lab.id"
          :class="{ active: selectedLabId === lab.id }"
        >
          <button @click="selectLaboratory(lab.id)">
            <span class="lab-name">{{ lab.nom }}</span>
            <span class="lab-meta">#{{ lab.numero }} • {{ lab.acronyme }}</span>
          </button>
        </li>
      </ul>
      <p v-if="!labs.length && !loading" class="empty">
        Aucun laboratoire pour le moment. Ajoutez-en un à l’aide du formulaire ci-dessus.
      </p>
    </article>

    <article v-if="selectedLab" class="panel detail">
      <header class="detail-header">
        <div>
          <h3>{{ selectedLab.nom }}</h3>
          <p>
            Acronyme <strong>{{ selectedLab.acronyme }}</strong> — Numéro
            <strong>{{ selectedLab.numero }}</strong>
          </p>
          <p>
            Créé le
            <strong>{{ formatDate(selectedLab.date_creation) }}</strong>
          </p>
        </div>
        <button class="danger" @click="deleteLaboratory" :disabled="deletingLab">
          <span v-if="deletingLab">Suppression…</span>
          <span v-else>Supprimer le laboratoire</span>
        </button>
      </header>

      <section class="subsection">
        <h4>Tutelles</h4>
        <form class="inline-form" @submit.prevent="createTutelle">
          <label>
            Tutelle
            <select v-model="tutelleForm.etablissement" required>
              <option value="" disabled>Choisir une tutelle</option>
              <option
                v-for="etablissement in etablissements"
                :key="etablissement.id"
                :value="etablissement.id"
              >
                {{ etablissement.etablissement }}
              </option>
            </select>
          </label>
          <button
            class="primary"
            type="submit"
            :disabled="creatingTutelle || !etablissements.length"
          >
            <span v-if="creatingTutelle">Ajout…</span>
            <span v-else>Ajouter la tutelle</span>
          </button>
        </form>
        <ul class="child-list">
          <li v-for="tutelle in tutelles" :key="tutelle.id">
            <span>ID {{ tutelle.id }} → {{ tutelle.nom_etablissement }}</span>
            <button
              class="link danger"
              @click="deleteTutelle(tutelle.id)"
              :disabled="deletingTutelleId === tutelle.id"
            >
              <span v-if="deletingTutelleId === tutelle.id">Suppression…</span>
              <span v-else>Retirer</span>
            </button>
          </li>
        </ul>
      </section>

      <section class="subsection">
        <h4>Structures</h4>
        <form class="form-grid" @submit.prevent="createStructure">
          <label>
            Nom
            <input v-model="structureForm.nom" type="text" required />
          </label>
          <label>
            Acronyme
            <input v-model="structureForm.acronyme" type="text" required />
          </label>
          <label>
            Type
            <select
              v-model="structureForm.kind"
              :disabled="!structureKinds.length"
              required
            >
              <option value="" disabled>Choisir un type</option>
              <option
                v-for="kind in structureKinds"
                :key="kind.id"
                :value="kind.id"
              >
                {{ kind.nom }}
              </option>
            </select>
          </label>
          <label>
            Structure parente
            <select v-model="structureForm.structure_parent">
              <option value="">(aucune)</option>
              <option
                v-for="structure in structures"
                :key="structure.id"
                :value="structure.id"
              >
                {{ structure.nom }}
              </option>
            </select>
          </label>
          <label>
            Date de création
            <input v-model="structureForm.date_creation" type="date" required />
          </label>
          <button
            class="primary"
            type="submit"
            :disabled="creatingStructure || !structureKinds.length"
          >
            <span v-if="creatingStructure">Enregistrement…</span>
            <span v-else>Créer la structure</span>
          </button>
        </form>
        <div v-if="structureKinds.length" class="filter-group">
          <span class="filter-label">Filtrer par type :</span>
          <div class="filter-options">
            <label
              v-for="kind in structureKinds"
              :key="kind.id"
              class="filter-chip"
            >
              <input
                type="checkbox"
                :value="kind.id"
                v-model="selectedStructureKinds"
              />
              <span>{{ kind.nom }}</span>
            </label>
          </div>
        </div>
        <ul class="child-list">
          <li v-for="structure in filteredStructures" :key="structure.id">
            <div class="structure-info">
              <strong>{{ structure.nom }}</strong>
              <span class="structure-meta">
                {{ structure.kind_nom }} · {{ structure.acronyme }} ·
                {{
                  structure.structure_parent
                    ? `Parent n°${structure.structure_parent}`
                    : "Racine"
                }}
                · {{ formatDate(structure.date_creation) }}
              </span>
            </div>
            <button
              class="link danger"
              @click="deleteStructure(structure.id)"
              :disabled="deletingStructureId === structure.id"
            >
              <span v-if="deletingStructureId === structure.id">Suppression…</span>
              <span v-else>Retirer</span>
            </button>
          </li>
        </ul>
        <p v-if="structures.length && !filteredStructures.length" class="empty">
          Aucune structure ne correspond aux filtres sélectionnés.
        </p>
      </section>
    </article>

    <p v-if="error" class="error-banner">{{ error }}</p>
  </section>
</template>

<script setup>
import { computed, reactive, ref, onMounted, watch } from "vue";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

const labs = ref([]);
const loading = ref(false);
const error = ref("");

const selectedLabId = ref(null);
const selectedLab = ref(null);
const creatingLab = ref(false);
const deletingLab = ref(false);

const tutelles = ref([]);
const structures = ref([]);
const creatingTutelle = ref(false);
const deletingTutelleId = ref(null);
const etablissements = ref([]);
const structureKinds = ref([]);
const selectedStructureKinds = ref([]);

const creatingStructure = ref(false);
const deletingStructureId = ref(null);

const labForm = reactive({
  nom: "",
  acronyme: "",
  numero: null,
  date_creation: "",
});

const tutelleForm = reactive({
  etablissement: "",
});

const structureForm = reactive({
  nom: "",
  acronyme: "",
  kind: "",
  structure_parent: "",
  date_creation: "",
});

const fetchOpts = computed(() => ({
  headers: {
    "Content-Type": "application/json",
  },
}));

const filteredStructures = computed(() => {
  if (!selectedStructureKinds.value.length) {
    return structures.value;
  }
  const activeKinds = selectedStructureKinds.value.map((id) => Number(id));
  return structures.value.filter((structure) =>
    activeKinds.includes(Number(structure.kind))
  );
});

async function loadEtablissements() {
  try {
    const response = await fetch(`${API_BASE}/etablissements`);
    if (!response.ok) {
      throw new Error("Impossible de récupérer la liste des établissements");
    }
    etablissements.value = await response.json();
  } catch (err) {
    console.error(err);
    error.value =
      err.message ?? "Impossible de récupérer la liste des établissements.";
    etablissements.value = [];
  }
}

async function loadStructureKinds() {
  try {
    const response = await fetch(`${API_BASE}/structures-kinds`);
    if (!response.ok) {
      throw new Error("Impossible de récupérer la liste des types de structures");
    }
    structureKinds.value = await response.json();
  } catch (err) {
    console.error(err);
    error.value =
      err.message ?? "Impossible de récupérer la liste des types de structures.";
    structureKinds.value = [];
  }
}

async function refresh() {
  loading.value = true;
  error.value = "";
  try {
    const response = await fetch(`${API_BASE}/laboratoires`);
    if (!response.ok) {
      throw new Error(`Impossible de charger les laboratoires (${response.status})`);
    }
    labs.value = await response.json();
  } catch (err) {
    console.error(err);
    error.value = err.message ?? "Chargement des laboratoires impossible.";
  } finally {
    loading.value = false;
  }
}

async function createLaboratory() {
  creatingLab.value = true;
  error.value = "";
  try {
    const payload = {
      ...labForm,
      numero:
        typeof labForm.numero === "number"
          ? labForm.numero
          : Number.parseInt(labForm.numero, 10),
    };
    const response = await fetch(`${API_BASE}/laboratoires`, {
      method: "POST",
      ...fetchOpts.value,
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const details = await response.json().catch(() => ({}));
      throw new Error(details.error || "Création du laboratoire impossible.");
    }
    resetLabForm();
    await refresh();
  } catch (err) {
    console.error(err);
    error.value = err.message ?? "Création du laboratoire impossible.";
  } finally {
    creatingLab.value = false;
  }
}

function resetLabForm() {
  labForm.nom = "";
  labForm.acronyme = "";
  labForm.numero = null;
  labForm.date_creation = "";
}

async function selectLaboratory(id) {
  if (!id) return;
  selectedLabId.value = id;
  await Promise.all([loadLaboratory(id), loadTutelles(id), loadStructures(id)]);
}

async function loadLaboratory(id) {
  try {
    const response = await fetch(`${API_BASE}/laboratoires/${id}`);
    if (!response.ok) {
      throw new Error("Impossible de récupérer les détails du laboratoire");
    }
    selectedLab.value = await response.json();
  } catch (err) {
    console.error(err);
    error.value = err.message ?? "Impossible de récupérer les détails du laboratoire.";
    selectedLab.value = null;
  }
}

async function deleteLaboratory() {
  if (!selectedLabId.value) return;
  if (!confirm("Supprimer ce laboratoire ainsi que les enregistrements associés ?")) return;

  deletingLab.value = true;
  try {
    const response = await fetch(
      `${API_BASE}/laboratoires/${selectedLabId.value}`,
      {
        method: "DELETE",
      }
    );
    if (!response.ok && response.status !== 204) {
      throw new Error("Suppression du laboratoire impossible");
    }
    selectedLabId.value = null;
    selectedLab.value = null;
    tutelles.value = [];
    structures.value = [];
    await refresh();
  } catch (err) {
    console.error(err);
    error.value = err.message ?? "Suppression du laboratoire impossible.";
  } finally {
    deletingLab.value = false;
  }
}

async function loadTutelles(id) {
  try {
    const response = await fetch(`${API_BASE}/laboratoires/${id}/tutelles`);
    if (!response.ok) {
      throw new Error("Impossible de récupérer les tutelles");
    }
    tutelles.value = await response.json();
  } catch (err) {
    console.error(err);
    error.value = err.message ?? "Impossible de récupérer les tutelles.";
    tutelles.value = [];
  }
}

async function createTutelle() {
  if (!selectedLabId.value) return;
  creatingTutelle.value = true;
  error.value = "";

  try {
    if (!tutelleForm.etablissement) {
      throw new Error("Veuillez sélectionner une tutelle.");
    }
    const payload = {
      etablissement: Number.parseInt(tutelleForm.etablissement, 10),
    };
    const response = await fetch(
      `${API_BASE}/laboratoires/${selectedLabId.value}/tutelles`,
      {
        method: "POST",
        ...fetchOpts.value,
        body: JSON.stringify(payload),
      }
    );
    if (!response.ok) {
      const details = await response.json().catch(() => ({}));
      throw new Error(details.error || "Création de la tutelle impossible.");
    }
    tutelleForm.etablissement = "";
    await loadTutelles(selectedLabId.value);
  } catch (err) {
    console.error(err);
    error.value = err.message ?? "Création de la tutelle impossible.";
  } finally {
    creatingTutelle.value = false;
  }
}

async function deleteTutelle(id) {
  if (!selectedLabId.value) return;
  deletingTutelleId.value = id;
  try {
    const response = await fetch(
      `${API_BASE}/laboratoires/${selectedLabId.value}/tutelles/${id}`,
      {
        method: "DELETE",
      }
    );
    if (!response.ok && response.status !== 204) {
      throw new Error("Suppression de la tutelle impossible");
    }
    await loadTutelles(selectedLabId.value);
  } catch (err) {
    console.error(err);
    error.value = err.message ?? "Suppression de la tutelle impossible.";
  } finally {
    deletingTutelleId.value = null;
  }
}

async function loadStructures(id) {
  try {
    const response = await fetch(`${API_BASE}/laboratoires/${id}/structures`);
    if (!response.ok) {
      throw new Error("Impossible de récupérer les structures");
    }
    structures.value = await response.json();
  } catch (err) {
    console.error(err);
    error.value = err.message ?? "Impossible de récupérer les structures.";
    structures.value = [];
  }
}

async function createStructure() {
  if (!selectedLabId.value) return;
  creatingStructure.value = true;
  error.value = "";

  try {
    if (!structureForm.kind) {
      throw new Error("Veuillez sélectionner un type de structure.");
    }
    const payload = {
      nom: structureForm.nom,
      acronyme: structureForm.acronyme,
      kind: Number.parseInt(structureForm.kind, 10),
      structure_parent:
        structureForm.structure_parent === "" ||
        structureForm.structure_parent === null
          ? null
          : Number.parseInt(structureForm.structure_parent, 10),
      date_creation: structureForm.date_creation,
    };
    if (Number.isNaN(payload.kind)) {
      throw new Error("Type de structure invalide");
    }
    const response = await fetch(
      `${API_BASE}/laboratoires/${selectedLabId.value}/structures`,
      {
        method: "POST",
        ...fetchOpts.value,
        body: JSON.stringify(payload),
      }
    );
    if (!response.ok) {
      const details = await response.json().catch(() => ({}));
      throw new Error(details.error || "Création de la structure impossible.");
    }
    resetStructureForm();
    await loadStructures(selectedLabId.value);
  } catch (err) {
    console.error(err);
    error.value = err.message ?? "Création de la structure impossible.";
  } finally {
    creatingStructure.value = false;
  }
}

function resetStructureForm() {
  structureForm.nom = "";
  structureForm.acronyme = "";
  structureForm.kind = "";
  structureForm.structure_parent = "";
  structureForm.date_creation = "";
}

async function deleteStructure(id) {
  if (!selectedLabId.value) return;
  deletingStructureId.value = id;
  try {
    const response = await fetch(
      `${API_BASE}/laboratoires/${selectedLabId.value}/structures/${id}`,
      {
        method: "DELETE",
      }
    );
    if (!response.ok && response.status !== 204) {
      throw new Error("Suppression de la structure impossible");
    }
    await loadStructures(selectedLabId.value);
  } catch (err) {
    console.error(err);
    error.value = err.message ?? "Suppression de la structure impossible.";
  } finally {
    deletingStructureId.value = null;
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

watch(selectedLabId, (value) => {
  if (!value) {
    selectedLab.value = null;
    tutelles.value = [];
    structures.value = [];
    selectedStructureKinds.value = [];
    tutelleForm.etablissement = "";
    resetStructureForm();
  }
});

onMounted(() => {
  loadEtablissements();
  loadStructureKinds();
  refresh();
});
</script>

<style scoped>
.labs {
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

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1.25rem;
  margin-top: 1rem;
}

label {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  font-weight: 600;
  color: #14213d;
}

input,
select {
  border: 1px solid rgba(20, 33, 61, 0.15);
  border-radius: 0.65rem;
  padding: 0.5rem 0.75rem;
  font-size: 1rem;
  transition: border 0.2s ease;
}

input:focus,
select:focus {
  outline: none;
  border-color: #fca311;
}

.primary,
.secondary,
.danger {
  padding: 0.6rem 1.2rem;
  border-radius: 999px;
  border: none;
  font-weight: 600;
  font-size: 0.95rem;
  color: #14213d;
  background: #fca311;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.primary:disabled,
.secondary:disabled,
.danger:disabled {
  opacity: 0.65;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.secondary {
  background: #e5e7eb;
}

.danger {
  background: #ef4444;
  color: white;
}

.lab-list {
  list-style: none;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 0.75rem;
  padding: 0;
  margin: 1rem 0 0;
}

.lab-list li button {
  width: 100%;
  border-radius: 0.9rem;
  border: 1px solid rgba(20, 33, 61, 0.12);
  background: #ffffff;
  padding: 1rem;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  transition: border 0.2s ease, transform 0.15s ease;
}

.lab-list li.active button,
.lab-list li button:hover {
  border-color: #fca311;
  transform: translateY(-2px);
}

.lab-name {
  font-weight: 600;
  color: #14213d;
}

.lab-meta {
  color: #4b5563;
  font-size: 0.95rem;
}

.empty {
  margin-top: 1rem;
  color: #6b7280;
}

.detail {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1.5rem;
}

.subsection {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.inline-form {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: flex-end;
}

.inline-form label {
  flex: 1 1 180px;
}

.filter-group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem;
  margin: 1.5rem 0 1rem;
}

.filter-label {
  font-weight: 600;
  color: #14213d;
}

.filter-options {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(20, 33, 61, 0.08);
  border-radius: 999px;
  padding: 0.35rem 0.9rem;
  font-weight: 500;
}

.filter-chip input {
  accent-color: #fca311;
}

.child-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.child-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  border-radius: 0.85rem;
  background: rgba(20, 33, 61, 0.03);
}

.structure-info {
  display: flex;
  flex-direction: column;
}

.structure-meta {
  color: #4b5563;
  font-size: 0.9rem;
}

.link {
  background: none;
  border: none;
  color: inherit;
  text-decoration: underline;
  padding: 0;
}

.error-banner {
  padding: 1rem 1.25rem;
  border-radius: 0.75rem;
  background: rgba(239, 68, 68, 0.12);
  color: #b91c1c;
  font-weight: 600;
}

@media (max-width: 760px) {
  .page-header {
    flex-direction: column;
    align-items: stretch;
  }

  .detail-header {
    flex-direction: column-reverse;
    align-items: stretch;
  }
}
</style>

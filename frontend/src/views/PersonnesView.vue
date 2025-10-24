<template>
  <section class="people">
    <header class="page-header">
      <div>
        <h2>Personnes</h2>
        <p>Consultez et gérez les personnes référencées dans la base.</p>
      </div>
      <div class="filters">
        <div class="filter-row">
          <label class="filter-field">
            <span>Recherche</span>
            <input
              v-model="search"
              type="search"
              placeholder="Nom ou prénom…"
              @input="debouncedRefresh"
            />
          </label>
          <label class="filter-field">
            <span>Laboratoire</span>
            <select v-model="selectedLaboratoire" @change="loadPersonnes">
              <option value="">Tous</option>
              <option
                v-for="lab in laboratoires"
                :key="lab.id"
                :value="lab.id"
              >
                {{ lab.nom }}
              </option>
            </select>
          </label>
        </div>
        <button class="primary" @click="openCreateDialog">Ajouter</button>
      </div>
    </header>

    <article class="panel">
      <table class="people-table">
        <thead>
          <tr>
            <th>Nom</th>
            <th>Prénom</th>
            <th>Sexe</th>
            <th>Nationalité</th>
            <th>Date de naissance</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="personne in personnes" :key="personne.id">
            <td>
              <RouterLink :to="`/personnes/${personne.id}`">
                {{ personne.nom }}
              </RouterLink>
            </td>
            <td>
              <RouterLink :to="`/personnes/${personne.id}`">
                {{ personne.prenom }}
              </RouterLink>
            </td>
            <td>{{ renderSexe(personne.sexe) }}</td>
            <td>
              {{
                personne.nationalite_nom ?? renderNationalite(personne.nationalite)
              }}
            </td>
            <td>{{ formatDate(personne.date_naissance) }}</td>
            <td class="actions-cell">
              <button class="link" @click="openEditDialog(personne)">
                Modifier
              </button>
              <button
                class="link danger"
                @click="deletePersonne(personne)"
                :disabled="deletingId === personne.id"
              >
                <span v-if="deletingId === personne.id">Suppression…</span>
                <span v-else>Supprimer</span>
              </button>
            </td>
          </tr>
          <tr v-if="!personnes.length">
            <td colspan="6" class="empty">
              Aucun résultat. Ajustez la recherche ou ajoutez une personne.
            </td>
          </tr>
        </tbody>
      </table>
    </article>

    <dialog ref="dialogRef">
      <form class="dialog-form" @submit.prevent="submitForm">
        <h3 v-if="editingPersonne">Modifier la personne</h3>
        <h3 v-else>Ajouter une personne</h3>

        <label>
          Nom
          <input v-model="form.nom" type="text" required />
        </label>
        <label>
          Prénom
          <input v-model="form.prenom" type="text" required />
        </label>
        <label>
          Sexe
          <select v-model.number="form.sexe" required>
            <option v-for="sexe in sexes" :key="sexe.id" :value="sexe.id">
              {{ sexe.sexe }}
            </option>
          </select>
        </label>
        <label>
          Nationalité
          <select v-model="form.nationalite">
            <option :value="null">Non renseignée</option>
            <option
              v-for="nation in nationalites"
              :key="nation.id"
              :value="nation.id"
            >
              {{ nation.nationalite }}
            </option>
          </select>
        </label>
        <label>
          Date de naissance
          <input v-model="form.date_naissance" type="date" />
        </label>

        <footer class="dialog-actions">
          <button type="button" class="secondary" @click="closeDialog">
            Annuler
          </button>
          <button class="primary" type="submit" :disabled="saving">
            <span v-if="saving">Enregistrement…</span>
            <span v-else>Enregistrer</span>
          </button>
        </footer>
      </form>
    </dialog>

    <p v-if="error" class="error-banner">{{ error }}</p>
  </section>
</template>

<script setup>
import { ref, reactive, onMounted, defineProps, watch } from "vue";
import { RouterLink } from "vue-router";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

const props = defineProps({
  period: {
    type: Object,
    default: () => ({ start: "", end: "" }),
  },
});

const personnes = ref([]);
const nationalites = ref([]);
const sexes = ref([]);
const laboratoires = ref([]);
const selectedLaboratoire = ref("");
const search = ref("");
const error = ref("");
const loading = ref(false);
const saving = ref(false);
const deletingId = ref(null);

const dialogRef = ref(null);
const editingPersonne = ref(null);

const form = reactive({
  nom: "",
  prenom: "",
  sexe: 2,
  nationalite: null,
  date_naissance: "",
});

function normalizeDate(value) {
  if (!value) return "";
  try {
    return new Date(value).toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

async function fetchJSON(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const details = await response.json().catch(() => ({}));
    const message = details.error || `Erreur (${response.status})`;
    throw new Error(message);
  }
  return response.json();
}

async function loadPersonnes() {
  loading.value = true;
  error.value = "";
  try {
    const params = new URLSearchParams();
    if (search.value) {
      params.set("search", search.value);
    }
    if (selectedLaboratoire.value) {
      params.set("laboratoire", selectedLaboratoire.value);
    }
    const start = normalizeDate(props.period?.start);
    const end = normalizeDate(props.period?.end);
    if (start) {
      params.set("start", start);
    }
    if (end) {
      params.set("end", end);
    }
    const query = params.toString() ? `?${params.toString()}` : "";
    personnes.value = await fetchJSON(`${API_BASE}/personnes${query}`);
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

async function loadCatalogs() {
  try {
    nationalites.value = await fetchJSON(`${API_BASE}/nationalites`).catch(
      () => []
    );
  } catch {
    nationalites.value = [];
  }
  try {
    sexes.value = await fetchJSON(`${API_BASE}/sexes`).catch(() => [
      { id: 1, sexe: "femme" },
      { id: 2, sexe: "homme" },
      { id: 3, sexe: "autre" },
    ]);
  } catch {
    sexes.value = [
      { id: 1, sexe: "femme" },
      { id: 2, sexe: "homme" },
      { id: 3, sexe: "autre" },
    ];
  }
  try {
    laboratoires.value = await fetchJSON(
      `${API_BASE}/laboratoires`
    ).catch(() => []);
  } catch {
    laboratoires.value = [];
  }
}

function renderSexe(id) {
  const item = sexes.value.find((s) => s.id === id);
  return item ? item.sexe : "—";
}

function renderNationalite(id) {
  if (id == null) return "—";
  const item = nationalites.value.find((n) => n.id === id);
  return item ? item.nationalite : `#${id}`;
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

function resetForm() {
  form.nom = "";
  form.prenom = "";
  form.sexe = sexes.value[0]?.id ?? 2;
  form.nationalite = null;
  form.date_naissance = "";
}

function openCreateDialog() {
  editingPersonne.value = null;
  resetForm();
  dialogRef.value?.showModal();
}

function openEditDialog(personne) {
  editingPersonne.value = personne;
  form.nom = personne.nom;
  form.prenom = personne.prenom;
  form.sexe = personne.sexe;
  form.nationalite = personne.nationalite ?? null;
  form.date_naissance = personne.date_naissance ?? "";
  dialogRef.value?.showModal();
}

function closeDialog() {
  dialogRef.value?.close();
}

async function submitForm() {
  saving.value = true;
  error.value = "";
  try {
    const payload = {
      nom: form.nom,
      prenom: form.prenom,
      sexe: Number(form.sexe),
      nationalite:
        form.nationalite === "" || form.nationalite === null
          ? null
          : Number(form.nationalite),
      date_naissance: form.date_naissance || null,
    };

    if (editingPersonne.value) {
      await fetchJSON(`${API_BASE}/personnes/${editingPersonne.value.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetchJSON(`${API_BASE}/personnes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    closeDialog();
    await loadPersonnes();
  } catch (err) {
    error.value = err.message;
  } finally {
    saving.value = false;
  }
}

async function deletePersonne(personne) {
  if (!confirm(`Supprimer ${personne.nom} ${personne.prenom} ?`)) return;
  deletingId.value = personne.id;
  try {
    await fetch(`${API_BASE}/personnes/${personne.id}`, {
      method: "DELETE",
    }).then((response) => {
      if (!response.ok && response.status !== 204) {
        return response.json().then((data) => {
          throw new Error(data.error || "Suppression impossible");
        });
      }
    });
    await loadPersonnes();
  } catch (err) {
    error.value = err.message;
  } finally {
    deletingId.value = null;
  }
}

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

const debouncedRefresh = debounce(loadPersonnes, 300);

onMounted(async () => {
  await Promise.all([loadCatalogs(), loadPersonnes()]);
});

watch(
  () => [props.period?.start, props.period?.end],
  () => {
    loadPersonnes();
  }
);
</script>

<style scoped>
.people {
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

.filters {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  align-items: flex-end;
}

.filter-row {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.filter-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-weight: 600;
  color: #14213d;
}

.filter-field input,
.filter-field select {
  padding: 0.55rem 0.95rem;
  border-radius: 0.75rem;
  border: 1px solid rgba(20, 33, 61, 0.2);
  min-width: 200px;
}

.panel {
  background: #ffffff;
  border-radius: 12px;
  padding: 1.75rem;
  box-shadow: 0 10px 30px rgba(20, 33, 61, 0.08);
  overflow-x: auto;
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

.actions-cell {
  display: flex;
  gap: 0.75rem;
}

.empty {
  text-align: center;
  color: #6b7280;
  padding: 1.5rem 0;
}

.dialog-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-width: 320px;
}

.dialog-form label {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  font-weight: 600;
  color: #14213d;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1rem;
}

.primary,
.secondary,
.danger,
.link {
  cursor: pointer;
  font-weight: 600;
}

.primary {
  padding: 0.6rem 1.2rem;
  border: none;
  border-radius: 999px;
  background: #fca311;
  color: #14213d;
}

.secondary {
  border: none;
  border-radius: 999px;
  padding: 0.6rem 1.2rem;
  background: #e5e7eb;
  color: #14213d;
}

.link {
  background: none;
  border: none;
  text-decoration: underline;
  color: #1d4ed8;
}

.danger {
  color: #dc2626;
}

.error-banner {
  padding: 1rem 1.25rem;
  border-radius: 0.75rem;
  background: rgba(239, 68, 68, 0.12);
  color: #b91c1c;
  font-weight: 600;
}

dialog::backdrop {
  background: rgba(20, 33, 61, 0.35);
}

dialog {
  border: none;
  border-radius: 12px;
  padding: 1.5rem;
}

@media (max-width: 760px) {
  .page-header {
    flex-direction: column;
    align-items: stretch;
  }

  .filters {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>

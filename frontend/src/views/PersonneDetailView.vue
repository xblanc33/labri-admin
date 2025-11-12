<template>
  <section class="person-detail">
    <header class="page-header">
      <div>
        <h2 v-if="personne">{{ personne.nom }} {{ personne.prenom }}</h2>
        <h2 v-else>Personne</h2>
        <p v-if="personne" class="subtitle">
          Identifiant : <strong>{{ personne.id }}</strong>
        </p>
      </div>
      <RouterLink class="secondary" to="/personnes">Retour</RouterLink>
    </header>

    <div v-if="loading" class="panel info">Chargement…</div>
    <div v-else-if="error" class="panel error">
      <p>{{ error }}</p>
      <button class="primary" @click="loadAll">Réessayer</button>
    </div>

    <template v-else-if="personne">
      <article class="panel">
        <h3>Informations</h3>
        <form class="form-grid" @submit.prevent="submitForm">
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
          <div class="form-actions">
            <button class="primary" type="submit" :disabled="saving">
              <span v-if="saving">Enregistrement…</span>
              <span v-else>Enregistrer</span>
            </button>
          </div>
        </form>
      </article>

      <article class="panel">
        <div class="panel-header">
          <h3>Affectations laboratoires</h3>
          <button class="primary" @click="openLabDialog">Ajouter</button>
        </div>
        <div v-if="!labAssignments.length" class="empty">
          Aucune affectation.<br />Utilisez le bouton "Ajouter" pour en créer.
        </div>
        <ul v-else class="assignments-list">
          <li v-for="aff in labAssignments" :key="aff.id || `${aff.laboratoire}-${aff.date_debut}`">
            <div class="assignment-row">
              <div class="assignment-info">
                <strong>{{ aff.laboratoire_nom || 'Laboratoire #'+aff.laboratoire }}</strong>
                <span>{{ formatDate(aff.date_debut) }} → {{ formatDate(aff.date_fin) }}</span>
              </div>
              <div class="assignment-actions">
                <button class="link danger" @click="removeLabAssignment(aff)">Supprimer</button>
              </div>
            </div>
          </li>
        </ul>
      </article>

      <article class="panel">
        <div class="panel-header">
          <h3>Affectations structures</h3>
          <button class="primary" @click="openStructureDialog">Ajouter</button>
        </div>
        <div v-if="!structureAssignments.length" class="empty">
          Aucune affectation dans la période sélectionnée.
        </div>
        <ul v-else class="assignments-list">
          <li v-for="aff in structureAssignments" :key="aff.id || `${aff.structure_laboratoire}-${aff.date_debut}`">
            <div class="assignment-row">
              <div class="assignment-info">
                <strong>{{ aff.structure_nom }} ({{ aff.structure_acronyme }})</strong>
                <span>{{ aff.kind_nom }} • {{ formatDate(aff.date_debut) }} → {{ formatDate(aff.date_fin) }}</span>
              </div>
              <div class="assignment-actions">
                <button
                  v-if="aff.date_fin"
                  class="link"
                  @click="removeStructureAssignmentEnd(aff)"
                  :disabled="structureActionsLoading"
                >
                  Supprimer la fin
                </button>
                <button
                  class="link danger"
                  @click="removeStructureAssignment(aff)"
                  :disabled="structureActionsLoading"
                >
                  Supprimer
                </button>
              </div>
            </div>
          </li>
        </ul>
      </article>

      <article class="panel">
        <div class="panel-header">
          <h3>Emplois</h3>
          <div class="panel-actions">
            <span v-if="emplois.length">{{ emplois.length }} emploi(s)</span>
                <button class="primary" @click="openEmploymentDialog('add')">Ajouter</button>
          </div>
        </div>
        <div v-if="!emplois.length" class="empty">
          Aucun emploi enregistré pour cette personne.
        </div>
        <div v-else class="table-wrapper">
          <table class="people-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Corps</th>
                <th>Grade</th>
                <th>Établissement</th>
                <th>Date de début</th>
                <th>Date de fin</th>
                <th>Doctorat</th>
                <th>Durée</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="emploi in emplois" :key="emploi.id">
                <td>{{ emploi.type_label || renderEmploymentType(emploi.type) }}</td>
                <td>{{ emploi.corps_nom || lookupCorpsLabel(emploi.type, emploi.corps_id) || '—' }}</td>
                <td>{{ emploi.grade_nom || lookupGradeLabel(emploi.grade_id) || '—' }}</td>
                <td>{{ emploi.etablissement_nom || lookupEtablissementLabel(emploi.etablissement) || `Établissement #${emploi.etablissement}` }}</td>
                <td>{{ formatDate(emploi.date_debut) }}</td>
                <td>{{ formatDate(emploi.date_fin) }}</td>
                <td>{{ formatDoctoratDetails(emploi) }}</td>
                <td>
                  <span v-if="typeNeedsDuration(emploi.type)">
                    {{ formatMonths(emploi.duree_mois) }}
                  </span>
                  <span v-else>—</span>
                </td>
                <td class="actions-cell">
                  <button class="link" @click="openEmploymentDialog('edit', emploi)" :disabled="employmentSaving">Modifier</button>
                  <button
                    v-if="!emploi.date_fin"
                    class="link"
                    @click="addEmploymentEnd(emploi)"
                    :disabled="employmentSaving"
                  >
                    Clôturer
                  </button>
                  <button
                    v-else
                    class="link"
                    @click="removeEmploymentEnd(emploi)"
                    :disabled="employmentSaving"
                  >
                    Supprimer la fin
                  </button>
                  <button class="link danger" @click="removeEmployment(emploi)" :disabled="employmentSaving">Supprimer</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>

      <article class="panel">
        <div class="panel-header">
          <h3>HDR</h3>
        </div>
        <div v-if="!hdrs.length" class="empty">Aucune HDR enregistrée.</div>
        <ul v-else class="assignments-list">
          <li v-for="hdr in hdrs" :key="hdr.id">
            <div class="assignment-row">
              <div class="assignment-info">
                <strong>HDR</strong>
                <span>{{ formatDate(hdr.date_obtention) }}</span>
              </div>
            </div>
          </li>
        </ul>
      </article>

    <dialog ref="labDialog">
      <form class="dialog-form" @submit.prevent="submitLabAssignment">
        <h3>Gestion des affectations</h3>

        <div class="mode-switch">
          <label>
            <input
              type="radio"
              name="lab-mode"
              value="start"
              v-model="labForm.mode"
            />
            Nouvelle affectation
          </label>
          <label>
            <input
              type="radio"
              name="lab-mode"
              value="end"
              v-model="labForm.mode"
            />
            Fin d'affectation
          </label>
        </div>

        <template v-if="labForm.mode === 'start'">
          <label>
            Laboratoire
            <select v-model.number="labForm.laboratoire" required>
              <option value="" disabled>Sélectionner un laboratoire</option>
              <option v-for="lab in laboratoires" :key="lab.id" :value="lab.id">
                {{ lab.nom }} ({{ lab.acronyme }})
              </option>
            </select>
          </label>
          <label>
            Date d'affectation
            <input type="date" v-model="labForm.date_debut" required />
          </label>
        </template>

        <template v-else>
          <label>
            Affectation en cours
            <select
              v-model.number="labForm.affectation"
              :disabled="!openLabAssignments.length"
              required
            >
              <option value="" disabled>Sélectionner une affectation</option>
              <option
                v-for="aff in openLabAssignments"
                :key="aff.id"
                :value="aff.id"
              >
                {{ renderLabAssignment(aff) }}
              </option>
            </select>
          </label>
          <label>
            Date de fin
            <input
              type="date"
              v-model="labForm.date_fin"
              :disabled="!openLabAssignments.length"
              required
            />
          </label>
          <p v-if="!openLabAssignments.length" class="helper">
            Aucune affectation en cours à clôturer.
          </p>
        </template>

        <footer class="dialog-actions">
          <button type="button" class="secondary" @click="closeLabDialog">Annuler</button>
          <button class="primary" type="submit" :disabled="labSaving || !canSubmitLab">
            <span v-if="labSaving">Enregistrement…</span>
            <span v-else>{{ labForm.mode === 'start' ? 'Enregistrer' : 'Clôturer' }}</span>
          </button>
        </footer>
      </form>
    </dialog>

    <dialog ref="structureDialog">
      <form class="dialog-form" @submit.prevent="submitStructureAssignment">
        <h3>Gestion des affectations de structure</h3>

        <div class="mode-switch">
          <label>
            <input
              type="radio"
              name="structure-mode"
              value="start"
              v-model="structureForm.mode"
            />
            Nouvelle affectation
          </label>
          <label>
            <input
              type="radio"
              name="structure-mode"
              value="end"
              v-model="structureForm.mode"
            />
            Fin d'affectation
          </label>
        </div>

        <template v-if="structureForm.mode === 'start'">
          <label>
            Structure
            <select
              v-model.number="structureForm.structure"
              :disabled="!structures.length"
              required
            >
              <option value="" disabled>Sélectionner une structure</option>
              <option
                v-for="structure in structures"
                :key="structure.id"
                :value="structure.id"
              >
                {{ structure.nom }} ({{ structure.acronyme }}) • {{ structure.kind_nom }}
              </option>
            </select>
          </label>
          <label>
            Date d'affectation
            <input
              type="date"
              v-model="structureForm.date_debut"
              :disabled="!structures.length"
              required
            />
          </label>
          <p v-if="!structures.length" class="helper">
            Aucune structure disponible pour le moment.
          </p>
        </template>

        <template v-else>
          <label>
            Affectation en cours
            <select
              v-model.number="structureForm.affectation"
              :disabled="!openStructureAssignments.length"
              required
            >
              <option value="" disabled>Sélectionner une affectation</option>
              <option
                v-for="aff in openStructureAssignments"
                :key="aff.id"
                :value="aff.id"
              >
                {{ renderStructureAssignment(aff) }}
              </option>
            </select>
          </label>
          <label>
            Date de fin
            <input
              type="date"
              v-model="structureForm.date_fin"
              :disabled="!openStructureAssignments.length"
              required
            />
          </label>
          <p v-if="!openStructureAssignments.length" class="helper">
            Aucune affectation en cours à clôturer.
          </p>
        </template>

        <footer class="dialog-actions">
          <button type="button" class="secondary" @click="closeStructureDialog">Annuler</button>
          <button
            class="primary"
            type="submit"
            :disabled="structureSaving || !canSubmitStructure"
          >
            <span v-if="structureSaving">Enregistrement…</span>
            <span v-else>{{ structureForm.mode === 'start' ? 'Enregistrer' : 'Clôturer' }}</span>
          </button>
        </footer>
      </form>
    </dialog>

    <dialog ref="employmentDialog">
      <form class="dialog-form" @submit.prevent="submitEmployment">
        <h3 v-if="employmentForm.mode === 'add'">Nouvel emploi</h3>
        <h3 v-else>Modifier l'emploi</h3>

        <label>
          Type d'emploi
          <select
            v-model="employmentForm.type"
            required
            :disabled="employmentForm.mode === 'edit' && ['doctorant', 'postdoc', 'stage'].includes(employmentForm.type)"
          >
            <option
              v-for="option in employmentTypeOptions"
              :key="option.value"
              :value="option.value"
              :disabled="employmentForm.mode === 'add' && ['doctorant', 'postdoc', 'stage'].includes(option.value)"
            >
              {{ option.label }}
            </option>
          </select>
        </label>

        <label>
          Établissement
          <select v-model.number="employmentForm.etablissement" required>
            <option value="" disabled>Sélectionner un établissement</option>
            <option
              v-for="etab in etablissements"
              :key="etab.id"
              :value="etab.id"
            >
              {{ etab.etablissement }}
            </option>
          </select>
        </label>

        <label>
          Date de début
          <input type="date" v-model="employmentForm.date_debut" required />
        </label>

        <template v-if="typeNeedsCorps(employmentForm.type)">
          <label>
            Corps
            <select v-model.number="employmentForm.corps" required>
              <option value="" disabled>Sélectionner un corps</option>
              <option
                v-for="corps in availableCorpsOptions"
                :key="corps.id"
                :value="corps.id"
              >
                {{ corps.corps }}
              </option>
            </select>
          </label>
        </template>

        <template v-if="typeNeedsGrade(employmentForm.type)">
          <label>
            Grade
            <select v-model.number="employmentForm.grade" required>
              <option value="" disabled>Sélectionner un grade</option>
              <option v-for="grade in grades" :key="grade.id" :value="grade.id">
                {{ grade.grade }}
              </option>
            </select>
          </label>
        </template>

        <template v-if="typeNeedsDuration(employmentForm.type)">
          <label>
            Durée (en mois)
            <input
              type="number"
              min="1"
              v-model.number="employmentForm.duree_mois"
              required
            />
          </label>
        </template>

        <footer class="dialog-actions">
          <button type="button" class="secondary" @click="closeEmploymentDialog">
            Annuler
          </button>
          <button class="primary" type="submit" :disabled="employmentSaving">
            <span v-if="employmentSaving">Enregistrement…</span>
            <span v-else>
              {{ employmentForm.mode === "add" ? "Enregistrer" : "Modifier" }}
            </span>
          </button>
        </footer>
      </form>
    </dialog>
    </template>
  </section>
</template>

<script setup>
import { ref, reactive, onMounted, watch, defineProps, computed } from "vue";
import { useRoute, RouterLink } from "vue-router";

const props = defineProps({
  period: {
    type: Object,
    default: () => ({ start: "", end: "" }),
  },
});

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

const route = useRoute();
const personneId = ref(parseInt(route.params.personneId, 10));

const personne = ref(null);
const laboratoires = ref([]);
const structures = ref([]);
const etablissements = ref([]);
const nationalites = ref([]);
const sexes = ref([]);
const affectations = reactive({ laboratoires: [], structures: [] });
const loading = ref(true);
const labDialog = ref(null);
const labSaving = ref(false);
const structureDialog = ref(null);
const structureSaving = ref(false);
const employmentDialog = ref(null);
const employmentSaving = ref(false);
const structureActionsLoading = ref(false);
const error = ref("");
const saving = ref(false);
const emplois = ref([]);
const hdrs = ref([]);
const corpsOptions = reactive({
  chercheur: [],
  enseignant: [],
  biatss: [],
});
const grades = ref([]);

const form = reactive({
  nom: "",
  prenom: "",
  sexe: 2,
  nationalite: null,
  date_naissance: "",
});

const labForm = reactive({
  mode: "start",
  laboratoire: "",
  date_debut: "",
  affectation: "",
  date_fin: "",
});

const labAssignments = computed(() =>
  [...affectations.laboratoires].sort((a, b) =>
    new Date(a.date_debut || 0) - new Date(b.date_debut || 0)
  )
);

const structureAssignments = computed(() =>
  [...affectations.structures].sort((a, b) =>
    new Date(a.date_debut || 0) - new Date(b.date_debut || 0)
  )
);

const employmentForm = reactive({
  mode: "add",
  id: null,
  type: "chercheur",
  etablissement: null,
  date_debut: "",
  corps: null,
  grade: null,
  duree_mois: 12,
});

const employmentTypeOptions = [
  { value: "chercheur", label: "Chercheurs" },
  { value: "enseignant-chercheur", label: "Enseignants-chercheurs" },
  { value: "biatss", label: "BIATSS" },
  { value: "doctorant", label: "Docteur" },
  { value: "postdoc", label: "Postdoc" },
  { value: "stage", label: "Stage" },
  { value: "cdd", label: "CDD" },
  { value: "autre", label: "Autre" },
];

const structureForm = reactive({
  mode: "start",
  structure: "",
  date_debut: "",
  affectation: "",
  date_fin: "",
});

const openStructureAssignments = computed(() =>
  structureAssignments.value.filter((aff) => !aff.date_fin)
);

const openLabAssignments = computed(() =>
  labAssignments.value.filter((aff) => !aff.date_fin)
);

const canSubmitLab = computed(() => {
  if (labForm.mode === "start") {
    return Boolean(labForm.laboratoire && labForm.date_debut);
  }
  return Boolean(
    openLabAssignments.value.length &&
      labForm.affectation &&
      labForm.date_fin
  );
});

const canSubmitStructure = computed(() => {
  if (structureForm.mode === "start") {
    return Boolean(structureForm.structure && structureForm.date_debut);
  }
  return Boolean(
    openStructureAssignments.value.length &&
      structureForm.affectation &&
      structureForm.date_fin
  );
});

const typeNeedsCorps = (type) =>
  type === "chercheur" ||
  type === "enseignant-chercheur" ||
  type === "biatss";
const typeNeedsGrade = (type) => typeNeedsCorps(type);
const typeNeedsDuration = (type) => type === "cdd" || type === "stage";

const availableCorpsOptions = computed(() => {
  switch (employmentForm.type) {
    case "chercheur":
      return corpsOptions.chercheur;
    case "enseignant-chercheur":
      return corpsOptions.enseignant;
    case "biatss":
      return corpsOptions.biatss;
    default:
      return [];
  }
});

const employmentTypeLabels = {
  chercheur: "Chercheurs",
  "enseignant-chercheur": "Enseignants-chercheurs",
  biatss: "BIATSS",
  doctorant: "Docteur",
  postdoc: "Postdoc",
  stage: "Stage",
  cdd: "CDD",
  autre: "Autre",
};

function normalizeDate(value) {
  if (!value) return "";
  try {
    return new Date(value).toISOString().slice(0, 10);
  } catch {
    return "";
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

async function fetchJSON(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const details = await response.json().catch(() => ({}));
    throw new Error(details.error || `Erreur (${response.status})`);
  }
  return response.json();
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
    laboratoires.value = await fetchJSON(`${API_BASE}/laboratoires`).catch(() => []);
  } catch {
    laboratoires.value = [];
  }
  try {
    structures.value = await fetchJSON(`${API_BASE}/structures`).catch(() => []);
  } catch {
    structures.value = [];
  }
  try {
    etablissements.value = await fetchJSON(
      `${API_BASE}/etablissements`
    ).catch(() => []);
  } catch {
    etablissements.value = [];
  }
  try {
    corpsOptions.chercheur = await fetchJSON(
      `${API_BASE}/corps-chercheurs`
    ).catch(() => []);
  } catch {
    corpsOptions.chercheur = [];
  }
  try {
    corpsOptions.enseignant = await fetchJSON(
      `${API_BASE}/corps-enseignants-chercheurs`
    ).catch(() => []);
  } catch {
    corpsOptions.enseignant = [];
  }
  try {
    corpsOptions.biatss = await fetchJSON(
      `${API_BASE}/corps-biatss`
    ).catch(() => []);
  } catch {
    corpsOptions.biatss = [];
  }
  try {
    grades.value = await fetchJSON(`${API_BASE}/grades`).catch(() => []);
  } catch {
    grades.value = [];
  }
  if (employmentForm.mode === "add") {
    if (!employmentForm.etablissement && etablissements.value.length) {
      employmentForm.etablissement = etablissements.value[0].id;
    }
    if (typeNeedsCorps(employmentForm.type)) {
      const corpsList = getCorpsOptionsForType(employmentForm.type);
      if (corpsList.length) {
        employmentForm.corps = corpsList[0].id;
      }
    }
    if (typeNeedsGrade(employmentForm.type) && grades.value.length) {
      employmentForm.grade = grades.value[0].id;
    }
    if (typeNeedsDuration(employmentForm.type)) {
      employmentForm.duree_mois = employmentForm.duree_mois || 12;
    }
  }
}

async function loadPersonne() {
  error.value = "";
  try {
    const data = await fetchJSON(`${API_BASE}/personnes/${personneId.value}`);
    personne.value = data;
    emplois.value = data.emplois || [];
    hdrs.value = Array.isArray(data.hdrs) ? data.hdrs : [];
    form.nom = data.nom;
    form.prenom = data.prenom;
    form.sexe = data.sexe;
    form.nationalite = data.nationalite;
    form.date_naissance = normalizeDate(data.date_naissance);
  } catch (err) {
    error.value = err.message ?? "Impossible de charger la personne.";
    personne.value = null;
    emplois.value = [];
    hdrs.value = [];
    throw err;
  }
}

async function loadAffectations() {
  if (!personneId.value) return;
  try {
    const params = new URLSearchParams();
    const start = normalizeDate(props.period?.start);
    const end = normalizeDate(props.period?.end);
    if (start) params.set("start", start);
    if (end) params.set("end", end);
    const url = `${API_BASE}/personnes/${personneId.value}/affectations${
      params.toString() ? `?${params.toString()}` : ""
    }`;
    const data = await fetchJSON(url);
    affectations.laboratoires = data.laboratoires || [];
    affectations.structures = data.structures || [];
  } catch (err) {
    error.value = err.message ?? "Impossible de charger les affectations.";
    affectations.laboratoires = [];
    affectations.structures = [];
  }
}

function openLabDialog() {
  error.value = "";
  labForm.mode = "start";
  setStartDefaults();
  labDialog.value?.showModal();
}

function closeLabDialog() {
  labDialog.value?.close();
}

async function submitLabAssignment() {
  if (!personneId.value) return;
  labSaving.value = true;
  error.value = "";
  try {
    if (labForm.mode === "end") {
      if (!labForm.affectation || !labForm.date_fin) {
        throw new Error(
          "Veuillez sélectionner une affectation et renseigner la date de fin."
        );
      }
      await fetchJSON(
        `${API_BASE}/personnes/${personneId.value}/affectations/${labForm.affectation}/fin`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date_fin: labForm.date_fin,
          }),
        }
      );
    } else {
      if (!labForm.laboratoire || !labForm.date_debut) {
        throw new Error(
          "Veuillez choisir un laboratoire et indiquer la date d'affectation."
        );
      }
      await fetchJSON(`${API_BASE}/personnes/${personneId.value}/affectations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personne: personneId.value,
          laboratoire: labForm.laboratoire,
          date_debut: labForm.date_debut,
        }),
      });
    }
    closeLabDialog();
    await loadAffectations();
  } catch (err) {
    if (labForm.mode === "end") {
      error.value =
        err.message ?? "Impossible d'enregistrer la fin d'affectation.";
    } else {
      error.value = err.message ?? "Impossible d'enregistrer l'affectation.";
    }
  } finally {
    labSaving.value = false;
  }
}

async function removeLabAssignment(aff) {
  if (!aff?.id || !personneId.value) return;
  if (!confirm("Supprimer cette affectation ?")) return;
  try {
    const response = await fetch(
      `${API_BASE}/personnes/${personneId.value}/affectations/${aff.id}`,
      {
        method: "DELETE",
      }
    );
    if (!response.ok && response.status !== 204) {
      const details = await response.json().catch(() => ({}));
      throw new Error(details.error || "Suppression impossible");
    }
    await loadAffectations();
  } catch (err) {
    error.value = err.message ?? "Impossible de supprimer l'affectation.";
  }
}

async function loadAll() {
  loading.value = true;
  error.value = "";
  try {
    await loadCatalogs();
    await loadPersonne();
    await loadAffectations();
  } catch (err) {
    if (!error.value) {
      error.value = err.message ?? "Impossible de charger les informations.";
    }
  } finally {
    loading.value = false;
  }
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
        form.nationalite === null || form.nationalite === ""
          ? null
          : Number(form.nationalite),
      date_naissance: form.date_naissance || null,
    };
    await fetchJSON(`${API_BASE}/personnes/${personneId.value}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    await loadPersonne();
  } catch (err) {
    error.value = err.message ?? "Impossible d'enregistrer la personne.";
  } finally {
    saving.value = false;
  }
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

onMounted(loadAll);

watch(
  () => labForm.mode,
  (mode) => {
    if (mode === "start") {
      setStartDefaults();
    } else {
      setEndDefaults();
    }
  }
);

watch(
  () => structureForm.mode,
  (mode) => {
    if (mode === "start") {
      setStructureStartDefaults();
    } else {
      setStructureEndDefaults();
    }
  }
);

watch(
  () => props.period,
  () => {
    loadAffectations();
  },
  { deep: true }
);

watch(
  () => route.params.personneId,
  (newId) => {
    personneId.value = parseInt(newId, 10);
    loadAll();
  }
);

watch(
  () => employmentForm.type,
  (type) => {
    if (typeNeedsCorps(type)) {
      const corpsList = availableCorpsOptions.value;
      if (!corpsList.some((item) => item.id === employmentForm.corps)) {
        employmentForm.corps = corpsList[0]?.id ?? null;
      }
      if (!grades.value.some((item) => item.id === employmentForm.grade)) {
        employmentForm.grade = grades.value[0]?.id ?? null;
      }
    } else {
      employmentForm.corps = null;
      employmentForm.grade = null;
    }
    if (typeNeedsDuration(type)) {
      employmentForm.duree_mois =
        typeof employmentForm.duree_mois === "number" &&
        employmentForm.duree_mois > 0
          ? employmentForm.duree_mois
          : 12;
    } else {
      employmentForm.duree_mois = null;
    }
  }
);

watch(
  () => etablissements.value,
  (list) => {
    if (
      employmentForm.etablissement === null &&
      employmentForm.mode === "add" &&
      Array.isArray(list) &&
      list.length
    ) {
      employmentForm.etablissement = list[0].id;
    }
  },
  { immediate: true }
);

watch(
  () => availableCorpsOptions.value,
  (list) => {
    if (!Array.isArray(list) || !list.length) {
      return;
    }
    if (employmentForm.mode === "add" && typeNeedsCorps(employmentForm.type)) {
      if (!list.some((item) => item.id === employmentForm.corps)) {
        employmentForm.corps = list[0]?.id ?? null;
      }
    }
  }
);

watch(
  () => grades.value,
  (list) => {
    if (!Array.isArray(list) || !list.length) {
      return;
    }
    if (typeNeedsGrade(employmentForm.type) && employmentForm.mode === "add") {
      if (!list.some((item) => item.id === employmentForm.grade)) {
        employmentForm.grade = list[0]?.id ?? null;
      }
    }
  }
);

function setStartDefaults() {
  labForm.laboratoire = laboratoires.value[0]?.id ?? null;
  labForm.date_debut =
    normalizeDate(props.period?.start) || normalizeDate(new Date());
  labForm.affectation = null;
  labForm.date_fin = "";
}

function setEndDefaults() {
  const firstOpen = openLabAssignments.value[0];
  if (firstOpen) {
    labForm.affectation = firstOpen.id;
    labForm.date_fin =
      normalizeDate(props.period?.end) || normalizeDate(new Date());
  } else {
    labForm.affectation = null;
    labForm.date_fin = "";
  }
  labForm.laboratoire = null;
  labForm.date_debut = "";
}

function renderLabAssignment(aff) {
  const label =
    aff.laboratoire_nom || `Laboratoire #${aff.laboratoire ?? "?"}`;
  return `${label} • Depuis ${formatDate(aff.date_debut)}`;
}

function openStructureDialog() {
  error.value = "";
  structureForm.mode = "start";
  setStructureStartDefaults();
  structureDialog.value?.showModal();
}

function closeStructureDialog() {
  structureDialog.value?.close();
}

async function submitStructureAssignment() {
  if (!personneId.value) return;
  structureSaving.value = true;
  error.value = "";
  try {
    if (structureForm.mode === "end") {
      if (!structureForm.affectation || !structureForm.date_fin) {
        throw new Error(
          "Veuillez sélectionner une affectation et renseigner la date de fin."
        );
      }
      await fetchJSON(
        `${API_BASE}/personnes/${personneId.value}/structures/${structureForm.affectation}/fin`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date_fin: structureForm.date_fin,
          }),
        }
      );
    } else {
      if (!structureForm.structure || !structureForm.date_debut) {
        throw new Error(
          "Veuillez choisir une structure et indiquer la date d'affectation."
        );
      }
      await fetchJSON(`${API_BASE}/personnes/${personneId.value}/structures`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personne: personneId.value,
          structure: structureForm.structure,
          date_debut: structureForm.date_debut,
        }),
      });
    }
    closeStructureDialog();
    await loadAffectations();
  } catch (err) {
    error.value =
      err.message ??
      (structureForm.mode === "start"
        ? "Impossible d'enregistrer l'affectation de structure."
        : "Impossible d'enregistrer la fin d'affectation de structure.");
  } finally {
    structureSaving.value = false;
  }
}

function setStructureStartDefaults() {
  structureForm.structure = structures.value[0]?.id ?? null;
  structureForm.date_debut =
    normalizeDate(props.period?.start) || normalizeDate(new Date());
  structureForm.affectation = null;
  structureForm.date_fin = "";
}

function setStructureEndDefaults() {
  const firstOpen = openStructureAssignments.value[0];
  if (firstOpen) {
    structureForm.affectation = firstOpen.id;
    structureForm.date_fin =
      normalizeDate(props.period?.end) || normalizeDate(new Date());
  } else {
    structureForm.affectation = null;
    structureForm.date_fin = "";
  }
  structureForm.structure = null;
  structureForm.date_debut = "";
}

async function removeStructureAssignment(aff) {
  if (!aff?.id || !personneId.value) return;
  if (!confirm("Supprimer cette affectation de structure ?")) return;
  structureActionsLoading.value = true;
  error.value = "";
  try {
    const response = await fetch(
      `${API_BASE}/personnes/${personneId.value}/structures/${aff.id}`,
      { method: "DELETE" }
    );
    if (!response.ok && response.status !== 204) {
      const details = await response.json().catch(() => ({}));
      throw new Error(details.error || "Suppression impossible");
    }
    await loadAffectations();
  } catch (err) {
    error.value = err.message ?? "Impossible de supprimer l'affectation.";
  } finally {
    structureActionsLoading.value = false;
  }
}

async function removeStructureAssignmentEnd(aff) {
  if (!aff?.id || !personneId.value) return;
  if (!confirm("Supprimer la fin de cette affectation ?")) return;
  structureActionsLoading.value = true;
  error.value = "";
  try {
    const response = await fetch(
      `${API_BASE}/personnes/${personneId.value}/structures/${aff.id}/fin`,
      { method: "DELETE" }
    );
    if (!response.ok && response.status !== 204) {
      const details = await response.json().catch(() => ({}));
      throw new Error(details.error || "Impossible de supprimer la fin.");
    }
    await loadAffectations();
  } catch (err) {
    error.value = err.message ?? "Impossible de supprimer la fin d'affectation.";
  } finally {
    structureActionsLoading.value = false;
  }
}


function getCorpsOptionsForType(type) {
  switch (type) {
    case "chercheur":
      return corpsOptions.chercheur;
    case "enseignant-chercheur":
      return corpsOptions.enseignant;
    case "biatss":
      return corpsOptions.biatss;
    default:
      return [];
  }
}

function lookupCorpsLabel(type, id) {
  if (!id) return null;
  const list = getCorpsOptionsForType(type);
  const match = list.find((item) => item.id === id);
  return match ? match.corps : null;
}

function lookupGradeLabel(id) {
  if (!id) return null;
  const match = grades.value.find((grade) => grade.id === id);
  return match ? grade.grade : null;
}

function lookupEtablissementLabel(id) {
  if (!id) return null;
  const match = etablissements.value.find((etab) => etab.id === id);
  return match ? etab.etablissement : null;
}

function resetEmploymentForm(type = "chercheur") {
  employmentForm.mode = "add";
  employmentForm.id = null;
  employmentForm.type = type;
  employmentForm.etablissement = etablissements.value[0]?.id ?? null;
  employmentForm.date_debut =
    normalizeDate(props.period?.start) || normalizeDate(new Date());
  if (typeNeedsCorps(type)) {
    const corpsList = getCorpsOptionsForType(type);
    employmentForm.corps = corpsList[0]?.id ?? null;
    employmentForm.grade = grades.value[0]?.id ?? null;
  } else {
    employmentForm.corps = null;
    employmentForm.grade = null;
  }
  employmentForm.duree_mois = typeNeedsDuration(type) ? 12 : null;
}

function openEmploymentDialog(mode, emploi = null) {
  if (mode === "add") {
    resetEmploymentForm("chercheur");
  } else if (emploi) {
    employmentForm.mode = "edit";
    employmentForm.id = emploi.id;
    employmentForm.etablissement =
      emploi.etablissement ?? etablissements.value[0]?.id ?? null;
    employmentForm.date_debut = normalizeDate(emploi.date_debut);
    employmentForm.corps = emploi.corps_id ?? null;
    employmentForm.grade = emploi.grade_id ?? null;
    employmentForm.duree_mois = typeNeedsDuration(emploi.type)
      ? emploi.duree_mois && emploi.duree_mois > 0
        ? emploi.duree_mois
        : employmentForm.duree_mois || 1
      : null;
    employmentForm.type = emploi.type;
  }
  employmentDialog.value?.showModal();
}

function closeEmploymentDialog() {
  employmentDialog.value?.close();
}

async function submitEmployment() {
  if (!personneId.value) return;
  employmentSaving.value = true;
  error.value = "";
  try {
    const payload = {
      type: employmentForm.type,
      date_debut: employmentForm.date_debut,
      etablissement: employmentForm.etablissement,
    };
    if (typeNeedsCorps(employmentForm.type)) {
      payload.corps = employmentForm.corps;
    }
    if (typeNeedsGrade(employmentForm.type)) {
      payload.grade = employmentForm.grade;
    }
    if (typeNeedsDuration(employmentForm.type)) {
      payload.duree_mois = employmentForm.duree_mois;
    }

    const urlBase = `${API_BASE}/personnes/${personneId.value}/emplois`;
    if (employmentForm.mode === "add") {
      await fetchJSON(urlBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetchJSON(`${urlBase}/${employmentForm.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    closeEmploymentDialog();
    await loadPersonne();
  } catch (err) {
    error.value =
      err.message ??
      (employmentForm.mode === "add"
        ? "Impossible d'enregistrer l'emploi."
        : "Impossible de modifier l'emploi.");
  } finally {
    employmentSaving.value = false;
  }
}

async function removeEmployment(emploi) {
  if (!emploi?.id || !personneId.value) return;
  if (
    !confirm("Supprimer cet emploi ? Cette action est irréversible.")
  )
    return;
  employmentSaving.value = true;
  error.value = "";
  try {
    const response = await fetch(
      `${API_BASE}/personnes/${personneId.value}/emplois/${emploi.id}`,
      { method: "DELETE" }
    );
    if (!response.ok && response.status !== 204) {
      const details = await response.json().catch(() => ({}));
      throw new Error(details.error || "Suppression impossible");
    }
    await loadPersonne();
  } catch (err) {
    error.value = err.message ?? "Impossible de supprimer l'emploi.";
  } finally {
    employmentSaving.value = false;
  }
}

async function addEmploymentEnd(emploi) {
  if (!emploi?.id || !personneId.value) return;
  const defaultDate = normalizeDate(props.period?.end) || normalizeDate(new Date());
  const current = normalizeDate(emploi.date_fin) || defaultDate;
  const date = prompt("Date de fin (YYYY-MM-DD)", current);
  if (!date) return;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    alert("Format de date invalide. Utilisez YYYY-MM-DD.");
    return;
  }
  employmentSaving.value = true;
  error.value = "";
  try {
    await fetchJSON(`${API_BASE}/personnes/${personneId.value}/emplois/${emploi.id}/fin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date_fin: date }),
    });
    await loadPersonne();
  } catch (err) {
    error.value = err.message ?? "Impossible d'enregistrer la fin d'emploi.";
  } finally {
    employmentSaving.value = false;
  }
}

async function removeEmploymentEnd(emploi) {
  if (!emploi?.id || !personneId.value) return;
  if (!confirm("Supprimer la fin de cet emploi ?")) return;
  employmentSaving.value = true;
  error.value = "";
  try {
    const response = await fetch(`${API_BASE}/personnes/${personneId.value}/emplois/${emploi.id}/fin`, {
      method: "DELETE",
    });
    if (!response.ok && response.status !== 204) {
      const details = await response.json().catch(() => ({}));
      throw new Error(details.error || "Suppression impossible");
    }
    await loadPersonne();
  } catch (err) {
    error.value = err.message ?? "Impossible de supprimer la fin d'emploi.";
  } finally {
    employmentSaving.value = false;
  }
}

function renderStructureAssignment(aff) {
  const label =
    aff.structure_nom || `Structure #${aff.structure_laboratoire ?? "?"}`;
  return `${label} • Depuis ${formatDate(aff.date_debut)}`;
}

function renderEmploymentType(type) {
  return employmentTypeLabels[type] ?? 'Autre';
}

function formatMonths(value) {
  if (!value) return "—";
  if (value === 1) return "1 mois";
  return `${value} mois`;
}

function formatDoctoratDetails(emploi) {
  const parts = [];
  if (emploi.ecole_doctorale_nom) {
    parts.push(emploi.ecole_doctorale_nom);
  }
  if (emploi.categorie_financement_nom) {
    parts.push(emploi.categorie_financement_nom);
  }
  if (emploi.etablissement_master_nom) {
    parts.push(`Master : ${emploi.etablissement_master_nom}`);
  }
  if (emploi.organisme_financeur) {
    parts.push(`Financement : ${emploi.organisme_financeur}`);
  }
  return parts.length ? parts.join(" • ") : "—";
}
</script>

<style scoped>
.person-detail {
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

.panel-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1rem;
}

.form-grid label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-weight: 600;
}

.form-grid input,
.form-grid select {
  border: 1px solid rgba(20, 33, 61, 0.15);
  border-radius: 0.65rem;
  padding: 0.55rem 0.85rem;
}

.form-actions {
  grid-column: 1 / -1;
  display: flex;
  justify-content: flex-end;
}

.table-wrapper {
  overflow-x: auto;
}

.affect-table {
  width: 100%;
  border-collapse: collapse;
}

.affect-table th,
.affect-table td {
  padding: 0.75rem 1rem;
  text-align: left;
  border-bottom: 1px solid rgba(20, 33, 61, 0.08);
}

.affect-table th {
  background: rgba(20, 33, 61, 0.05);
  font-weight: 600;
}

.assignment-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.assignment-info {
  flex: 1;
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

.link {
  background: none;
  border: none;
  padding: 0;
  color: #14213d;
  text-decoration: underline;
  cursor: pointer;
}

.link.danger {
  color: #dc2626;
}

.actions-cell {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
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

.dialog-form select,
.dialog-form input {
  border: 1px solid rgba(20, 33, 61, 0.2);
  border-radius: 0.75rem;
  padding: 0.55rem 0.9rem;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1rem;
}

.mode-switch {
  display: flex;
  gap: 1.5rem;
  align-items: center;
  margin-bottom: 0.5rem;
}

.mode-switch label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  color: #14213d;
}

.helper {
  color: #6b7280;
  font-size: 0.9rem;
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

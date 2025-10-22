<template>
  <section class="home">
    <div v-if="loading" class="hero">
      <h2>Chargement en cours…</h2>
      <p>Nous préparons le tableau de bord du laboratoire.</p>
    </div>

    <div v-else-if="error" class="hero hero-error">
      <h2>Impossible de charger les données</h2>
      <p>{{ error }}</p>
      <button class="primary-link" @click="loadData">Réessayer</button>
    </div>

    <div v-else-if="!laboratoires.length" class="hero">
      <h2>Bienvenue sur le portail administratif du LaBRI</h2>
      <p>
        Aucun laboratoire n’est encore enregistré. Créez votre premier
        laboratoire pour commencer à gérer tutelles, structures et personnes.
      </p>
      <RouterLink class="primary-link" to="/structures">
        Créer un laboratoire
      </RouterLink>
    </div>

    <div v-else class="hero hero-summary">
      <div class="hero-header">
        <div>
          <h2>{{ currentLab.nom }}</h2>
          <p class="hero-subtitle">
            Acronyme <strong>{{ currentLab.acronyme }}</strong> • Numéro
            <strong>{{ currentLab.numero }}</strong><br />
            Création le {{ formatDate(currentLab.date_creation) }}
          </p>
        </div>
        <RouterLink class="primary-link" to="/structures">
          Voir les structures
        </RouterLink>
      </div>

      <div class="stats-grid" v-if="stats">
        <article class="stat-card">
          <span class="stat-number">{{ stats.personnes }}</span>
          <span class="stat-label">Personnes affectées</span>
        </article>
        <article class="stat-card">
          <span class="stat-number">{{ stats.structures }}</span>
          <span class="stat-label">Structures enregistrées</span>
        </article>
        <article class="stat-card">
          <span class="stat-number">{{ stats.tutelles }}</span>
          <span class="stat-label">Tutelles actives</span>
        </article>
      </div>

      <div class="cta-row">
        <RouterLink class="secondary-link" to="/personnes">
          Gérer les personnes
        </RouterLink>
        <RouterLink class="secondary-link" to="/structures">
          Gérer les structures
        </RouterLink>
      </div>
    </div>

    <div class="cards">
      <article class="card">
        <h3>Gérer les laboratoires</h3>
        <p>
          Centralisez les informations clés et rattachez vos laboratoires aux
          tutelles concernées.
        </p>
      </article>
      <article class="card">
        <h3>Suivre les personnes</h3>
        <p>
          Consultez et maintenez à jour les informations des membres et
          doctorants affectés.
        </p>
      </article>
      <article class="card">
        <h3>Piloter les structures</h3>
        <p>
          Organisez les départements, axes et équipes pour refléter la réalité
          de votre organisation.
        </p>
      </article>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

const laboratoires = ref([]);
const stats = ref(null);
const loading = ref(true);
const error = ref("");

const currentLab = computed(() => laboratoires.value[0] ?? null);

async function fetchJSON(url) {
  const response = await fetch(url);
  if (!response.ok) {
    const details = await response.json().catch(() => ({}));
    throw new Error(details.error || `Erreur (${response.status})`);
  }
  return response.json();
}

async function loadData() {
  loading.value = true;
  error.value = "";
  stats.value = null;
  try {
    laboratoires.value = await fetchJSON(`${API_BASE}/laboratoires`);
    if (laboratoires.value.length) {
      const lab = laboratoires.value[0];
      const [personnes, structures, tutelles] = await Promise.all([
        fetchJSON(`${API_BASE}/personnes?laboratoire=${lab.id}`),
        fetchJSON(`${API_BASE}/laboratoires/${lab.id}/structures`),
        fetchJSON(`${API_BASE}/laboratoires/${lab.id}/tutelles`),
      ]);
      stats.value = {
        personnes: personnes.length,
        structures: structures.length,
        tutelles: tutelles.length,
      };
    }
  } catch (err) {
    error.value = err.message ?? "Une erreur est survenue.";
  } finally {
    loading.value = false;
  }
}

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

onMounted(() => {
  loadData();
});
</script>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.hero {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 12px 24px rgba(20, 33, 61, 0.08);
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.hero-subtitle {
  margin-top: 0.5rem;
  line-height: 1.5;
}

.hero-error {
  border-left: 4px solid #dc2626;
}

.hero-summary {
  gap: 1.75rem;
}

.hero-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  flex-wrap: wrap;
}

.primary-link,
.secondary-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  text-decoration: none;
  border-radius: 999px;
  padding: 0.75rem 1.5rem;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.primary-link {
  background: #fca311;
  color: #14213d;
}

.primary-link:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 18px rgba(252, 163, 17, 0.3);
}

.secondary-link {
  background: rgba(20, 33, 61, 0.08);
  color: #14213d;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
}

.stat-card {
  background: rgba(20, 33, 61, 0.05);
  border-radius: 12px;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  text-align: center;
}

.stat-number {
  font-size: 2rem;
  font-weight: 700;
  color: #14213d;
}

.stat-label {
  color: #4b5563;
  font-weight: 500;
}

.cta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1.25rem;
}

.card {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 10px 20px rgba(20, 33, 61, 0.06);
}

.card h3 {
  margin-bottom: 0.75rem;
}

@media (max-width: 760px) {
  .hero-header {
    flex-direction: column;
    align-items: stretch;
  }

  .cta-row {
    flex-direction: column;
  }
}
</style>

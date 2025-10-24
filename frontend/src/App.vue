<template>
  <div class="app-shell">
    <header class="app-header">
      <div class="branding">
        <h1>Administration LaBRI</h1>
        <div class="period-form">
          <label>
            Début
            <input type="date" v-model="startDate" :max="endDate" />
          </label>
          <label>
            Fin
            <input type="date" v-model="endDate" :min="startDate" />
          </label>
          <button class="apply" @click="emitPeriod">Appliquer</button>
        </div>
      </div>
      <nav>
        <RouterLink to="/">Accueil</RouterLink>
        <RouterLink to="/structures">Structures</RouterLink>
        <RouterLink to="/personnes">Personnes</RouterLink>
      </nav>
    </header>

    <main class="app-content">
      <RouterView :period="{ start: startDate, end: endDate }" />
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from "vue";
import { useRouter, useRoute } from "vue-router";

const router = useRouter();
const route = useRoute();

const startDate = ref("");
const endDate = ref("");

const apiBase = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

function normalizeDate(value) {
  if (!value) return "";
  try {
    return new Date(value).toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

function todayISO() {
  return normalizeDate(new Date());
}

async function fetchLaboratoireCreation() {
  try {
    const response = await fetch(`${apiBase}/laboratoires`);
    if (!response.ok) {
      return "";
    }
    const data = await response.json();
    if (!Array.isArray(data) || !data.length) {
      return "";
    }
    const dates = data
      .map((lab) => normalizeDate(lab.date_creation))
      .filter(Boolean)
      .sort();
    return dates[0] || "";
  } catch {
    return "";
  }
}

function emitPeriod() {
  if (startDate.value && endDate.value && startDate.value > endDate.value) {
    alert("La date de début doit être antérieure à la date de fin.");
    startDate.value = endDate.value;
  }
  router.replace({
    query: {
      ...route.query,
      start: startDate.value,
      end: endDate.value,
    },
  });
}

onMounted(async () => {
  const query = route.query;
  const today = todayISO();
  endDate.value =
    typeof query.end === "string" ? normalizeDate(query.end) || today : today;
  if (typeof query.start === "string" && query.start) {
    startDate.value = normalizeDate(query.start) || today;
  } else {
    const defaultStart = await fetchLaboratoireCreation();
    startDate.value = defaultStart || endDate.value;
  }
  if (startDate.value > endDate.value) {
    startDate.value = endDate.value;
  }
  emitPeriod();
});

watch(
  () => route.query,
  (query) => {
    if (typeof query.start === "string") {
      startDate.value = normalizeDate(query.start) || startDate.value;
    }
    if (typeof query.end === "string") {
      endDate.value = normalizeDate(query.end) || endDate.value;
    }
  }
);
</script>

<style scoped>
.app-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f6f8fb;
}

.app-header {
  background: #14213d;
  color: #fdfdfd;
  padding: 1.5rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.branding {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: center;
  justify-content: space-between;
}

.period-form {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  align-items: center;
}

.period-form label {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-weight: 600;
}

.period-form input {
  border: 1px solid rgba(255, 255, 255, 0.4);
  border-radius: 0.6rem;
  padding: 0.4rem 0.6rem;
  background: rgba(255, 255, 255, 0.15);
  color: inherit;
}

.apply {
  border: none;
  border-radius: 0.6rem;
  background: #fca311;
  color: #14213d;
  font-weight: 600;
  padding: 0.5rem 0.9rem;
  cursor: pointer;
}

nav {
  display: flex;
  gap: 1rem;
  font-weight: 600;
}

nav a {
  color: inherit;
  text-decoration: none;
  padding-bottom: 0.25rem;
  border-bottom: 2px solid transparent;
}

nav a.router-link-active {
  border-color: #fca311;
}

.app-content {
  flex: 1;
  padding: 2rem;
  max-width: 1100px;
  margin: 0 auto;
  width: 100%;
}
</style>

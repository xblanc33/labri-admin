<template>
  <section class="home">
    <div class="hero">
      <h2>Bienvenue sur le portail administratif du LaBRI</h2>
      <p>
        Cette interface vous permet de créer des laboratoires, de leur associer
        des tutelles et de structurer leurs équipes en quelques clics.
      </p>
      <RouterLink class="primary-link" to="/laboratories">
        Gérer les laboratoires
      </RouterLink>
    </div>

    <div class="cards">
      <article class="card">
        <h3>Créer des laboratoires</h3>
        <p>
          Enregistrez de nouveaux laboratoires en renseignant leurs métadonnées
          et rattachez-les aux tutelles adéquates.
        </p>
      </article>
      <article class="card">
        <h3>Consulter &amp; modifier</h3>
        <p>
          Parcourez l’annuaire existant, vérifiez les informations et mettez-les
          à jour en toute simplicité.
        </p>
      </article>
      <article class="card">
        <h3>Structurer la hiérarchie</h3>
        <p>
          Construisez les axes et équipes des départements pour refléter
          fidèlement l’organisation dans la base de données.
        </p>
      </article>
    </div>
  </section>
</template>

<script setup>
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
}

.hero p {
  font-size: 1.05rem;
  max-width: 48ch;
  margin-bottom: 1.5rem;
}

.primary-link {
  display: inline-block;
  background: #fca311;
  color: #14213d;
  font-weight: 600;
  padding: 0.75rem 1.5rem;
  border-radius: 999px;
  text-decoration: none;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.primary-link:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 18px rgba(252, 163, 17, 0.3);
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
</style>

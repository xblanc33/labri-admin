<template>
  <div class="app-shell">
    <header class="app-header">
      <h1>Administration LaBRI</h1>
      <nav>
        <RouterLink to="/">Accueil</RouterLink>
        <RouterLink to="/structures">Structures</RouterLink>
        <RouterLink to="/personnes">Personnes</RouterLink>
      </nav>
    </header>

    <main class="app-content">
      <RouterView />
    </main>
  </div>
</template>

<script setup>
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
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.app-header h1 {
  margin: 0;
  font-size: 1.75rem;
}

.app-header nav {
  display: flex;
  gap: 1rem;
  font-weight: 600;
}

.app-header a {
  color: inherit;
  text-decoration: none;
  padding-bottom: 0.25rem;
  border-bottom: 2px solid transparent;
}

.app-header a.router-link-active {
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

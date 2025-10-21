import { createRouter, createWebHistory } from "vue-router";
import HomeView from "../views/HomeView.vue";
import LaboratoriesView from "../views/LaboratoriesView.vue";

const routes = [
  {
    path: "/",
    name: "home",
    component: HomeView,
  },
  {
    path: "/laboratories",
    name: "laboratories",
    component: LaboratoriesView,
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;

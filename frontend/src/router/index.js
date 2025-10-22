import { createRouter, createWebHistory } from "vue-router";
import HomeView from "../views/HomeView.vue";
import StructuresView from "../views/StructuresView.vue";
import StructureDetailView from "../views/StructureDetailView.vue";
import PersonnesView from "../views/PersonnesView.vue";

const routes = [
  {
    path: "/",
    name: "home",
    component: HomeView,
  },
  {
    path: "/structures",
    name: "structures",
    component: StructuresView,
  },
  {
    path: "/structures/:structureId",
    name: "structure-detail",
    component: StructureDetailView,
    props: true,
  },
  {
    path: "/personnes",
    name: "personnes",
    component: PersonnesView,
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;

import Vue from "vue";
import App from "./App.vue";
import Dashboard from "./Dashboard.vue";

new Vue({
  el: "#app",
  render: h => h(Dashboard)
});

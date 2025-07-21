import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'data-table',
    component: function () {
      return import('../views/dataTableView.vue')
    }
  },
  {
    path: '/graph',
    name: 'graph',
    component: function () {
      return import('../views/graphView.vue')
    }
  },
  {
    path: '/deleting-panel',
    name: 'deleting-panel',
    component: function () {
      return import('../views/dataDeletingView.vue')
    }
  },
  {
    path: '/knn-analysis',
    name: 'knn-analysis',
    component: function () {
      return import('../views/knnAnalysis.vue')
    }
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router


const routes = [
  {
    path: '/',
    component: () => import('layouts/MyLayout.vue'),
    children: [
      {
        name: 'home',
        path: '',
        component: () => import('pages/Index.vue') 
      },
      {
        name: 'login',
        path: 'login',
        component: () => import('pages/Login.vue')
      },
      {
        path: 'n',
        component: () => import('layouts/Notes.vue'),
        children: [
          {
            name: 'notes',
            path: '',
            component: () => import('pages/NotesDashboard.vue')
          },
          {
            name: 'edit-note',
            path: ':hash/edit',
            component: () => import('pages/EditNote.vue'),
            props: true
          },
          {
            path: 'new',
            name: 'new-note',
            component: () => import('pages/EditNote.vue'),
            props: true
          },
        ]
      }
    ]
  }
]

// Always leave this as last one
if (process.env.MODE !== 'ssr') {
  routes.push({
    path: '*',
    component: () => import('pages/Error404.vue')
  })
}

export default routes

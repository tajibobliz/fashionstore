export const endpoints = {
  auth: {
    login: '/auth/login',
    register: '/auth/register',
    profile: '/auth/profile',
    refresh: '/auth/refresh',
    logout: '/auth/logout',
  },
  users: '/users',
  catalog: '/catalog',
  branches: '/branches',
  inventory: '/inventory',
} as const

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      login: (user, token) => set({ user, accessToken: token, isAuthenticated: true }),
      logout: () => set({ user: null, accessToken: null, isAuthenticated: false }),
      setToken: (token) => set({ accessToken: token }),
    }),
    { name: 'wb-auth', storage: { getItem: k => sessionStorage.getItem(k), setItem: (k, v) => sessionStorage.setItem(k, v), removeItem: k => sessionStorage.removeItem(k) } }
  )
);

export default useAuthStore;

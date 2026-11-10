/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Configuração do Vite (servidor de desenvolvimento + build) e do Vitest (testes).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // "@/algo" vira "src/algo". O mesmo atalho está em tsconfig.json (paths).
    alias: { '@': '/src' },
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
})

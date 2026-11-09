import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      JWT_SECRET: 'segredo-somente-para-testes-com-mais-de-32-caracteres',
      URL_PUBLICA: 'http://teste.local:3000',
    },
  },
});

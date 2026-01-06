import type { environment as environmentProd } from './environment.prod';

export const environment = {
  production: false,
  ERP_BASE_URL: ''
};

export type Environment = typeof environmentProd;

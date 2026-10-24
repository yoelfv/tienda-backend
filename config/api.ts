import type { Core } from "@strapi/strapi";

const config: Core.Config.Api = {
  rest: {
    defaultLimit: 25,
    maxLimit: 100,
    withCount: true,
  },
  documents: {
    strictRelations: true,
  },
} as Core.Config.Api;

export default config;

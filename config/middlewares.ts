export default [
  "strapi::logger",
  "strapi::errors",
  {
    name: "strapi::security",
    config: {
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          "connect-src": ["'self'", "https:"],
          "img-src": [
            "'self'",
            "data:",
            "blob:",
            "https://market-assets.strapi.io",
            "https://res.cloudinary.com",
          ],
          "media-src": [
            "'self'",
            "data:",
            "blob:",
            "https://res.cloudinary.com",
          ],
          upgradeInsecureRequests: null,
        },
      },
    },
  },
  {
    name: "strapi::cors",
    config: {
      enabled: true,
      headers: ["Content-Type", "Authorization", "Origin", "Accept"],
      origin: [
        "http://localhost:4321",
        "http://localhost:3000",
        "http://localhost:1337",
        "http://localhost:5173",
        "http://192.168.101.183:5173",
        "https://tienda-frontend-1yj.pages.dev",
        "https://cubaclick-control.pages.dev",
        "https://tienda-cubaclick.com",
        "https://www.tienda-cubaclick.com",
        "https://control-cubaclick.com",
        "https://www.control-cubaclick.com",
      ],
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"],
      keepHeadersOnError: true,
    },
  },
  "strapi::poweredBy",
  "strapi::query",
  "strapi::body",
  "strapi::session",
  "strapi::favicon",
  "strapi::public",
];

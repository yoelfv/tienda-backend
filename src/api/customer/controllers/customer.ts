/**
 * customer controller
 */

import { factories } from "@strapi/strapi";

export default factories.createCoreController(
  "api::customer.customer",
  ({ strapi }) => ({
    async update(ctx) {
      const documentId = ctx.params.documentId;
      const data = ctx.request.body?.data;

      const name = data?.name?.trim();
      const phone = data?.phone?.trim();

      if (!name || !phone) {
        return ctx.badRequest(
          "El nombre y el teléfono del cliente son obligatorios.",
        );
      }

      const existingCustomers = await strapi
        .documents("api::customer.customer")
        .findMany({
          filters: {
            name: {
              $eq: name,
            },
            phone: {
              $eq: phone,
            },
            documentId: {
              $ne: documentId,
            },
          },
          limit: 1,
        });

      if (existingCustomers.length > 0) {
        return ctx.badRequest(
          "Ya existe otro cliente con ese nombre y teléfono.",
        );
      }

      ctx.request.body.data.name = name;
      ctx.request.body.data.phone = phone;

      return await super.update(ctx);
    },
  }),
);

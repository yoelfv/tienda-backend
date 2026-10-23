/**
 * customer controller
 */

import { factories } from "@strapi/strapi";

export default factories.createCoreController(
  "api::customer.customer",
  ({ strapi }) => ({
    async create(ctx) {
      const data = ctx.request.body?.data;

      const name = data?.name?.trim();
      const phone = data?.phone?.trim();

      if (!name || !phone) {
        return ctx.badRequest(
          "El nombre y el teléfono del cliente son obligatorios.",
        );
      }

      const normalizedName = name.toLowerCase();
      const normalizedPhone = phone.replace(/\s+/g, "");

      const existingCustomers = await strapi
        .documents("api::customer.customer")
        .findMany({
          limit: 1000,
        });

      const isDuplicate = existingCustomers.some((customer) => {
        const existingName = String(customer.name ?? "")
          .trim()
          .toLowerCase();
        const existingPhone = String(customer.phone ?? "")
          .trim()
          .replace(/\s+/g, "");

        return (
          existingName === normalizedName && existingPhone === normalizedPhone
        );
      });

      if (isDuplicate) {
        return ctx.badRequest(
          "Ya existe un cliente con ese nombre y teléfono.",
        );
      }

      ctx.request.body.data.name = name;
      ctx.request.body.data.phone = phone;

      return await super.create(ctx);
    },

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

      const normalizedName = name.toLowerCase();
      const normalizedPhone = phone.replace(/\s+/g, "");

      const existingCustomers = await strapi
        .documents("api::customer.customer")
        .findMany({
          limit: 1000,
        });

      const isDuplicate = existingCustomers.some((customer) => {
        if (customer.documentId === documentId) return false;

        const existingName = String(customer.name ?? "")
          .trim()
          .toLowerCase();
        const existingPhone = String(customer.phone ?? "")
          .trim()
          .replace(/\s+/g, "");

        return (
          existingName === normalizedName && existingPhone === normalizedPhone
        );
      });

      if (isDuplicate) {
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

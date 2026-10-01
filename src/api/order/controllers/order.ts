/**
 * order controller
 */

import { factories } from "@strapi/strapi";

export default factories.createCoreController(
  "api::order.order",
  ({ strapi }) => ({
    async createOrder(ctx) {
      try {
        const result = await strapi
          .service("api::order.order")
          .createOrder(ctx.request.body);

        return result;
      } catch (error) {
        return ctx.badRequest(error.message);
      }
    },
    async updateOrder(ctx) {
      try {
        const { documentId } = ctx.params;

        if (!documentId) {
          return ctx.badRequest("El identificador del pedido es obligatorio");
        }

        const result = await strapi
          .service("api::order.order")
          .updateOrder(documentId, ctx.request.body);

        return result;
      } catch (error) {
        return ctx.badRequest(error.message);
      }
    },
  }),
);

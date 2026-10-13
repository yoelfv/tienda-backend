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

    async getCustomerOrders(ctx) {
      try {
        const { customerDocumentId } = ctx.params;

        if (!customerDocumentId) {
          return ctx.badRequest("El identificador del cliente es obligatorio");
        }

        const { dateFrom, dateTo, page, pageSize } = ctx.query;

        const result = await strapi
          .service("api::order.order")
          .getCustomerOrders(customerDocumentId, {
            dateFrom: dateFrom as string | undefined,
            dateTo: dateTo as string | undefined,
            page: page ? Number(page) : undefined,
            pageSize: pageSize ? Number(pageSize) : undefined,
          });

        return result;
      } catch (error) {
        return ctx.badRequest(
          error instanceof Error
            ? error.message
            : "No fue posible obtener los pedidos del cliente.",
        );
      }
    },

    async getSalesRepOrders(ctx) {
      try {
        const { salesRepDocumentId } = ctx.params;

        if (!salesRepDocumentId) {
          return ctx.badRequest(
            "El identificador de la vendedora es obligatorio",
          );
        }

        const { dateFrom, dateTo, page, pageSize } = ctx.query;

        const result = await strapi
          .service("api::order.order")
          .getSalesRepOrders(salesRepDocumentId, {
            dateFrom: dateFrom as string | undefined,
            dateTo: dateTo as string | undefined,
            page: page ? Number(page) : undefined,
            pageSize: pageSize ? Number(pageSize) : undefined,
          });

        return result;
      } catch (error) {
        return ctx.badRequest(
          error instanceof Error
            ? error.message
            : "No fue posible obtener los pedidos de la vendedora.",
        );
      }
    },

    async cancelOrder(ctx) {
      try {
        const { documentId } = ctx.params;

        if (!documentId) {
          return ctx.badRequest("El identificador del pedido es obligatorio");
        }

        const result = await strapi
          .service("api::order.order")
          .cancelOrder(documentId);

        return result;
      } catch (error) {
        return ctx.badRequest(error.message);
      }
    },
  }),
);

/**
 * order service
 */

import { factories } from "@strapi/strapi";

export default factories.createCoreService(
  "api::order.order",
  ({ strapi }) => ({
    /**
     * Obtiene el siguiente número consecutivo para una vendedora y fecha.
     */
    async getNextSequenceNumber(salesRepDocumentId: string, date: string) {
      const orders = await strapi.documents("api::order.order").findMany({
        filters: {
          salesRep: {
            documentId: salesRepDocumentId,
          },
          date,
        },
        sort: {
          sequenceNumber: "desc",
        },
        limit: 1,
      });

      return (orders[0]?.sequenceNumber ?? 0) + 1;
    },

    /**
     * Crea un pedido real junto con sus productos.
     *
     * El frontend NO proporciona:
     * - sequenceNumber
     * - code
     * - unitPrice
     * - total
     *
     * Todos esos valores son responsabilidad del backend.
     */
    async createOrder(data: {
      date: string;
      salesRep: string;
      customer: string;
      recipientName: string;
      recipientPhone: string;
      remittance?: number;
      paymentStatus: "paid" | "pending";
      items: Array<{
        product: string;
        quantity: number;
      }>;
    }) {
      return await strapi.db.transaction(async () => {
        /*
         * 1. Validar datos básicos
         */

        if (!data.date) {
          throw new Error("La fecha es obligatoria");
        }

        const today = new Intl.DateTimeFormat("en-CA", {
          timeZone: "America/Havana",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date());

        if (data.date > today) {
          throw new Error("La fecha del pedido no puede ser posterior a hoy");
        }

        if (!data.salesRep) {
          throw new Error("La vendedora es obligatoria");
        }

        if (!data.customer) {
          throw new Error("El cliente es obligatorio");
        }

        if (!data.recipientName) {
          throw new Error("El nombre del destinatario es obligatorio");
        }

        if (!data.recipientPhone) {
          throw new Error("El teléfono del destinatario es obligatorio");
        }

        if (!Array.isArray(data.items)) {
          throw new Error("Los productos deben enviarse como una lista");
        }

        if (data.items.length === 0 && !data.remittance) {
          throw new Error(
            "El pedido debe contener al menos un producto o una remesa",
          );
        }

        /*
         * 2. Validar que la vendedora exista
         */

        const salesRep = await strapi
          .documents("api::sales-rep.sales-rep")
          .findOne({
            documentId: data.salesRep,
          });

        if (!salesRep) {
          throw new Error("La vendedora indicada no existe");
        }

        if (!salesRep.active) {
          throw new Error("La vendedora indicada está inactiva");
        }

        /*
         * 3. Validar que el cliente exista
         */

        const customer = await strapi
          .documents("api::customer.customer")
          .findOne({
            documentId: data.customer,
          });

        if (!customer) {
          throw new Error("El cliente indicado no existe");
        }

        /*
         * 4. Obtener productos y precios desde Strapi
         */

        const productItems: Array<{
          productDocumentId: string;
          quantity: number;
          unitPrice: number;
        }> = [];

        let productsTotal = 0;

        for (const item of data.items) {
          if (!item.product) {
            throw new Error("Cada producto debe tener un documentId");
          }

          if (!Number.isInteger(item.quantity) || item.quantity < 1) {
            throw new Error(
              "La cantidad de cada producto debe ser un entero mayor o igual a 1",
            );
          }

          const product = await strapi
            .documents("api::product.product")
            .findOne({
              documentId: item.product,
            });

          if (!product) {
            throw new Error(`El producto ${item.product} no existe`);
          }

          const unitPrice = Number(product.precio);

          if (!Number.isFinite(unitPrice) || unitPrice < 0) {
            throw new Error(
              `El producto "${product.nombre}" tiene un precio inválido`,
            );
          }

          productItems.push({
            productDocumentId: product.documentId,
            quantity: item.quantity,
            unitPrice,
          });

          productsTotal += item.quantity * unitPrice;
        }

        /*
         * 5. Validar y calcular la remesa
         */

        if (!["paid", "pending"].includes(data.paymentStatus)) {
          throw new Error("El estado de pago no es válido");
        }

        const remittance = Number(data.remittance ?? 0);

        if (!Number.isFinite(remittance) || remittance < 0) {
          throw new Error("La remesa debe ser un número mayor o igual a 0");
        }

        /*
         * 6. Calcular el total real del pedido
         *
         * total = productos + remesa
         */

        const total = productsTotal + remittance;

        /*
         * 7. Obtener el siguiente número consecutivo
         */

        const sequenceNumber = await this.getNextSequenceNumber(
          data.salesRep,
          data.date,
        );

        /*
         * 8. Generar código humano del pedido
         */

        const code = `${salesRep.initials}-${data.date}-${sequenceNumber}`;

        /*
         * 9. Crear el pedido
         */

        const order = await strapi.documents("api::order.order").create({
          data: {
            code,
            sequenceNumber,
            date: data.date,
            salesRep: data.salesRep,
            customer: data.customer,
            recipientName: data.recipientName,
            recipientPhone: data.recipientPhone,
            remittance,
            total,
            paymentStatus: data.paymentStatus,
            cancelled: false,
          },
        });

        /*
         * 10. Crear los OrderItems
         */

        for (const item of productItems) {
          await strapi.documents("api::order-item.order-item").create({
            data: {
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              order: order.documentId,
              product: item.productDocumentId,
            },
          });
        }

        /*
         * 11. Devolver información útil del pedido creado
         */

        return {
          documentId: order.documentId,
          code,
          sequenceNumber,
          total,
          productsTotal,
          remittance,
          paymentStatus: data.paymentStatus,
        };
      });
    },

    /**
     * Actualiza un pedido existente.
     *
     * Fecha, vendedora, código y número consecutivo no son modificables.
     *
     * Los productos que ya pertenecían al pedido conservan su precio
     * histórico. Los productos nuevos utilizan el precio actual.
     */
    async updateOrder(
      orderDocumentId: string,
      data: {
        customer: string;
        recipientName: string;
        recipientPhone: string;
        remittance?: number;
        paymentStatus: "paid" | "pending";
        items: Array<{
          product: string;
          quantity: number;
        }>;
      },
    ) {
      return await strapi.db.transaction(async () => {
        /*
         * 1. Validar datos básicos
         */

        if (!orderDocumentId) {
          throw new Error("El pedido es obligatorio");
        }

        if (!data.customer) {
          throw new Error("El cliente es obligatorio");
        }

        if (!data.recipientName) {
          throw new Error("El nombre del destinatario es obligatorio");
        }

        if (!data.recipientPhone) {
          throw new Error("El teléfono del destinatario es obligatorio");
        }

        if (!Array.isArray(data.items)) {
          throw new Error("Los productos deben enviarse como una lista");
        }

        if (data.items.length === 0 && !data.remittance) {
          throw new Error(
            "El pedido debe contener al menos un producto o una remesa",
          );
        }

        /*
         * 2. Obtener el pedido existente
         */

        const existingOrder = await strapi
          .documents("api::order.order")
          .findOne({
            documentId: orderDocumentId,
          });

        if (!existingOrder) {
          throw new Error("El pedido indicado no existe");
        }

        if (existingOrder.cancelled) {
          throw new Error("No se puede modificar un pedido cancelado");
        }

        /*
         * 3. Validar que el cliente exista
         */

        const customer = await strapi
          .documents("api::customer.customer")
          .findOne({
            documentId: data.customer,
          });

        if (!customer) {
          throw new Error("El cliente indicado no existe");
        }

        /*
         * 4. Obtener los OrderItems existentes.
         *
         * Necesitamos conocer qué productos ya pertenecían al pedido
         * y cuál era su precio histórico.
         */

        const existingItems = await strapi
          .documents("api::order-item.order-item")
          .findMany({
            filters: {
              order: {
                documentId: orderDocumentId,
              },
            },
            populate: {
              product: true,
            },
          });

        type ExistingOrderItem = {
          documentId: string;
          unitPrice?: number;
          product: {
            documentId: string;
          };
        };

        /*
         * 5. Crear un mapa:
         *
         * productDocumentId -> precio histórico
         */

        const existingPrices = new Map<string, number>();

        for (const existingItem of existingItems as ExistingOrderItem[]) {
          existingPrices.set(
            existingItem.product.documentId,
            Number(existingItem.unitPrice),
          );
        }

        /*
         * 6. Preparar los productos del pedido actualizado
         */

        const productItems: Array<{
          productDocumentId: string;
          quantity: number;
          unitPrice: number;
        }> = [];

        let productsTotal = 0;

        for (const item of data.items) {
          if (!item.product) {
            throw new Error("Cada producto debe tener un documentId");
          }

          if (!Number.isInteger(item.quantity) || item.quantity < 1) {
            throw new Error(
              "La cantidad de cada producto debe ser un entero mayor o igual a 1",
            );
          }

          /*
           * Si el producto ya pertenecía al pedido,
           * conservar su precio histórico.
           */
          let unitPrice = existingPrices.get(item.product);

          /*
           * Si es un producto nuevo, obtener su precio actual.
           */
          if (unitPrice === undefined) {
            const product = await strapi
              .documents("api::product.product")
              .findOne({
                documentId: item.product,
              });

            if (!product) {
              throw new Error(`El producto ${item.product} no existe`);
            }

            unitPrice = Number(product.precio);

            if (!Number.isFinite(unitPrice) || unitPrice < 0) {
              throw new Error(
                `El producto "${product.nombre}" tiene un precio inválido`,
              );
            }
          }

          productItems.push({
            productDocumentId: item.product,
            quantity: item.quantity,
            unitPrice,
          });

          productsTotal += item.quantity * unitPrice;
        }

        /*
         * 7. Validar el estado de pago
         */

        if (!["paid", "pending"].includes(data.paymentStatus)) {
          throw new Error("El estado de pago no es válido");
        }

        /*
         * 8. Validar y calcular la remesa
         */

        const remittance = Number(data.remittance ?? 0);

        if (!Number.isFinite(remittance) || remittance < 0) {
          throw new Error("La remesa debe ser un número mayor o igual a 0");
        }

        /*
         * 9. Calcular el nuevo total
         */

        const total = productsTotal + remittance;

        /*
         * 10. Actualizar el pedido.
         *
         * No se modifican:
         * - code
         * - sequenceNumber
         * - date
         * - salesRep
         */

        await strapi.documents("api::order.order").update({
          documentId: orderDocumentId,
          data: {
            customer: data.customer,
            recipientName: data.recipientName,
            recipientPhone: data.recipientPhone,
            remittance,
            total,
            paymentStatus: data.paymentStatus,
          },
        });

        /*
         * 11. Eliminar los OrderItems anteriores
         */

        for (const item of existingItems) {
          await strapi.documents("api::order-item.order-item").delete({
            documentId: item.documentId,
          });
        }

        /*
         * 12. Crear los nuevos OrderItems
         */

        for (const item of productItems) {
          await strapi.documents("api::order-item.order-item").create({
            data: {
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              order: orderDocumentId,
              product: item.productDocumentId,
            },
          });
        }

        /*
         * 13. Devolver información del pedido actualizado
         */

        return {
          documentId: existingOrder.documentId,
          code: existingOrder.code,
          sequenceNumber: existingOrder.sequenceNumber,
          date: existingOrder.date,
          total,
          productsTotal,
          remittance,
          paymentStatus: data.paymentStatus,
        };
      });
    },

    async getCustomerOrders(
      customerDocumentId: string,
      options: {
        dateFrom?: string;
        dateTo?: string;
        page?: number;
        pageSize?: number;
      } = {},
    ) {
      const page = Math.max(1, options.page ?? 1);
      const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 10));

      const filters: Record<string, unknown> = {
        customer: {
          documentId: customerDocumentId,
        },
      };

      if (options.dateFrom || options.dateTo) {
        const dateFilter: Record<string, string> = {};

        if (options.dateFrom) {
          dateFilter.$gte = options.dateFrom;
        }

        if (options.dateTo) {
          dateFilter.$lte = options.dateTo;
        }

        filters.date = dateFilter;
      }

      const summaryFilters = {
        ...filters,
        cancelled: false,
      };

      const [orders, total, summaryOrders] = await Promise.all([
        strapi.documents("api::order.order").findMany({
          filters,
          sort: {
            date: "desc",
            sequenceNumber: "desc",
          },
          populate: {
            customer: true,
            salesRep: true,
            orderItems: {
              populate: {
                product: true,
              },
            },
          },
          start: (page - 1) * pageSize,
          limit: pageSize,
        }),

        strapi.documents("api::order.order").count({
          filters,
        }),

        strapi.documents("api::order.order").findMany({
          filters: summaryFilters,
          fields: ["total", "paymentStatus"],
          page: 1,
          pageSize: 10000,
        }),
      ]);

      const totalOrders = summaryOrders.length;

      const totalAmount = summaryOrders.reduce(
        (sum, order) => sum + Number(order.total),
        0,
      );

      const paidOrders = summaryOrders.filter(
        (order) => order.paymentStatus === "paid",
      );

      const pendingOrders = summaryOrders.filter(
        (order) => order.paymentStatus === "pending",
      );

      const paidAmount = paidOrders.reduce(
        (sum, order) => sum + Number(order.total),
        0,
      );

      const pendingAmount = pendingOrders.reduce(
        (sum, order) => sum + Number(order.total),
        0,
      );

      return {
        data: orders,
        meta: {
          pagination: {
            page,
            pageSize,
            pageCount: Math.ceil(total / pageSize),
            total,
          },
          summary: {
            totalOrders,
            totalAmount,
            paidOrders: paidOrders.length,
            paidAmount,
            pendingOrders: pendingOrders.length,
            pendingAmount,
          },
        },
      };
    },

    async getSalesRepOrders(
      salesRepDocumentId: string,
      options: {
        dateFrom?: string;
        dateTo?: string;
        page?: number;
        pageSize?: number;
      } = {},
    ) {
      const page = Math.max(1, options.page ?? 1);
      const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 10));

      const filters: Record<string, unknown> = {
        salesRep: {
          documentId: salesRepDocumentId,
        },
      };

      if (options.dateFrom || options.dateTo) {
        const dateFilter: Record<string, string> = {};

        if (options.dateFrom) {
          dateFilter.$gte = options.dateFrom;
        }

        if (options.dateTo) {
          dateFilter.$lte = options.dateTo;
        }

        filters.date = dateFilter;
      }

      // Los pedidos cancelados aparecen en el historial,
      // pero no participan en las estadísticas.
      const summaryFilters = {
        ...filters,
        cancelled: false,
      };

      const [orders, total, summaryOrders] = await Promise.all([
        strapi.documents("api::order.order").findMany({
          filters,
          sort: {
            date: "desc",
            sequenceNumber: "desc",
          },
          populate: {
            customer: true,
            salesRep: true,
            orderItems: {
              populate: {
                product: true,
              },
            },
          },
          start: (page - 1) * pageSize,
          limit: pageSize,
        }),

        strapi.documents("api::order.order").count({
          filters,
        }),

        strapi.documents("api::order.order").findMany({
          filters: summaryFilters,
          fields: ["total", "paymentStatus"],
          page: 1,
          pageSize: 10000,
        }),
      ]);

      const totalAmount = summaryOrders.reduce(
        (sum, order) => sum + Number(order.total),
        0,
      );

      const paidOrders = summaryOrders.filter(
        (order) => order.paymentStatus === "paid",
      );

      const pendingOrders = summaryOrders.filter(
        (order) => order.paymentStatus === "pending",
      );

      const paidAmount = paidOrders.reduce(
        (sum, order) => sum + Number(order.total),
        0,
      );

      const pendingAmount = pendingOrders.reduce(
        (sum, order) => sum + Number(order.total),
        0,
      );

      return {
        data: orders,
        meta: {
          pagination: {
            page,
            pageSize,
            pageCount: Math.ceil(total / pageSize),
            total,
          },
          summary: {
            totalOrders: summaryOrders.length,
            totalAmount,
            paidOrders: paidOrders.length,
            paidAmount,
            pendingOrders: pendingOrders.length,
            pendingAmount,
          },
        },
      };
    },

    async cancelOrder(orderDocumentId: string) {
      return await strapi.db.transaction(async () => {
        if (!orderDocumentId) {
          throw new Error("El pedido es obligatorio");
        }

        const existingOrder = await strapi
          .documents("api::order.order")
          .findOne({
            documentId: orderDocumentId,
          });

        if (!existingOrder) {
          throw new Error("El pedido indicado no existe");
        }

        if (existingOrder.cancelled) {
          throw new Error("El pedido ya está cancelado");
        }

        const cancelledOrder = await strapi
          .documents("api::order.order")
          .update({
            documentId: orderDocumentId,
            data: {
              cancelled: true,
            },
          });

        return {
          documentId: cancelledOrder.documentId,
          code: cancelledOrder.code,
          cancelled: true,
        };
      });
    },
  }),
);

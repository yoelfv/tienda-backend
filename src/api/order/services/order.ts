/**
 * order service
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::order.order', ({ strapi }) => ({
  /**
   * Obtiene el siguiente número consecutivo para una vendedora y fecha.
   */
  async getNextSequenceNumber(
    salesRepDocumentId: string,
    date: string
  ) {
    const orders = await strapi.documents('api::order.order').findMany({
      filters: {
        salesRep: {
          documentId: salesRepDocumentId,
        },
        date,
      },
      sort: {
        sequenceNumber: 'desc',
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
    paymentStatus: 'paid' | 'pending';
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
        throw new Error('La fecha es obligatoria');
      }

      if (!data.salesRep) {
        throw new Error('La vendedora es obligatoria');
      }

      if (!data.customer) {
        throw new Error('El cliente es obligatorio');
      }

      if (!data.recipientName) {
        throw new Error('El nombre del destinatario es obligatorio');
      }

      if (!data.recipientPhone) {
        throw new Error('El teléfono del destinatario es obligatorio');
      }

      if (!Array.isArray(data.items)) {
        throw new Error('Los productos deben enviarse como una lista');
      }

      if (data.items.length === 0 && !data.remittance) {
        throw new Error(
          'El pedido debe contener al menos un producto o una remesa'
        );
      }

      /*
       * 2. Validar que la vendedora exista
       */

      const salesRep = await strapi.documents('api::sales-rep.sales-rep').findOne({
        documentId: data.salesRep,
      });

      if (!salesRep) {
        throw new Error('La vendedora indicada no existe');
      }

      if (!salesRep.active) {
        throw new Error('La vendedora indicada está inactiva');
      }

      /*
       * 3. Validar que el cliente exista
       */

      const customer = await strapi.documents('api::customer.customer').findOne({
        documentId: data.customer,
      });

      if (!customer) {
        throw new Error('El cliente indicado no existe');
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
          throw new Error('Cada producto debe tener un documentId');
        }

        if (
          !Number.isInteger(item.quantity) ||
          item.quantity < 1
        ) {
          throw new Error(
            'La cantidad de cada producto debe ser un entero mayor o igual a 1'
          );
        }

        const product = await strapi.documents('api::product.product').findOne({
          documentId: item.product,
        });

        if (!product) {
          throw new Error(
            `El producto ${item.product} no existe`
          );
        }

        const unitPrice = Number(product.precio);

        if (!Number.isFinite(unitPrice) || unitPrice < 0) {
          throw new Error(
            `El producto "${product.nombre}" tiene un precio inválido`
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

      if (!['paid', 'pending'].includes(data.paymentStatus)) {
        throw new Error('El estado de pago no es válido');
      }

	  const remittance = Number(data.remittance ?? 0);
      if (!Number.isFinite(remittance) || remittance < 0) {
        throw new Error(
          'La remesa debe ser un número mayor o igual a 0'
        );
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
        data.date
      );

      /*
       * 8. Generar código humano del pedido
       */

      const code = `${salesRep.initials}-${data.date}-${sequenceNumber}`;

      /*
       * 9. Crear el pedido
       */

      const order = await strapi.documents('api::order.order').create({
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
        await strapi.documents('api::order-item.order-item').create({
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
}));

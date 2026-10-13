/**
 * Custom order routes
 */

export default {
  routes: [
    {
      method: "POST",
      path: "/orders/create",
      handler: "api::order.order.createOrder",
      config: {
        auth: false,
      },
    },
    {
      method: "PUT",
      path: "/orders/:documentId",
      handler: "api::order.order.updateOrder",
      config: {
        auth: false,
      },
    },
    {
      method: "PUT",
      path: "/orders/:documentId/cancel",
      handler: "api::order.order.cancelOrder",
      config: {
        auth: false,
      },
    },
    {
      method: "GET",
      path: "/orders/by-customer/:customerDocumentId",
      handler: "api::order.order.getCustomerOrders",
      config: {
        auth: false,
      },
    },
    {
      method: "GET",
      path: "/orders/by-sales-rep/:salesRepDocumentId",
      handler: "api::order.order.getSalesRepOrders",
      config: {
        auth: false,
      },
    },
  ],
};

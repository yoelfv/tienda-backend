/**
 * Custom order routes
 */

export default {
  routes: [
    {
      method: "POST",
      path: "/orders/create",
      handler: "api::order.order.createOrder",
      config: { auth: {} },
    },
    {
      method: "PUT",
      path: "/orders/:documentId",
      handler: "api::order.order.updateOrder",
      config: { auth: {} },
    },
    {
      method: "PUT",
      path: "/orders/:documentId/cancel",
      handler: "api::order.order.cancelOrder",
      config: { auth: {} },
    },
    {
      method: "GET",
      path: "/auth/me-with-role",
      handler: "api::order.user.meWithRole",
      config: { auth: {} },
    },
    {
      method: "GET",
      path: "/orders/statistics",
      handler: "api::order.order.getStatistics",
      config: { auth: {} },
    },
    {
      method: "GET",
      path: "/orders/by-customer/:customerDocumentId",
      handler: "api::order.order.getCustomerOrders",
      config: { auth: {} },
    },
    {
      method: "GET",
      path: "/orders/by-sales-rep/:salesRepDocumentId",
      handler: "api::order.order.getSalesRepOrders",
      config: { auth: {} },
    },
    {
      method: "GET",
      path: "/orders/by-bank-account/:bankAccountDocumentId",
      handler: "api::order.order.getBankAccountOrders",
      config: {
        auth: {},
      },
    },
  ],
};

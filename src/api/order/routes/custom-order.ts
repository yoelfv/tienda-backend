/**
 * Custom order routes
 */

export default {
  routes: [
    {
      method: 'POST',
      path: '/orders/create',
      handler: 'api::order.order.createOrder',
      config: {
        auth: false,
      },
    },
  ],
};
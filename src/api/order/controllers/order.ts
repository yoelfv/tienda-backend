 /**
  * order controller
  */

 import { factories } from '@strapi/strapi';

 export default factories.createCoreController(
   'api::order.order',
   ({ strapi }) => ({
     async createOrder(ctx) {
       try {
         const result = await strapi
           .service('api::order.order')
           .createOrder(ctx.request.body);

         return result;
       } catch (error) {
         return ctx.badRequest(error.message);
       }
     },
   })
 );
import type { Core } from '@strapi/strapi';

export default {
  register({ strapi }: { strapi: Core.Strapi }) {
    strapi.documents.use(async (context, next) => {
      if (context.uid === 'api::order.order' && context.action === 'create') {
        const data = context.params.data as Record<string, any>;
        const salesRepId = data.salesRep;
        const date = data.date;

        if (salesRepId && date) {
          const existing = await strapi.documents('api::order.order').findMany({
            filters: { salesRep: { documentId: salesRepId }, date },
            sort: { sequenceNumber: 'desc' },
            limit: 1,
          });

          const nextSequence = (existing[0]?.sequenceNumber ?? 0) + 1;

          const salesRep = await strapi.documents('api::sales-rep.sales-rep').findOne({
            documentId: salesRepId,
          });

          const initials = (salesRep?.name ?? 'XX')
            .split(' ')
            .map((part: string) => part[0])
            .join('')
            .toUpperCase()
            .slice(0, 3);

          data.sequenceNumber = nextSequence;
          data.code = `${initials}-${date}-${String(nextSequence).padStart(3, '0')}`;
        }
      }

      return next();
    });
  },

  bootstrap(/* { strapi }: { strapi: Core.Strapi } */) {},
};

interface StrapiContext {
  state: {
    user?: {
      id: number;
    };
  };
  unauthorized: (message: string) => unknown;
  notFound: (message: string) => unknown;
  badRequest: (message: string) => unknown;
  send: (data: unknown) => unknown;
}

interface UserWithRole {
  id: number;
  documentId: string;
  username: string;
  email: string;
  confirmed: boolean;
  blocked: boolean;
  role?: {
    id: number;
    name: string;
    type: string;
  } | null;
}

export default {
  async meWithRole(ctx: StrapiContext) {
    try {
      const user = ctx.state.user;

      if (!user) {
        return ctx.unauthorized("No estás autenticado");
      }

      const userWithRole = (await strapi.db
        .query("plugin::users-permissions.user")
        .findOne({
          where: { id: user.id },
          populate: ["role"],
        })) as UserWithRole | null;

      if (!userWithRole) {
        return ctx.notFound("Usuario no encontrado");
      }

      return ctx.send({
        id: userWithRole.id,
        documentId: userWithRole.documentId,
        username: userWithRole.username,
        email: userWithRole.email,
        confirmed: userWithRole.confirmed,
        blocked: userWithRole.blocked,
        role: userWithRole.role
          ? {
              id: userWithRole.role.id,
              name: userWithRole.role.name,
              type: userWithRole.role.type,
            }
          : null,
      });
    } catch (error) {
      return ctx.badRequest(
        error instanceof Error ? error.message : "Error desconocido",
      );
    }
  },
};

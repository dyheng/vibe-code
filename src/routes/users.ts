import Elysia, { t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { db } from "../db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";

const JWT_SECRET = process.env.JWT_SECRET || "secret";

export const userRoutes = new Elysia({ prefix: "/api/users" })
  .use(jwt({ name: "jwt", secret: JWT_SECRET }))
  .onBeforeHandle(async ({ headers, jwt, set }: any) => {
    const auth = headers["authorization"];
    if (!auth?.startsWith("Bearer ")) {
      set.status = 401;
      return { message: "Unauthorized" };
    }
    const payload = await jwt.verify(auth.slice(7));
    if (!payload) {
      set.status = 401;
      return { message: "Invalid token" };
    }
  })
  .derive(async ({ headers, jwt }: any) => {
    const auth = headers["authorization"] ?? "";
    const payload = await jwt.verify(auth.slice(7));
    return { currentUser: payload };
  })
  .get("/", async () => {
    return await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        createdAt: users.createdAt,
      })
      .from(users);
  })
  .get(
    "/:id",
    async ({ params, set }) => {
      const result = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.id, Number(params.id)))
        .limit(1);

      if (result.length === 0) {
        set.status = 404;
        return { message: "User not found" };
      }
      return result[0];
    },
    { params: t.Object({ id: t.String() }) }
  )
  .put(
    "/:id",
    async ({ params, body, set }) => {
      const existing = await db
        .select()
        .from(users)
        .where(eq(users.id, Number(params.id)))
        .limit(1);

      if (existing.length === 0) {
        set.status = 404;
        return { message: "User not found" };
      }

      const updateData: Partial<{ name: string; email: string }> = {};
      if (body.name) updateData.name = body.name;
      if (body.email) updateData.email = body.email;

      await db.update(users).set(updateData).where(eq(users.id, Number(params.id)));
      return { message: "User updated successfully" };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1 })),
        email: t.Optional(t.String({ minLength: 5 })),
      }),
    }
  )
  .delete(
    "/:id",
    async ({ params, set }) => {
      const existing = await db
        .select()
        .from(users)
        .where(eq(users.id, Number(params.id)))
        .limit(1);

      if (existing.length === 0) {
        set.status = 404;
        return { message: "User not found" };
      }

      await db.delete(users).where(eq(users.id, Number(params.id)));
      return { message: "User deleted successfully" };
    },
    { params: t.Object({ id: t.String() }) }
  );

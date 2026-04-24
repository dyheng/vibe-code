import { Elysia } from "elysia";

/**
 * Parses `Authorization: Bearer <session token>` for routes that use DB session tokens (not JWT).
 * Invalid or missing header short-circuits with 401 and `{ error: "Unauthorized" }`.
 */
export const sessionTokenAuth = new Elysia({ name: "session-token-auth" })
  .derive(({ headers }) => {
    const auth = headers["authorization"];
    if (!auth?.startsWith("Bearer ")) {
      return { sessionToken: null as string | null };
    }
    const token = auth.slice(7).trim();
    if (!token) {
      return { sessionToken: null as string | null };
    }
    return { sessionToken: token };
  })
  .onBeforeHandle(({ sessionToken, set }) => {
    if (sessionToken == null) {
      set.status = 401;
      return { error: "Unauthorized" };
    }
  });

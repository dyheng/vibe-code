import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { userRoutes } from "./routes/users-route";

const PORT = Number(process.env.PORT) || 3000;

const app = new Elysia()
  .use(cors())
  .get("/", () => ({ message: "API is running" }))
  .use(userRoutes)
  .listen(PORT);

console.log(`Server running at http://localhost:${PORT}`);

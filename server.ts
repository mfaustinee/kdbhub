import { appPromise } from "./api/index";
import { createServer as createViteServer } from "vite";

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

async function startServer() {
  const app = await appPromise;
  
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  }
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
});

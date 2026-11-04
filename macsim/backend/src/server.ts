import { buildApp } from './app.js';
import { env } from './config/env.js';

async function startServer() {
  const app = await buildApp();

  try {
    const address = await app.listen({
      port: env.PORT,
      host: env.HOST,
    });
    app.log.info(`🚀 MACSim Backend running at ${address}`);
    app.log.info(`📚 Swagger Documentation at ${address}/docs`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  for (const signal of signals) {
    process.on(signal, async () => {
      app.log.info(`Received ${signal}, closing server gracefully...`);
      await app.close();
      process.exit(0);
    });
  }
}

startServer();


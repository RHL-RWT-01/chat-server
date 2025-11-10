import { ChatServer } from './server.js';
import { logger } from './logger.js';

const main = (): void => {
  try {
    logger.info('Starting TCP Chat Server...');

    const server = new ChatServer();
    server.start();

    // Log stats periodically
    setInterval(() => {
      const stats = server.getStats();
      logger.debug('Server stats:', stats);
    }, 60000); // Every minute
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

main();

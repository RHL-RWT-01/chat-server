import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

interface Config {
  env: string;
  port: number;
  host: string;
  maxConnections: number;
  usernameMaxLength: number;
  messageMaxLength: number;
  logging: {
    level: string;
    filePath: string;
  };
}

const config: Config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  host: process.env.HOST || '0.0.0.0',
  maxConnections: parseInt(process.env.MAX_CONNECTIONS || '100', 10),
  usernameMaxLength: parseInt(process.env.USERNAME_MAX_LENGTH || '20', 10),
  messageMaxLength: parseInt(process.env.MESSAGE_MAX_LENGTH || '1000', 10),
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    filePath: process.env.LOG_FILE_PATH || './logs',
  },
};

export default config;

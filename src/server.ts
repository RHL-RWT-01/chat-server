import net, { Socket } from 'net';
import config from './config.js';
import { logger } from './logger.js';
import { Client } from './types.js';
import { CommandParser } from './parser.js';

export class ChatServer {
  private server: net.Server;
  private clients: Map<string, Client> = new Map(); // socketId -> Client
  private usernames: Map<string, string> = new Map(); // username -> socketId

  constructor() {
    this.server = net.createServer(this.handleConnection.bind(this));
    this.setupErrorHandlers();
  }

  /**
   * Setup server error handlers
   */
  private setupErrorHandlers(): void {
    this.server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${config.port} is already in use`);
      } else {
        logger.error('Server error:', error);
      }
      process.exit(1);
    });

    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
  }

  /**
   * Handle new client connection
   */
  private handleConnection(socket: Socket): void {
    const socketId = `${socket.remoteAddress}:${socket.remotePort}`;
    const clientAddress = socket.remoteAddress || 'unknown';

    // Check connection limit
    if (this.clients.size >= config.maxConnections) {
      logger.warn(`Connection rejected: max connections reached (${clientAddress})`);
      socket.write('ERR server-full\n');
      socket.end();
      return;
    }

    // Create client object
    const client: Client = {
      socket,
      username: null,
      address: clientAddress,
      connectedAt: new Date(),
    };

    this.clients.set(socketId, client);
    logger.info(`Client connected: ${socketId} (${this.clients.size} total)`);

    // Setup client handlers
    let buffer = '';

    socket.on('data', (data: Buffer) => {
      buffer += data.toString('utf8');

      // Process complete lines
      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        const line = buffer.substring(0, newlineIndex);
        buffer = buffer.substring(newlineIndex + 1);

        if (line.trim()) {
          this.handleClientMessage(socketId, line);
        }
      }

      // Prevent buffer overflow
      if (buffer.length > config.messageMaxLength * 2) {
        logger.warn(`Buffer overflow for client ${socketId}`);
        this.sendError(socket, 'message-too-long');
        buffer = '';
      }
    });

    socket.on('error', (error: Error) => {
      logger.error(`Socket error for ${socketId}:`, error);
    });

    socket.on('close', () => {
      this.handleDisconnect(socketId);
    });

    socket.on('timeout', () => {
      logger.warn(`Socket timeout for ${socketId}`);
      socket.end();
    });

    // Set timeout (5 minutes)
    socket.setTimeout(300000);
  }

  /**
   * Handle client message
   */
  private handleClientMessage(socketId: string, message: string): void {
    const client = this.clients.get(socketId);
    if (!client) return;

    const command = CommandParser.parse(message);
    logger.debug(`Command from ${socketId}:`, { type: command.type, args: command.args });

    switch (command.type) {
      case 'LOGIN':
        this.handleLogin(client, socketId, command.args[0] || '');
        break;

      case 'MSG':
        this.handleMessage(client, command.args[0] || '');
        break;

      case 'WHO':
        this.handleWho(client);
        break;

      case 'DM':
        this.handleDirectMessage(client, command.args[0], command.args[1]);
        break;

      default:
        this.sendError(client.socket, 'unknown-command');
    }
  }

  /**
   * Handle LOGIN command
   */
  private handleLogin(client: Client, socketId: string, username: string): void {
    // Check if already logged in
    if (client.username) {
      this.sendError(client.socket, 'already-logged-in');
      return;
    }

    // Validate username
    if (!CommandParser.isValidUsername(username)) {
      this.sendError(client.socket, 'invalid-username');
      return;
    }

    // Check if username is taken
    if (this.usernames.has(username)) {
      client.socket.write('ERR username-taken\n');
      logger.info(`Login failed: username taken (${username})`);
      return;
    }

    // Set username
    client.username = username;
    this.usernames.set(username, socketId);
    client.socket.write('OK\n');

    logger.info(`User logged in: ${username} (${socketId})`);

    // Notify other users
    this.broadcast(`INFO ${username} joined\n`, socketId);
  }

  /**
   * Handle MSG command
   */
  private handleMessage(client: Client, message: string): void {
    // Check if logged in
    if (!client.username) {
      this.sendError(client.socket, 'not-logged-in');
      return;
    }

    // Validate message
    if (!CommandParser.isValidMessage(message)) {
      this.sendError(client.socket, 'invalid-message');
      return;
    }

    // Sanitize and broadcast
    const sanitized = CommandParser.sanitizeMessage(message);
    const broadcastMsg = `MSG ${client.username} ${sanitized}\n`;

    this.broadcast(broadcastMsg);

    logger.info(
      `Message from ${client.username}: ${sanitized.substring(0, 50)}${sanitized.length > 50 ? '...' : ''}`
    );
  }

  /**
   * Handle WHO command
   */
  private handleWho(client: Client): void {
    // Check if logged in
    if (!client.username) {
      this.sendError(client.socket, 'not-logged-in');
      return;
    }

    // Send list of all logged-in users
    for (const username of this.usernames.keys()) {
      client.socket.write(`USER ${username}\n`);
    }

    logger.debug(`WHO command from ${client.username}`);
  }

  /**
   * Handle DM command
   */
  private handleDirectMessage(client: Client, targetUsername: string, message: string): void {
    // Check if logged in
    if (!client.username) {
      this.sendError(client.socket, 'not-logged-in');
      return;
    }

    // Validate target username
    if (!targetUsername || !message) {
      this.sendError(client.socket, 'invalid-dm-format');
      return;
    }

    // Find target client
    const targetSocketId = this.usernames.get(targetUsername);
    if (!targetSocketId) {
      this.sendError(client.socket, 'user-not-found');
      return;
    }

    const targetClient = this.clients.get(targetSocketId);
    if (!targetClient) {
      this.sendError(client.socket, 'user-not-found');
      return;
    }

    // Validate message
    if (!CommandParser.isValidMessage(message)) {
      this.sendError(client.socket, 'invalid-message');
      return;
    }

    // Send DM
    const sanitized = CommandParser.sanitizeMessage(message);
    targetClient.socket.write(`DM ${client.username} ${sanitized}\n`);

    logger.info(`DM from ${client.username} to ${targetUsername}`);
  }

  /**
   * Handle client disconnect
   */
  private handleDisconnect(socketId: string): void {
    const client = this.clients.get(socketId);
    if (!client) return;

    const username = client.username;

    // Remove from maps
    this.clients.delete(socketId);
    if (username) {
      this.usernames.delete(username);

      // Notify other users
      this.broadcast(`INFO ${username} disconnected\n`);
      logger.info(`User disconnected: ${username} (${socketId})`);
    } else {
      logger.info(`Client disconnected: ${socketId} (not logged in)`);
    }

    logger.info(`Total clients: ${this.clients.size}`);
  }

  /**
   * Broadcast message to all clients (or all except one)
   */
  private broadcast(message: string, excludeSocketId?: string): void {
    for (const [socketId, client] of this.clients.entries()) {
      // Skip if not logged in or is excluded
      if (!client.username || socketId === excludeSocketId) {
        continue;
      }

      try {
        client.socket.write(message);
      } catch (error) {
        logger.error(`Failed to broadcast to ${client.username}:`, error);
      }
    }
  }

  /**
   * Send error message to client
   */
  private sendError(socket: Socket, errorCode: string): void {
    socket.write(`ERR ${errorCode}\n`);
  }

  /**
   * Start the server
   */
  public start(): void {
    this.server.listen(config.port, config.host, () => {
      logger.info(`TCP Chat Server listening on ${config.host}:${config.port}`);
      logger.info(`Environment: ${config.env}`);
      logger.info(`Max connections: ${config.maxConnections}`);
    });
  }

  /**
   * Shutdown the server gracefully
   */
  private shutdown(): void {
    logger.info('Shutting down server...');

    // Notify all clients
    for (const client of this.clients.values()) {
      try {
        client.socket.write('INFO server-shutting-down\n');
        client.socket.end();
      } catch (error) {
        logger.error('Error closing client socket:', error);
      }
    }

    this.server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });

    // Force exit after 5 seconds
    setTimeout(() => {
      logger.warn('Forcing shutdown...');
      process.exit(1);
    }, 5000);
  }

  /**
   * Get server statistics
   */
  public getStats(): { totalClients: number; loggedInUsers: number; uptime: number } {
    return {
      totalClients: this.clients.size,
      loggedInUsers: this.usernames.size,
      uptime: process.uptime(),
    };
  }
}

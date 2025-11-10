import { WebSocketServer, WebSocket } from 'ws';
import net from 'net';
import config from './config.js';
import { logger } from './logger.js';

const WS_PORT = 8080;

interface WebSocketClient {
    ws: WebSocket;
    tcpSocket: net.Socket | null;
    id: string;
}

class WebSocketProxy {
    private wss: WebSocketServer;
    private clients: Map<string, WebSocketClient> = new Map();

    constructor() {
        this.wss = new WebSocketServer({ port: WS_PORT });
        this.setupWebSocketServer();
    }

    private setupWebSocketServer(): void {
        this.wss.on('connection', (ws: WebSocket, req) => {
            const clientId = `${req.socket.remoteAddress}:${req.socket.remotePort}`;
            logger.info(`WebSocket client connected: ${clientId}`);

            const client: WebSocketClient = {
                ws,
                tcpSocket: null,
                id: clientId,
            };

            this.clients.set(clientId, client);

            // Connect to TCP server
            this.connectToTcpServer(client);

            // Handle WebSocket messages
            ws.on('message', (data: Buffer) => {
                const message = data.toString('utf8');
                if (client.tcpSocket && !client.tcpSocket.destroyed) {
                    client.tcpSocket.write(message + '\n');
                    logger.debug(`WS -> TCP: ${message}`);
                }
            });

            // Handle WebSocket close
            ws.on('close', () => {
                logger.info(`WebSocket client disconnected: ${clientId}`);
                if (client.tcpSocket) {
                    client.tcpSocket.end();
                }
                this.clients.delete(clientId);
            });

            // Handle WebSocket errors
            ws.on('error', (error: Error) => {
                logger.error(`WebSocket error for ${clientId}:`, error);
            });
        });

        logger.info(`WebSocket proxy listening on port ${WS_PORT}`);
    }

    private connectToTcpServer(client: WebSocketClient): void {
        const tcpSocket = net.createConnection({
            port: config.port,
            host: 'localhost',
        });

        client.tcpSocket = tcpSocket;

        tcpSocket.on('connect', () => {
            logger.info(`TCP connection established for ${client.id}`);
            client.ws.send(
                JSON.stringify({
                    type: 'system',
                    message: 'Connected to TCP chat server',
                })
            );
        });

        tcpSocket.on('data', (data: Buffer) => {
            const message = data.toString('utf8');
            logger.debug(`TCP -> WS: ${message}`);

            if (client.ws.readyState === WebSocket.OPEN) {
                client.ws.send(
                    JSON.stringify({
                        type: 'server',
                        message: message.trim(),
                    })
                );
            }
        });

        tcpSocket.on('close', () => {
            logger.info(`TCP connection closed for ${client.id}`);
            if (client.ws.readyState === WebSocket.OPEN) {
                client.ws.send(
                    JSON.stringify({
                        type: 'system',
                        message: 'Disconnected from TCP server',
                    })
                );
            }
        });

        tcpSocket.on('error', (error: Error) => {
            logger.error(`TCP error for ${client.id}:`, error);
            if (client.ws.readyState === WebSocket.OPEN) {
                client.ws.send(
                    JSON.stringify({
                        type: 'error',
                        message: `Cannot connect to TCP server at localhost:${config.port}. Make sure the TCP chat server is running (npm run dev).`,
                    })
                );
                client.ws.close();
            }
        });
    }

    public start(): void {
        logger.info('WebSocket proxy server started');
    }
}

// Start the proxy
const proxy = new WebSocketProxy();
proxy.start();

export { WebSocketProxy };

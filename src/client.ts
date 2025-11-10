import net from 'net';
import readline from 'readline';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 4000;
const HOST = process.env.HOST || 'localhost';

class ChatClient {
  private client: net.Socket;
  private rl: readline.Interface;
  private connected = false;

  constructor() {
    this.client = net.createConnection({ port: PORT, host: HOST });
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.client.on('connect', () => {
      this.connected = true;
      console.log(`\n✓ Connected to server at ${HOST}:${PORT}`);
      console.log('\nCommands:');
      console.log('  LOGIN <username>  - Log in with a username');
      console.log('  MSG <text>        - Send a message to everyone');
      console.log('  WHO               - List all online users');
      console.log('  DM <user> <text>  - Send a private message');
      console.log('  /quit             - Disconnect\n');

      this.promptInput();
    });

    this.client.on('data', (data: Buffer) => {
      const message = data.toString('utf8').trim();
      if (message) {
        // Clear current line and print message
        process.stdout.clearLine(0);
        process.stdout.cursorTo(0);
        console.log(message);

        // Redisplay prompt if still connected
        if (this.connected) {
          this.promptInput();
        }
      }
    });

    this.client.on('error', (error: Error) => {
      console.error(`\n✗ Connection error: ${error.message}`);
      this.cleanup();
    });

    this.client.on('close', () => {
      console.log('\n✗ Disconnected from server');
      this.cleanup();
    });
  }

  private promptInput(): void {
    this.rl.question('> ', (input: string) => {
      if (!input.trim()) {
        this.promptInput();
        return;
      }

      if (input.trim() === '/quit') {
        console.log('Goodbye!');
        this.client.end();
        return;
      }

      this.client.write(input.trim() + '\n');

      if (this.connected) {
        this.promptInput();
      }
    });
  }

  private cleanup(): void {
    this.connected = false;
    this.rl.close();
    process.exit(0);
  }
}

// Start client
new ChatClient();

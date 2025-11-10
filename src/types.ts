import { Socket } from 'net';

export interface Client {
  socket: Socket;
  username: string | null;
  address: string;
  connectedAt: Date;
}

export interface Command {
  type: 'LOGIN' | 'MSG' | 'WHO' | 'DM' | 'UNKNOWN';
  args: string[];
  raw: string;
}

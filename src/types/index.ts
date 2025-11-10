export interface IUser {
  _id: string;
  username: string;
  email: string;
  password: string;
  isOnline: boolean;
  socketId?: string;
  lastSeen: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IRoom {
  _id: string;
  name: string;
  description?: string;
  isPrivate: boolean;
  createdBy: string;
  members: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IMessage {
  _id: string;
  roomId: string;
  userId: string;
  username: string;
  content: string;
  type: 'text' | 'system';
  isEdited: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAuthPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

export interface ISocketUser {
  userId: string;
  username: string;
  socketId: string;
  currentRoom?: string;
}

export interface ServerToClientEvents {
  'message:new': (message: IMessage) => void;
  'message:history': (messages: IMessage[]) => void;
  'user:joined': (data: { username: string; roomId: string }) => void;
  'user:left': (data: { username: string; roomId: string }) => void;
  'user:typing': (data: { username: string; roomId: string }) => void;
  'user:stop-typing': (data: { username: string; roomId: string }) => void;
  'room:users': (users: string[]) => void;
  error: (error: { message: string; code?: string }) => void;
}

export interface ClientToServerEvents {
  'message:send': (data: { roomId: string; content: string }) => void;
  'room:join': (roomId: string) => void;
  'room:leave': (roomId: string) => void;
  'typing:start': (roomId: string) => void;
  'typing:stop': (roomId: string) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  userId: string;
  username: string;
}

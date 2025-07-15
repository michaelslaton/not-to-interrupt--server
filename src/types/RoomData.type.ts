import type { UserType } from './UserType.type';

type ChatEntry = {
  user: string;
  message: string;
  color: string;
}

type RoomDataType = {
  roomId: string;
  name: string;
  hostId: string;
  users: UserType[];
  chat: ChatEntry[];
};

export type { RoomDataType };
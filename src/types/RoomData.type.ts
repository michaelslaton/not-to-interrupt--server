import type { UserType } from './UserType.type';

type RoomDataType = {
  roomId: string;
  name: string;
  hostId: string;
  users: UserType[];
};

export type { RoomDataType };
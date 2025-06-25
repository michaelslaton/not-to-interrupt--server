import type { ControllerType } from './Controller.type';

type UserType = {
  id: string;
  name: string;
  socketId: string;
  controller: ControllerType;
};

export type { UserType };
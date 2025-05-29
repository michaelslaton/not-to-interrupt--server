import type { ControllerType } from './Controller.type';

type UserType = {
  id: string;
  name: string;
  controller: ControllerType;
};

export type { UserType };
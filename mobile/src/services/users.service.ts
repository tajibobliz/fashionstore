import { api } from "./api";

export const usersService = {
  async registerPushToken(token: string): Promise<void> {
    await api.post("/users/me/push-token", { token });
  },
};

import { io } from "socket.io-client";
export function makeSocket() {
  return io("/", { transports: ["websocket", "polling"] });
}

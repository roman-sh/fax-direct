/** Returns whether an incoming HTTP request is asking to upgrade to WebSocket. */
export function isWebSocketUpgradeRequest(request: Request): boolean {
  return request.headers.get("Upgrade")?.toLowerCase() === "websocket"
}

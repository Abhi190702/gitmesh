import net from "node:net";

export type PortCheckResult = {
  available: boolean;
  error?: string;
};

export function checkPort(port: number): Promise<PortCheckResult> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        resolve({ available: false, error: `[gitmesh] Port ${port} is already in use` });
      } else {
        resolve({ available: false, error: err.message });
      }
    });
    server.on("listening", () => {
      server.close(() => resolve({ available: true }));
    });
    server.listen(port, "127.0.0.1");
  });
}

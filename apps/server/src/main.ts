// The server's entry point: start it with this process and its environment.

import { startServer } from "./start";

void startServer({ env: process.env, process });

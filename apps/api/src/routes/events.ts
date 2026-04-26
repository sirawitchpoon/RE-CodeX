// SSE event endpoints. Each topic is a long-lived GET that the frontend
// keeps open with EventSource. Redis subscriptions are set up once at boot
// in src/index.ts — these routes only hand the connection to the hub.

import { Router } from "express";
import { hub, type Topic } from "../sse.js";

export const eventsRouter = Router();

function bind(topic: Topic) {
  return (req: import("express").Request, res: import("express").Response) => {
    hub.attach(topic, req, res);
  };
}

eventsRouter.get("/events/logs", bind("logs"));
eventsRouter.get("/events/dashboard", bind("dashboard"));

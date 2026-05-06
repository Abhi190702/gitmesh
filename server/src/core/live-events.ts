import { EventEmitter } from "node:events";
import type { LiveEvent, LiveEventType } from "@gitmesh/core";

type LiveEventPayload = Record<string, unknown>;
type LiveEventListener = (event: LiveEvent) => void;

const emitter = new EventEmitter();
emitter.setMaxListeners(0);

let nextEventId = 0;

function toLiveEvent(input: {
  projectId: string;
  type: LiveEventType;
  payload?: LiveEventPayload;
}): LiveEvent {
  nextEventId += 1;
  return {
    id: nextEventId,
    projectId: input.projectId,
    type: input.type,
    createdAt: new Date().toISOString(),
    payload: input.payload ?? {},
  };
}

export function publishLiveEvent(input: {
  projectId: string;
  type: LiveEventType;
  payload?: LiveEventPayload;
}) {
  const event = toLiveEvent(input);
  emitter.emit(input.projectId, event);
  return event;
}

export function subscribeProjectLiveEvents(projectId: string, listener: LiveEventListener) {
  emitter.on(projectId, listener);
  return () => emitter.off(projectId, listener);
}

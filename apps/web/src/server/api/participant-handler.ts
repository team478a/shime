import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireParticipantForEvent } from "../participant-auth";
import { AppError, appErrorResponse } from "./errors";

type ParticipantAuth = Awaited<ReturnType<typeof requireParticipantForEvent>>;

export type ParticipantHandlerContext = ParticipantAuth & {
  eventId: string;
  requestId: string;
};

type ParticipantHandlerDependencies = {
  loadParticipant: (eventId: string) => Promise<ParticipantAuth | null>;
  createRequestId: () => string;
};

const defaultDependencies: ParticipantHandlerDependencies = {
  loadParticipant: (eventId) => requireParticipantForEvent(eventId).catch(() => null),
  createRequestId: randomUUID,
};

export function createParticipantHandler(dependencies: ParticipantHandlerDependencies = defaultDependencies) {
  return function participantHandler<Arguments extends unknown[]>(
    resolveEventId: (...args: Arguments) => Promise<string> | string,
    handle: (context: ParticipantHandlerContext, ...args: Arguments) => Promise<Response> | Response,
  ) {
    return async (...args: Arguments): Promise<Response> => {
      const eventId = await resolveEventId(...args);
      const auth = await dependencies.loadParticipant(eventId);
      if (!auth) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });

      const requestId = dependencies.createRequestId();
      try {
        return await handle({ ...auth, eventId, requestId }, ...args);
      } catch (error) {
        if (error instanceof AppError) return appErrorResponse(error, requestId, false);
        throw error;
      }
    };
  };
}

export const participantHandler = createParticipantHandler();

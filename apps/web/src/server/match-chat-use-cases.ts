import {
  AcceptMatchChatConsent,
  BlockMatchChatRoom,
  createDrizzleMatchChatSafetyRepository,
  EnsureMatchChatRoom,
  GetMatchChatAvailability,
  ListMatchChatMessages,
  ReportMatchChatParticipant,
  SendMatchChatMessage,
} from "@shime/match-chat";
import { matchChatMessageCipher } from "./match-chat-cipher";

const repository = createDrizzleMatchChatSafetyRepository();

export const ensureMatchChatRoom = new EnsureMatchChatRoom(repository);
export const getMatchChatAvailability = new GetMatchChatAvailability(repository);
export const acceptMatchChatConsent = new AcceptMatchChatConsent(repository);
export const listMatchChatMessages = new ListMatchChatMessages(repository, matchChatMessageCipher);
export const sendMatchChatMessage = new SendMatchChatMessage(repository, matchChatMessageCipher);
export const blockMatchChatRoom = new BlockMatchChatRoom(repository);
export const reportMatchChatParticipant = new ReportMatchChatParticipant(repository);

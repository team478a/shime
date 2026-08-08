import {
  createDrizzleMatchChatAdminRepository,
  GetMatchChatAdminWorkspace,
  PurgeExpiredMatchChatMessages,
  SaveMatchChatConfig,
  UpdateMatchChatReportStatus,
} from "@shime/match-chat";

const repository = createDrizzleMatchChatAdminRepository();

export const matchChatAdmin = {
  getWorkspace: new GetMatchChatAdminWorkspace(repository),
  saveConfig: new SaveMatchChatConfig(repository),
  updateReport: new UpdateMatchChatReportStatus(repository),
  purgeExpiredMessages: new PurgeExpiredMatchChatMessages(repository),
};

import {
  createDrizzleInteractionMemoAdminRepository,
  CreateInteractionMemoDraft,
  ListInteractionMemoSnapshots,
  PublishInteractionMemoSnapshot,
  StopInteractionMemoSnapshot,
} from "@shime/interactions";

const repository = createDrizzleInteractionMemoAdminRepository();

export const interactionMemoAdmin = {
  list: new ListInteractionMemoSnapshots(repository),
  createDraft: new CreateInteractionMemoDraft(repository),
  publish: new PublishInteractionMemoSnapshot(repository),
  stop: new StopInteractionMemoSnapshot(repository),
};

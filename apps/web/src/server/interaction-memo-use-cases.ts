import {
  CancelSelfReportedInteractionSlot,
  createDrizzleInteractionMemoRepository,
  CreateSelfReportedInteractionSlot,
  GetInteractionMemoWorkspace,
  GetInteractionPublicProfile,
  SaveInteractionMemo,
  SearchSelfReportedInteractionTargets,
} from "@shime/interactions";

const repository = createDrizzleInteractionMemoRepository();

export const getInteractionMemoWorkspace = new GetInteractionMemoWorkspace(repository);
export const getInteractionPublicProfile = new GetInteractionPublicProfile(repository);
export const saveInteractionMemo = new SaveInteractionMemo(repository);
export const searchSelfReportedInteractionTargets = new SearchSelfReportedInteractionTargets(repository);
export const createSelfReportedInteractionSlot = new CreateSelfReportedInteractionSlot(repository);
export const cancelSelfReportedInteractionSlot = new CancelSelfReportedInteractionSlot(repository);

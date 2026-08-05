import {
  createDrizzleInteractionMemoRepository,
  GetInteractionMemoWorkspace,
  SaveInteractionMemo,
} from "@shime/interactions";

const repository = createDrizzleInteractionMemoRepository();

export const getInteractionMemoWorkspace = new GetInteractionMemoWorkspace(repository);
export const saveInteractionMemo = new SaveInteractionMemo(repository);

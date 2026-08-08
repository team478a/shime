import type {
  AssignParticipantNumberInput,
  AssignParticipantNumberRepositoryResult,
  ConfirmCheckinInput,
  ConfirmCheckinRepositoryResult,
} from "./checkin-types";

export interface CheckinRepository {
  confirm(input: ConfirmCheckinInput): Promise<ConfirmCheckinRepositoryResult>;
  assignParticipantNumber(input: AssignParticipantNumberInput): Promise<AssignParticipantNumberRepositoryResult>;
}

import type { ConfirmCheckinInput, ConfirmCheckinRepositoryResult } from "./checkin-types";

export interface CheckinRepository {
  confirm(input: ConfirmCheckinInput): Promise<ConfirmCheckinRepositoryResult>;
}

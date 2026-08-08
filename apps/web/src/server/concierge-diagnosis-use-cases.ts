import {
  createDrizzleConciergeDiagnosisRepository,
  GetDiagnosis,
  GetDiagnosisCardObjectKey,
  GetDiagnosisStatusSummary,
  SaveDiagnosisDraft,
  StartDiagnosis,
  SubmitDiagnosis,
  UpdateDiagnosisEventSettings,
} from "@shime/concierge";

const repository = createDrizzleConciergeDiagnosisRepository();

export const getDiagnosis = new GetDiagnosis(repository);
export const startDiagnosis = new StartDiagnosis(repository);
export const saveDiagnosisDraft = new SaveDiagnosisDraft(repository);
export const submitDiagnosis = new SubmitDiagnosis(repository);
export const getDiagnosisCardObjectKey = new GetDiagnosisCardObjectKey(repository);
export const getDiagnosisStatusSummary = new GetDiagnosisStatusSummary(repository);
export const updateDiagnosisEventSettings = new UpdateDiagnosisEventSettings(repository);

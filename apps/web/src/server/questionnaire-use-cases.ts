import {
  createDrizzleQuestionnaireRepository,
  GetQuestionnaire,
  SaveQuestionnaireDraft,
  SubmitQuestionnaire,
} from "@shime/questionnaire";

const repository = createDrizzleQuestionnaireRepository();

export const getQuestionnaire = new GetQuestionnaire(repository);
export const saveQuestionnaireDraft = new SaveQuestionnaireDraft(repository);
export const submitQuestionnaire = new SubmitQuestionnaire(repository);

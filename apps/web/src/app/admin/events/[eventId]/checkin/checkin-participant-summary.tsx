import { getParticipantStatusLabel } from "../../../../../lib/status-labels";

export type CheckinPreview = {
  participantId: string;
  participantNumber: string;
  fullName: string;
  participantStatus: string;
  alreadyCheckedIn: boolean;
  checkedInAt?: string;
  receptionCategoryLabel?: string | null;
  receptionNumber?: number | null;
};

export function getReceptionNumber(preview: CheckinPreview) {
  if (preview.receptionNumber === null || preview.receptionNumber === undefined) return null;
  return `${preview.receptionCategoryLabel ?? ""}${preview.receptionNumber}番`;
}

export function getConfirmedCheckinMessage(preview: CheckinPreview) {
  const receptionNumber = getReceptionNumber(preview);
  return receptionNumber ? `受付を確定しました。受付番号は${receptionNumber}です。` : "受付を確定しました。";
}

export function getCheckinFailureMessage(status: number) {
  return status === 409 ? "すでに受付済みです。" : "受付を確定できませんでした。もう一度お試しください。";
}

export function CheckinParticipantSummary({
  participant,
  includeIdentity = false,
}: {
  participant: CheckinPreview;
  includeIdentity?: boolean;
}) {
  const receptionNumber = getReceptionNumber(participant);

  return (
    <dl>
      {includeIdentity && (
        <>
          <dt>氏名</dt>
          <dd>{participant.fullName}</dd>
          <dt>参加者番号</dt>
          <dd>{participant.participantNumber}</dd>
        </>
      )}
      <dt>参加状態</dt>
      <dd>{getParticipantStatusLabel(participant.participantStatus)}</dd>
      <dt>受付</dt>
      <dd>{participant.alreadyCheckedIn ? "受付済み" : "未受付"}</dd>
      {receptionNumber && (
        <>
          <dt>受付番号</dt>
          <dd>{receptionNumber}</dd>
        </>
      )}
    </dl>
  );
}

export function CheckinCandidateCard({
  candidate,
  onSelect,
}: {
  candidate: CheckinPreview;
  onSelect: (candidate: CheckinPreview) => void;
}) {
  return (
    <article className="admin-list-card">
      <div>
        <strong>{candidate.participantNumber}</strong>
        <span>{candidate.fullName}</span>
      </div>
      <CheckinParticipantSummary participant={candidate} />
      <button type="button" onClick={() => onSelect(candidate)}>
        この参加者を確認
      </button>
    </article>
  );
}

"use client";

import { useInteractionPublicProfile } from "../../../hooks/use-interaction-public-profile";
import type { InteractionMemoTargetDto } from "../../../lib/interaction-memo-client";

type Props = { eventId: string; target: InteractionMemoTargetDto };

export function InteractionPublicProfile({ eventId, target }: Props) {
  const { profile, status, toggle } = useInteractionPublicProfile(eventId, target.targetParticipantId);

  return (
    <section className="interaction-public-profile">
      <button type="button" className="interaction-participant-number" onClick={toggle} disabled={status === "loading"}>
        {target.participantNumber}
        <span>{status === "open" ? "閉じる" : status === "loading" ? "読込中…" : "プロフィールを見る"}</span>
      </button>
      {status === "open" && profile && (
        <div className="interaction-public-profile-fields">
          {profile.fields.length === 0 ? (
            <p>このイベントで公開されているプロフィール項目はありません。</p>
          ) : (
            <dl>
              {profile.fields.map((field) => (
                <div key={field.key}>
                  <dt>{field.label}</dt>
                  <dd>{field.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}
      {status === "error" && (
        <p role="alert" className="interaction-profile-error">
          プロフィールを表示できませんでした。もう一度お試しください。
        </p>
      )}
    </section>
  );
}

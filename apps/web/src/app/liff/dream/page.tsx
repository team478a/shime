"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ParticipantNotice, ParticipantPageHeader } from "../../../components/participant-ui";
import { useLiffEventId } from "../../../lib/liff-location";

type Card = { id: string; name: string; imageKey: string | null; description: string | null };
type BusyAction = "reflection" | "suggestions" | "confirm" | "skip" | "";

export default function DreamPage() {
  const eventId = useLiffEventId();
  const [cards, setCards] = useState<Card[]>([]);
  const [optional, setOptional] = useState(false);
  const [selected, setSelected] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [dreamText, setDreamText] = useState("");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"neutral" | "success" | "error">("neutral");
  const [loadState, setLoadState] = useState<"idle" | "loaded" | "error">("idle");
  const [busyAction, setBusyAction] = useState<BusyAction>("");
  const [selectionSaved, setSelectionSaved] = useState(false);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (!eventId) return;
    fetch(`/api/liff/events/${eventId}/emotion-cards`)
      .then(async (response) => ({ response, body: await response.json() }))
      .then(({ response, body }) => {
        if (!response.ok) throw new Error();
        setCards(body.data.cards);
        setOptional(body.data.registrationMode === "optional");
      })
      .then(() => setLoadState("loaded"))
      .catch(() => setLoadState("error"));
  }, [eventId]);

  function showMessage(text: string, tone: "neutral" | "success" | "error" = "neutral") {
    setMessage(text);
    setMessageTone(tone);
  }

  async function loadSuggestions() {
    setBusyAction("suggestions");
    showMessage("");
    try {
      const response = await fetch(`/api/liff/events/${eventId}/dream/suggestions`, { method: "POST" });
      const body = await response.json();
      if (!response.ok || !Array.isArray(body.data?.candidates) || body.data.candidates.length === 0) {
        showMessage("夢候補を準備できませんでした。もう一度お試しください。", "error");
        return false;
      }
      setSuggestions(body.data.candidates);
      setDreamText(body.data.candidates[0]);
      return true;
    } catch {
      showMessage("通信できませんでした。回答は保存されているため、接続後に再試行できます。", "error");
      return false;
    } finally {
      setBusyAction("");
    }
  }

  async function answer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusyAction("reflection");
    showMessage("");
    try {
      const response = await fetch(`/api/liff/events/${eventId}/emotion-selection`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          emotionCardId: selected,
          firstImpression: form.get("firstImpression"),
          relatedArea: form.get("relatedArea"),
          underlyingWish: form.get("underlyingWish"),
          freeText: form.get("freeText") || undefined,
          finalize: true,
        }),
      });
      const body = await response.json();
      if (!response.ok && body.code !== "SELECTION_FINALIZED") {
        showMessage("回答を保存できませんでした。入力内容を確認してください。", "error");
        return;
      }
      setSelectionSaved(true);
    } catch {
      showMessage("通信できませんでした。接続を確認してください。", "error");
      return;
    } finally {
      setBusyAction("");
    }
    await loadSuggestions();
  }

  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dreamText.trim()) {
      showMessage("夢の内容を入力してください。", "error");
      return;
    }
    const form = new FormData(event.currentTarget);
    setBusyAction("confirm");
    showMessage("");
    try {
      const response = await fetch("/api/liff/me/dream", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          eventId,
          dreamText,
          visibility: form.get("visibility"),
          projectOptIn: form.get("projectOptIn") === "on",
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        showMessage("夢を登録できませんでした。入力内容を確認してください。", "error");
        return;
      }
      setCompleted(true);
      showMessage(`夢を登録しました（Dream No. ${body.data.dreamNo}）`, "success");
    } catch {
      showMessage("通信できませんでした。接続を確認してください。", "error");
    } finally {
      setBusyAction("");
    }
  }

  async function skip() {
    setBusyAction("skip");
    showMessage("");
    try {
      const response = await fetch("/api/liff/me/dream/skip", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventId }),
      });
      if (!response.ok) {
        showMessage("スキップできませんでした。運営へご確認ください。", "error");
        return;
      }
      setCompleted(true);
      showMessage("今回は夢を登録せずに進みます。後から登録できます。", "success");
    } catch {
      showMessage("通信できませんでした。接続を確認してください。", "error");
    } finally {
      setBusyAction("");
    }
  }

  return (
    <main>
      <div className="participant-page">
        <section className="panel wide participant-content">
          <ParticipantPageHeader
            eyebrow="DREAM CONNECTION"
            title="今の気持ちに近いカード"
            description="今の気持ちを入口に、これから大切にしたいことを見つけます。"
            current="dream"
            eventId={eventId}
          />
          {eventId && loadState === "idle" && <ParticipantNotice>感情カードを読み込んでいます…</ParticipantNotice>}
          {(!eventId || loadState === "error") && (
            <ParticipantNotice tone="error">
              感情カードを読み込めませんでした。LINEの案内から開き直してください。
            </ParticipantNotice>
          )}
          {loadState === "loaded" && cards.length === 0 && (
            <ParticipantNotice>感情カードはまだ準備されていません。</ParticipantNotice>
          )}
          {loadState === "loaded" && optional && !completed && (
            <div className="participant-skip">
              <p>夢登録は任意です。登録せずに次へ進むこともできます。</p>
              <button type="button" className="secondary" onClick={skip} disabled={Boolean(busyAction)}>
                {busyAction === "skip" ? "処理中…" : "今回は登録せず進む"}
              </button>
            </div>
          )}
          {loadState === "loaded" && !completed && (
            <div className="card-grid emotion-card-grid">
              {cards.map((card) => (
                <button
                  type="button"
                  className={selected === card.id ? "emotion-card selected" : "emotion-card"}
                  key={card.id}
                  onClick={() => setSelected(card.id)}
                  aria-pressed={selected === card.id}
                  disabled={Boolean(busyAction) || selectionSaved}
                >
                  {card.imageKey && <span className="card-image-key">{card.imageKey}</span>}
                  <strong>{card.name}</strong>
                  <small>{card.description}</small>
                </button>
              ))}
            </div>
          )}
          {completed && (
            <a className="button-link" href={`/liff/questionnaire?eventId=${eventId}`}>
              席案内の5問へ
            </a>
          )}
        </section>

        {selected && !selectionSaved && suggestions.length === 0 && !completed && (
          <form className="panel wide login-form participant-content" onSubmit={answer}>
            <p className="eyebrow">REFLECTION</p>
            <h2>カードについて教えてください</h2>
            <label>
              第一印象
              <input name="firstImpression" required disabled={Boolean(busyAction)} />
            </label>
            <label>
              どの領域に関係しますか
              <input name="relatedArea" required disabled={Boolean(busyAction)} />
            </label>
            <label>
              その奥にある願い
              <input name="underlyingWish" required disabled={Boolean(busyAction)} />
            </label>
            <label>
              自由記述
              <textarea name="freeText" disabled={Boolean(busyAction)} />
            </label>
            <button disabled={Boolean(busyAction)}>
              {busyAction === "reflection" ? "回答を保存中…" : "夢候補を見る"}
            </button>
          </form>
        )}

        {selectionSaved && suggestions.length === 0 && !completed && (
          <section className="panel wide participant-content">
            <h2>回答は保存されています</h2>
            <p>夢候補の準備だけをもう一度試せます。回答を入れ直す必要はありません。</p>
            <button type="button" onClick={loadSuggestions} disabled={Boolean(busyAction)}>
              {busyAction === "suggestions" ? "準備中…" : "夢候補を再読込"}
            </button>
          </section>
        )}

        {suggestions.length > 0 && !completed && (
          <form className="panel wide login-form participant-content" onSubmit={confirm}>
            <p className="eyebrow">YOUR DREAM</p>
            <h2>夢候補</h2>
            {suggestions.map((candidate) => (
              <button
                type="button"
                className="secondary dream-candidate"
                aria-pressed={dreamText === candidate}
                key={candidate}
                onClick={() => setDreamText(candidate)}
                disabled={Boolean(busyAction)}
              >
                {candidate}
              </button>
            ))}
            <label>
              選択・編集
              <textarea
                value={dreamText}
                onChange={(event) => setDreamText(event.target.value)}
                maxLength={500}
                disabled={Boolean(busyAction)}
              />
            </label>
            <label>
              公開範囲
              <select name="visibility" defaultValue="private" disabled={Boolean(busyAction)}>
                <option value="private">非公開</option>
                <option value="dream_only">夢のみ公開</option>
                <option value="nickname_and_dream">ニックネームと夢を公開</option>
              </select>
            </label>
            <label className="consent-choice">
              <input name="projectOptIn" type="checkbox" disabled={Boolean(busyAction)} />{" "}
              9999人夢応援プロジェクトへ任意参加する
            </label>
            <p className="participant-privacy">
              公開設定とプロジェクト参加は任意です。選択しなくてもイベントへ参加できます。
            </p>
            <button disabled={Boolean(busyAction) || !dreamText.trim()}>
              {busyAction === "confirm" ? "登録中…" : "この夢で確定"}
            </button>
          </form>
        )}

        {message && (
          <section className="panel wide">
            <ParticipantNotice tone={messageTone}>{message}</ParticipantNotice>
          </section>
        )}
      </div>
    </main>
  );
}

import { and, desc, eq, isNull } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { hasPermission } from "@shime/core";
import {
  applications,
  checkins,
  events,
  getDatabase,
  matchCandidates,
  notifications,
  participants,
  preferenceSubmissions,
  questionnaireResponses,
  resultConfirmations,
  seatAssignments,
  seatingRuns,
} from "@shime/db";

import { getStaffSession } from "../../../../../server/auth";
import {
  completionPercent,
  operationsMetricState,
  type OperationsMetric,
} from "../../../../../lib/operations-analytics";

export default async function OperationsAnalyticsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const session = await getStaffSession();
  if (!session) redirect("/admin/login");
  if (!hasPermission(session.role, "operations:read")) redirect("/admin");
  const { eventId } = await params;
  if (session.eventId && session.eventId !== eventId) notFound();
  const db = getDatabase();
  const event = (
    await db
      .select({ id: events.id, name: events.name, status: events.status })
      .from(events)
      .where(and(eq(events.id, eventId), eq(events.tenantId, session.tenantId)))
      .limit(1)
  )[0];
  if (!event) notFound();
  const [
    applicationRows,
    participantRows,
    checkinRows,
    questionnaireRows,
    preferenceRows,
    matchRows,
    notificationRows,
    activeConfirmation,
    latestRun,
  ] = await Promise.all([
    db
      .select({ status: applications.status })
      .from(applications)
      .where(and(eq(applications.tenantId, session.tenantId), eq(applications.eventId, eventId))),
    db
      .select({ userId: participants.userId, dreamState: participants.dreamState, status: participants.status })
      .from(participants)
      .where(and(eq(participants.tenantId, session.tenantId), eq(participants.eventId, eventId))),
    db
      .select({ status: checkins.status })
      .from(checkins)
      .where(and(eq(checkins.tenantId, session.tenantId), eq(checkins.eventId, eventId))),
    db
      .select({ status: questionnaireResponses.status })
      .from(questionnaireResponses)
      .where(and(eq(questionnaireResponses.tenantId, session.tenantId), eq(questionnaireResponses.eventId, eventId))),
    db
      .select({ status: preferenceSubmissions.status })
      .from(preferenceSubmissions)
      .where(and(eq(preferenceSubmissions.tenantId, session.tenantId), eq(preferenceSubmissions.eventId, eventId))),
    db
      .select({ status: matchCandidates.status })
      .from(matchCandidates)
      .where(and(eq(matchCandidates.tenantId, session.tenantId), eq(matchCandidates.eventId, eventId))),
    db
      .select({ status: notifications.status })
      .from(notifications)
      .where(and(eq(notifications.tenantId, session.tenantId), eq(notifications.eventId, eventId))),
    db
      .select({ id: resultConfirmations.id })
      .from(resultConfirmations)
      .where(
        and(
          eq(resultConfirmations.tenantId, session.tenantId),
          eq(resultConfirmations.eventId, eventId),
          isNull(resultConfirmations.revokedAt),
        ),
      )
      .limit(1),
    db
      .select({ id: seatingRuns.id, status: seatingRuns.status })
      .from(seatingRuns)
      .where(and(eq(seatingRuns.tenantId, session.tenantId), eq(seatingRuns.eventId, eventId)))
      .orderBy(desc(seatingRuns.createdAt))
      .limit(1),
  ]);
  const assignmentRows = latestRun[0]
    ? await db
        .select({ seatId: seatAssignments.seatId })
        .from(seatAssignments)
        .where(
          and(
            eq(seatAssignments.tenantId, session.tenantId),
            eq(seatAssignments.eventId, eventId),
            eq(seatAssignments.seatingRunId, latestRun[0].id),
          ),
        )
    : [];
  const activeParticipants = participantRows.filter(
    (participant) => participant.status !== "cancelled" && participant.status !== "absent",
  );
  const participantTotal = activeParticipants.length;
  const metrics: OperationsMetric[] = [
    {
      key: "line",
      label: "LINE本人連携",
      completed: activeParticipants.filter((participant) => participant.userId).length,
      total: participantTotal,
      unit: "名",
      href: `/admin/events/${eventId}/participants`,
    },
    {
      key: "dream",
      label: "Dream入力完了",
      completed: activeParticipants.filter(
        (participant) => participant.dreamState === "confirmed" || participant.dreamState === "skipped",
      ).length,
      total: participantTotal,
      unit: "名",
      href: `/admin/events/${eventId}/participants`,
    },
    {
      key: "questionnaire",
      label: "席案内5問提出",
      completed: questionnaireRows.filter((response) => response.status === "submitted").length,
      total: participantTotal,
      unit: "名",
      href: `/admin/events/${eventId}/questionnaire`,
    },
    {
      key: "checkin",
      label: "当日受付",
      completed: checkinRows.filter((checkin) => checkin.status === "checked_in").length,
      total: participantTotal,
      unit: "名",
      href: `/admin/events/${eventId}/checkin`,
    },
    {
      key: "seating",
      label: "席配置",
      completed: assignmentRows.filter((assignment) => assignment.seatId).length,
      total: checkinRows.filter((checkin) => checkin.status === "checked_in").length,
      unit: "名",
      href: `/admin/events/${eventId}/seating`,
    },
    {
      key: "preference",
      label: "希望提出",
      completed: preferenceRows.filter((submission) => submission.status === "submitted").length,
      total: checkinRows.filter((checkin) => checkin.status === "checked_in").length,
      unit: "名",
      href: `/admin/events/${eventId}/results`,
    },
  ];
  const receivedApplications = applicationRows.filter((application) => application.status !== "draft").length;
  const confirmedApplications = applicationRows.filter((application) => application.status === "confirmed").length;
  const sentNotifications = notificationRows.filter((notification) => notification.status === "sent").length;
  const failedNotifications = notificationRows.filter((notification) => notification.status === "failed").length;
  const approvedMatches = matchRows.filter((candidate) => candidate.status === "approved").length;

  return (
    <main>
      <section className="panel wide operations-analytics">
        <p className="eyebrow">OPERATIONS OVERVIEW</p>
        <h1>運営進捗</h1>
        <p className="current-operation-event">
          <span>対象イベント</span>
          <strong>{event.name}</strong>
        </p>
        <p>個人名や回答内容を表示せず、各工程の人数だけを集計しています。</p>
        <section className="analytics-summary" aria-label="イベント概要">
          <div>
            <span>申込受領</span>
            <strong>
              {receivedApplications}
              <small>件</small>
            </strong>
          </div>
          <div>
            <span>参加確定</span>
            <strong>
              {confirmedApplications}
              <small>名</small>
            </strong>
          </div>
          <div>
            <span>参加者登録</span>
            <strong>
              {participantTotal}
              <small>名</small>
            </strong>
          </div>
          <div>
            <span>成立候補・承認</span>
            <strong>
              {approvedMatches}
              <small>組</small>
            </strong>
          </div>
        </section>
        <div className="analytics-metric-list">
          {metrics.map((metric) => {
            const percent = completionPercent(metric.completed, metric.total);
            return (
              <Link
                className={`analytics-metric-card is-${operationsMetricState(metric)}`}
                href={metric.href}
                key={metric.key}
              >
                <div>
                  <strong>{metric.label}</strong>
                  <span>
                    {metric.completed} / {metric.total}
                    {metric.unit}
                  </span>
                </div>
                <div
                  className="analytics-progress"
                  role="progressbar"
                  aria-label={`${metric.label} ${percent}%`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={percent}
                >
                  <span style={{ width: `${percent}%` }} />
                </div>
                <small>{percent}%　詳細を開く</small>
              </Link>
            );
          })}
        </div>
        <section className="analytics-result-status">
          <h2>結果・通知</h2>
          <dl>
            <div>
              <dt>結果確定</dt>
              <dd>{activeConfirmation[0] ? "確定済み" : "未確定"}</dd>
            </div>
            <div>
              <dt>通知送信済み</dt>
              <dd>{sentNotifications}件</dd>
            </div>
            <div>
              <dt>通知失敗</dt>
              <dd className={failedNotifications ? "has-alert" : ""}>{failedNotifications}件</dd>
            </div>
          </dl>
          <Link className="button-link" href={`/admin/events/${eventId}/results`}>
            結果・通知を確認
          </Link>
        </section>
      </section>
    </main>
  );
}

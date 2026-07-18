import "dotenv/config";

const baseUrl = process.env.STAGING_BASE_URL ?? "https://shime-staging.vercel.app";
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? process.env.SEED_ADMIN_PASSWORD;

async function main() {
  if (!password) throw new Error("ADMIN_PASSWORD_NOT_CONFIGURED");

  const requestOptions = { signal: AbortSignal.timeout(20_000) } as const;
  const login = await fetch(`${baseUrl}/api/admin/session`, {
    ...requestOptions,
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      tenantCode: process.env.BOOTSTRAP_TENANT_CODE ?? "shime",
      loginId: process.env.BOOTSTRAP_ADMIN_LOGIN_ID ?? "admin",
      password,
    }),
  });
  if (!login.ok) throw new Error(`LOGIN_FAILED_${login.status}`);

  const cookie = (login.headers.get("set-cookie") ?? "").split(";", 1)[0];
  if (!cookie) throw new Error("SESSION_COOKIE_MISSING");

  const admin = await fetch(`${baseUrl}/admin`, { ...requestOptions, headers: { cookie } });
  const html = await admin.text();
  const eventIds = [...new Set([...html.matchAll(/\/admin\/events\/([^"?\/]+)\/checkin/g)].map((match) => match[1]).filter(Boolean))];
  if (!eventIds.length) throw new Error("CHECKIN_LINK_NOT_FOUND");

  const results = [];
  for (const eventId of eventIds) {
    const search = await fetch(`${baseUrl}/api/admin/events/${eventId}/checkins/manual`, {
      ...requestOptions,
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ query: "A" }),
    });
    const body = await search.json() as { data?: { candidates?: unknown[] } };
    results.push({
      status: search.status,
      candidateCount: Array.isArray(body.data?.candidates) ? body.data.candidates.length : null,
    });
  }

  console.info(JSON.stringify({
    loginStatus: login.status,
    adminStatus: admin.status,
    checkedEventCount: results.length,
    successfulSearchCount: results.filter((result) => result.status === 200).length,
    eventsWithCandidates: results.filter((result) => (result.candidateCount ?? 0) > 0).length,
    totalCandidateCount: results.reduce((total, result) => total + (result.candidateCount ?? 0), 0),
  }));

  if (results.some((result) => result.status !== 200 || result.candidateCount === null)) process.exitCode = 1;
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "STAGING_CHECK_FAILED");
  process.exitCode = 1;
});

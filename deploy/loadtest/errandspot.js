// k6 load test for errandspot.com: USERS people using the site at the same time, half of them
// browsing signed out and half signed in with the app open (which polls every 15 seconds).
// Run it with .github/workflows/load-test.yml, which spreads it over several GitHub runners. From
// one home connection the host's firewall would likely block the address. The API's limits have to
// be raised on the server for the test (see README.md): each runner's visitors share one address,
// and its signed-in half shares one account.
import http from "k6/http";
import { check, sleep } from "k6";

const BASE = __ENV.BASE_URL || "https://errandspot.com";
const USERS = Number(__ENV.USERS || 100); // across all runners
const RUNNERS = Number(__ENV.RUNNERS || 1);
const HOLD = __ENV.HOLD || "3m";
const half = Math.max(1, Math.round(USERS / RUNNERS / 2));
// Status codes counted in the summary, to tell the app's errors from the host's limits.
const STATUSES = ["0", "403", "429", "500", "502", "503", "504", "508"];

const ramp = (target) => [
  { duration: "1m", target },
  { duration: HOLD, target },
  { duration: "20s", target: 0 },
];

export const options = {
  scenarios: {
    visitors: { executor: "ramping-vus", exec: "visitor", startVUs: 0, stages: ramp(half), gracefulRampDown: "10s" },
    members: { executor: "ramping-vus", exec: "member", startVUs: 0, stages: ramp(half), gracefulRampDown: "10s" },
  },
  thresholds: {
    // Stop early rather than keep hammering a site that is already failing.
    http_req_failed: [{ threshold: "rate<0.25", abortOnFail: true, delayAbortEval: "30s" }],
    // Listed so the summary shows each kind of request separately.
    "http_req_duration{page:home}": ["p(95)<60000"],
    "http_req_duration{page:asset}": ["p(95)<60000"],
    "http_req_duration{page:feed}": ["p(95)<60000"],
    "http_req_duration{page:listing}": ["p(95)<60000"],
    "http_req_duration{page:profile}": ["p(95)<60000"],
    "http_req_duration{page:poll}": ["p(95)<60000"],
    ...Object.fromEntries(STATUSES.map((s) => [`http_reqs{status:${s}}`, ["count>=0"]])),
  },
  summaryTrendStats: ["avg", "med", "p(90)", "p(95)", "max"],
};

let reported = 0;
const get = (path, page, params = {}) => {
  const res = http.get(`${BASE}${path}`, { ...params, tags: { page } });
  if ((res.status === 0 || res.status >= 400) && reported++ < 3) {
    // status 0 is a network error: error_code tells which (1211 dial timeout, 1220 refused...).
    console.warn(`${page}: ${res.status} ${res.error_code || ""} ${String(res.body || res.error).slice(0, 160)}`);
  }
  return res;
};
const json = (res) => {
  try {
    return res.json();
  } catch {
    return null;
  }
};

// One throwaway account per runner for the signed-in half. Its email ends in .invalid, a domain
// that can't exist, so the cleanup afterwards can find it.
export function setup() {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const res = http.post(
    `${BASE}/api/auth/register`,
    JSON.stringify({
      email: `loadtest-${stamp}@errandspot.invalid`,
      password: `Lt-${stamp}-x`,
      name: "Load test",
      phone: `+2547${stamp.slice(-8)}`,
      acceptedTerms: true,
      termsVersion: "v2",
    }),
    { headers: { "Content-Type": "application/json" } },
  );
  const token = json(res)?.accessToken;
  if (!token) throw new Error(`Couldn't create the test account: ${res.status} ${res.body}`);
  // The asset files the home page loads, fetched once per visitor as a first visit would.
  const html = get("/", "home").body || "";
  const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.(?:js|css))"/g)].map((m) => m[1]);
  return { token, assets };
}

export function visitor(data) {
  if (__ITER === 0) {
    for (const asset of data.assets) get(asset, "asset");
  }
  const home = get("/", "home");
  check(home, { "home page": (r) => r.status === 200 });
  const feed = get("/api/listings?status=open&sort=newest", "feed");
  check(feed, { feed: (r) => r.status === 200 });
  const items = json(feed)?.items || [];
  sleep(2 + Math.random() * 3);
  if (items.length) {
    const listing = items[Math.floor(Math.random() * items.length)];
    check(get(`/api/listings/${listing.id}`, "listing"), { listing: (r) => r.status === 200 });
    sleep(2 + Math.random() * 3);
    const owner = listing.ownerId || listing.owner?.id;
    if (owner) {
      get(`/api/users/${owner}`, "profile");
      get(`/api/users/${owner}/ratings`, "profile");
    }
  }
  sleep(5 + Math.random() * 5);
}

export function member(data) {
  const auth = { headers: { Authorization: `Bearer ${data.token}` } };
  // What the app asks for every 15 seconds while it's open.
  for (const path of ["/api/notifications/unread-count", "/api/notifications", "/api/tokens/balance"]) {
    check(get(path, "poll", auth), { poll: (r) => r.status === 200 });
  }
  // Now and then the person opens the feed too.
  if (Math.random() < 0.25) get("/api/listings?status=open&sort=newest", "feed", auth);
  sleep(15);
}

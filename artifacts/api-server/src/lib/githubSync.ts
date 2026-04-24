import { db } from "@workspace/db";
import { newsletterSubscribers } from "@workspace/db/schema";
import { asc } from "drizzle-orm";

const GITHUB_TOKEN = process.env.GITHUB_SYNC_TOKEN;
const GITHUB_OWNER = "ochiloeugeneo02-stack";
const GITHUB_REPO = "aventum-capital";
const FILE_PATH = "marketing/newsletter-subscribers.csv";
const BRANCH = "main";
const API_BASE = "https://api.github.com";

function ghHeaders() {
  return {
    Authorization: `token ${GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function getFileSha(): Promise<string | null> {
  const res = await fetch(
    `${API_BASE}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${FILE_PATH}?ref=${BRANCH}`,
    { headers: ghHeaders() }
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub getFile failed: ${res.status}`);
  const data = await res.json() as { sha: string };
  return data.sha;
}

async function buildCsv(): Promise<string> {
  const rows = await db
    .select()
    .from(newsletterSubscribers)
    .orderBy(asc(newsletterSubscribers.createdAt));

  const header = "email,source,confirmed,subscribed_at";
  const lines = rows.map(r =>
    `${r.email},${r.source},${r.confirmed},${r.createdAt ? new Date(r.createdAt).toISOString() : ""}`
  );
  return [header, ...lines].join("\n") + "\n";
}

export async function syncSubscribersToGitHub(): Promise<void> {
  if (!GITHUB_TOKEN) {
    console.warn("[githubSync] GITHUB_SYNC_TOKEN not set — skipping subscriber sync");
    return;
  }

  try {
    const [sha, csv] = await Promise.all([getFileSha(), buildCsv()]);

    const now = new Date().toISOString();
    const body: Record<string, unknown> = {
      message: `chore: update newsletter subscribers [${now}]`,
      content: Buffer.from(csv).toString("base64"),
      branch: BRANCH,
    };
    if (sha) body.sha = sha;

    const res = await fetch(
      `${API_BASE}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${FILE_PATH}`,
      {
        method: "PUT",
        headers: { ...ghHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GitHub PUT failed ${res.status}: ${text}`);
    }

    console.log("[githubSync] subscriber list pushed to GitHub ✓");
  } catch (err) {
    console.error("[githubSync] failed to sync subscribers:", err);
  }
}

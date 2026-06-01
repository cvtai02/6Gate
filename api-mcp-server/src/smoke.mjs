#!/usr/bin/env node

const baseUrl = process.env.SIXGATE_API_URL ?? "http://localhost:20130/api";
const command = process.argv[2] ?? "health";

async function request(path, init = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...(init.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
  });
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`${init.method ?? "GET"} ${path} failed (${res.status}): ${JSON.stringify(body)}`);
  }
  return body;
}

function json(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

async function health() {
  const checks = { health: await request("/health") };
  for (const path of ["/settings", "/providers", "/accounts", "/groups", "/post-jobs"]) {
    const result = await request(path);
    checks[path] = Array.isArray(result) ? { count: result.length } : { ok: true };
  }
  json(checks);
}

async function seed() {
  const suffix = Date.now().toString(36);
  let provider;
  try {
    provider = await request("/providers", {
      method: "POST",
      body: JSON.stringify({
        name: `Smoke Mock ${suffix}`,
        type: "mock",
      }),
    });
  } catch {
    provider = (await request("/providers")).find((item) => item.type === "mock");
  }

  const account = await request("/accounts/zernio/add", {
    method: "POST",
    body: JSON.stringify({
      apiKey: `smoke_${suffix}`,
      label: `Smoke Account ${suffix}`,
      baseUrl,
    }),
  }).catch(() => null);

  const destinations = await request("/publish-destinations");
  const group = await request("/groups", {
    method: "POST",
    body: JSON.stringify({ name: `Smoke Group ${suffix}` }),
  });

  if (destinations[0]) {
    await request(`/groups/${group.id}/destinations`, {
      method: "POST",
      body: JSON.stringify({ destinationId: destinations[0].id }),
    }).catch(() => null);
  }

  json({ provider, account, group, destinations: destinations.length });
}

async function uploadByPath() {
  const [groupId, videoPath, scheduledAt] = process.argv.slice(3);
  if (!groupId || !videoPath) {
    throw new Error("Usage: node src/smoke.mjs upload-by-path <groupId> <absoluteVideoPath> [scheduledAt]");
  }
  json(
    await request(`/groups/${groupId}/upload-by-path`, {
      method: "POST",
      body: JSON.stringify({
        videoPath,
        scheduledAt,
        title: "Smoke scheduled upload",
        caption: "Created by api-mcp-server smoke tooling",
        privacy: "private",
      }),
    }),
  );
}

async function scheduled() {
  const jobs = await request("/post-jobs");
  json(jobs.filter((job) => job.scheduledAt));
}

const commands = {
  health,
  seed,
  "upload-by-path": uploadByPath,
  scheduled,
};

if (!commands[command]) {
  throw new Error(`Unknown smoke command "${command}". Use: ${Object.keys(commands).join(", ")}`);
}

commands[command]().catch((err) => {
  console.error(err.message);
  process.exit(1);
});

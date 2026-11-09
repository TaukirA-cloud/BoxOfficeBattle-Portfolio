// Run only against a service you own. This smoke test is not a capacity guarantee.
const base = process.env.LOADTEST_URL || 'http://127.0.0.1:3000';
const concurrency = Math.min(50, Math.max(1, Number(process.env.CONCURRENCY || 10)));
const rounds = Math.min(100, Math.max(1, Number(process.env.ROUNDS || 10)));
const times = [];
let failures = 0;
await Promise.all(
  Array.from({ length: concurrency }, async () => {
    for (let i = 0; i < rounds; i++) {
      const start = performance.now();
      try {
        const response = await fetch(`${base}/healthz`, {
          signal: AbortSignal.timeout(10000),
        });
        await response.text();
        if (!response.ok) failures++;
      } catch {
        failures++;
      }
      times.push(performance.now() - start);
    }
  }),
);
times.sort((a, b) => a - b);
console.log(
  JSON.stringify(
    {
      requests: times.length,
      failures,
      concurrency,
      p50ms: times[Math.floor(times.length * 0.5)],
      p95ms: times[Math.floor(times.length * 0.95)],
    },
    null,
    2,
  ),
);
if (failures) process.exitCode = 1;

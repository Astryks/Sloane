// Test-only: an in-memory Postgres (PGlite) wired into db.ts through
// __setDbForTests, so the atomic SQL statements are exercised against a real
// Postgres engine. Never imported by app code.
import { PGlite } from "@electric-sql/pglite";
import { __setDbForTests, initSchema } from "../db";

type Rows = Record<string, unknown>[];
type Query = { text: string; params: unknown[] };

function toQuery(strings: TemplateStringsArray, values: unknown[]): Query {
  let text = strings[0];
  for (let i = 0; i < values.length; i++) text += `$${i + 1}${strings[i + 1]}`;
  return { text, params: values };
}

export async function useTestDb(): Promise<PGlite> {
  const pg = new PGlite();
  // Every statement runs on one connection; chain them so overlapping
  // Promise.all callers can't interleave inside a transaction.
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(fn: () => Promise<T>): Promise<T> => {
    const run = queue.then(fn, fn);
    queue = run.catch(() => undefined);
    return run;
  };
  __setDbForTests({
    sql: (strings, ...values) =>
      serial(async () => {
        const q = toQuery(strings, values);
        return (await pg.query(q.text, q.params)).rows as Rows;
      }),
    transaction: (build) =>
      serial(async () => {
        const queries = build(((strings: TemplateStringsArray, ...values: unknown[]) => toQuery(strings, values)) as never) as unknown as Query[];
        return pg.transaction(async (tx) => {
          const out: Rows[] = [];
          for (const q of queries) out.push((await tx.query(q.text, q.params)).rows as Rows);
          return out;
        });
      }),
  });
  await initSchema();
  return pg;
}

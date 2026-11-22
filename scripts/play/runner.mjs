import { snapshot } from "./probe.mjs";
import { messageOf } from "./session.mjs";
import { STEP_SELECTORS } from "./selectors.mjs";

const DEFAULT_OUTCOME = Object.freeze({ status: "ok", reason: null, notices: [], shots: [] });

async function safely(step, session) {
  try {
    return { ...DEFAULT_OUTCOME, ...(await step.run(session)) };
  } catch (error) {
    return { ...DEFAULT_OUTCOME, status: "failed", reason: messageOf(error) };
  }
}

async function safelySnapshot(session, selectors) {
  try {
    return await snapshot(session.page, selectors ?? {});
  } catch {
    return { boxes: {}, missing: [] };
  }
}

async function shotsOf(outcome, step, session) {
  if (outcome.shots.length > 0) return outcome.shots;
  return [await session.shot(step.id)];
}

/** Une étape produit toujours une capture, même quand elle échoue. */
export async function runStep(step, session) {
  const started = Date.now();
  session.recorder.step = step.id;
  const outcome = await safely(step, session);
  const { boxes, missing } = await safelySnapshot(session, STEP_SELECTORS[step.id]);
  return {
    step: step.id,
    title: step.title,
    ok: outcome.status === "ok",
    status: outcome.status,
    reason: outcome.reason,
    durationMs: Date.now() - started,
    url: session.page.url(),
    notices: outcome.notices,
    boxes,
    missing,
    screenshots: await shotsOf(outcome, step, session),
  };
}

export async function runSteps(steps, session) {
  const records = [];
  for (const step of steps) records.push(await runStep(step, session));
  return records;
}

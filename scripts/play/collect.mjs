/**
 * Collecteurs branchés avant tout `goto` : sans eux, un `Uncaught TypeError`
 * dans Pixi ou un SVG en 404 casse la partie sans qu'aucun test ne bronche.
 */

/** Étape courante, portée par l'enregistreur : chaque entrée est attribuée. */
export function createRecorder() {
  return { step: "bootstrap", console: [], pageErrors: [], failedRequests: [] };
}

function consoleEntry(message, step) {
  const location = message.location();
  return { step, level: message.type(), text: message.text(), location: location.url ?? null };
}

function pageErrorEntry(error, step) {
  return { step, message: error.message, stack: error.stack ?? null };
}

export function attachRecorder(page, recorder) {
  page.on("console", (message) => recorder.console.push(consoleEntry(message, recorder.step)));
  page.on("pageerror", (error) => recorder.pageErrors.push(pageErrorEntry(error, recorder.step)));
  page.on("response", (response) => recordResponse(recorder, response));
  page.on("requestfailed", (request) => recordFailure(recorder, request));
}

/** Tout statut ≥ 400 est une requête en échec, assets compris. */
function recordResponse(recorder, response) {
  const status = response.status();
  if (status < 400) return;
  recorder.failedRequests.push({
    step: recorder.step,
    url: response.url(),
    status,
    resourceType: response.request().resourceType(),
    failure: null,
  });
}

function recordFailure(recorder, request) {
  recorder.failedRequests.push({
    step: recorder.step,
    url: request.url(),
    status: null,
    resourceType: request.resourceType(),
    failure: request.failure()?.errorText ?? "échec inconnu",
  });
}

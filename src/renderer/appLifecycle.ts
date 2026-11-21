/**
 * Sous-ensemble d'une `Application` PixiJS suffisant pour savoir si elle vit encore.
 * `Application.destroy()` met `renderer` et `stage` à `null` : toute utilisation
 * ultérieure (`app.render()`, `app.stage.on(...)`) lève un `TypeError`.
 */
export interface AppLifecycle {
  renderer: object | null;
  stage: object | null;
}

/** Garde défensif unique : vrai uniquement pour une application non détruite. */
export function isApplicationAlive<T extends AppLifecycle>(app: T | null): app is T {
  if (app === null) return false;
  return app.renderer !== null && app.stage !== null;
}

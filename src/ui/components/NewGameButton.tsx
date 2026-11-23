import { useState } from "react";
import { startNewGameIfConfirmed } from "../../store/newGame";
import { useEscapeClose } from "../useEscapeClose";
import { BUTTON_DANGER } from "../uiTokens";
import { CHROME_BUTTON } from "./hudTheme";
import { LAYER_DIALOG, OVERLAY_SHEET_NARROW, OVERLAY_TEXT, OVERLAY_TITLE } from "./overlayTheme";

/**
 * Confirmation « Nouvelle partie » — fenêtre de parchemin du lot 5.
 *
 * L'action destructrice prend le bouton **danger** de §2.2 (`#9C2F2F`, encre
 * `ink-1` = 5,42:1) et l'annulation le bouton de plaque habituel : deux poids
 * visuels distincts, deux focus visibles, aucun état par `opacity`. Le voile est
 * `--color-scrim`, comme toutes les fenêtres (plus de `bg-[#2b241d]/80`).
 */
const DIALOG_ACTIONS = "flex justify-end gap-2 pt-1";

/** Message exact de la confirmation : l'effacement de la sauvegarde est annoncé. */
export const NEW_GAME_WARNING =
  "Cela effacera ta progression non sauvegardée et la sauvegarde locale. Continuer ?";

export interface NewGameAccessProps {
  onRequest: () => void;
}

export interface NewGameConfirmProps {
  onConfirm: () => void;
  onCancel: () => void;
}

/** Bouton du bandeau : même facture que « Inventaire », jamais un raccourci secret. */
export function NewGameAccess({ onRequest }: NewGameAccessProps) {
  return (
    <button type="button" onClick={onRequest} className={CHROME_BUTTON}>
      Nouvelle partie
    </button>
  );
}

function DialogActions({ onConfirm, onCancel }: NewGameConfirmProps) {
  return (
    <div className={DIALOG_ACTIONS}>
      <button type="button" onClick={onCancel} className={CHROME_BUTTON}>Annuler</button>
      <button type="button" onClick={onConfirm} className={BUTTON_DANGER}>Continuer</button>
    </div>
  );
}

function DialogSheet({ onConfirm, onCancel }: NewGameConfirmProps) {
  return (
    <section className={OVERLAY_SHEET_NARROW}>
      <h2 className={OVERLAY_TITLE}>Nouvelle partie</h2>
      <p className={OVERLAY_TEXT}>{NEW_GAME_WARNING}</p>
      <DialogActions onConfirm={onConfirm} onCancel={onCancel} />
    </section>
  );
}

/** Confirmation bloquante : action destructrice, l'annulation laisse tout intact. */
export function NewGameConfirmDialog({ onConfirm, onCancel }: NewGameConfirmProps) {
  return (
    <div className={LAYER_DIALOG} role="alertdialog" aria-modal="true" aria-label="Nouvelle partie">
      <DialogSheet onConfirm={onConfirm} onCancel={onCancel} />
    </div>
  );
}

interface AskState {
  asking: boolean;
  request: () => void;
  confirm: () => void;
  cancel: () => void;
}

/** Le « Continuer » ferme la confirmation puis remet les deux stores à neuf. */
function confirmNewGame(cancel: () => void): void {
  cancel();
  startNewGameIfConfirmed(true);
}

function useAskState(): AskState {
  const [asking, setAsking] = useState(false);
  const cancel = () => setAsking(false);
  return { asking, request: () => setAsking(true), cancel, confirm: () => confirmNewGame(cancel) };
}

interface AskLayerProps {
  ask: AskState;
}

function AskLayer({ ask }: AskLayerProps) {
  if (!ask.asking) return null;
  return <NewGameConfirmDialog onConfirm={ask.confirm} onCancel={ask.cancel} />;
}

/** Accès + confirmation : la remise à zéro n'a lieu qu'après un « Continuer ». */
export default function NewGameButton() {
  const ask = useAskState();
  useEscapeClose(ask.cancel, ask.asking);
  return (
    <>
      <NewGameAccess onRequest={ask.request} />
      <AskLayer ask={ask} />
    </>
  );
}

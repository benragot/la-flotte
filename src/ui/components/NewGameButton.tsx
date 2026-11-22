import { useState } from "react";
import { startNewGameIfConfirmed } from "../../store/newGame";
import { useEscapeClose } from "../useEscapeClose";
import { SECTION_HEADING } from "./hudTheme";

const ACCESS_BUTTON =
  "rounded border border-[#8c6d46] bg-[#2b241d]/90 px-2 py-1 text-xs text-[#e8dcc8] transition hover:bg-[#d4a537] hover:text-[#2b241d]";
const DANGER_BUTTON =
  "rounded border border-[#b83b3b] bg-[#b83b3b] px-3 py-1 text-xs font-bold text-[#e8dcc8] transition hover:bg-[#d4a537] hover:text-[#2b241d]";
/** Voile plein écran : il couvre l'arène même depuis la barre d'accès de 1 px. */
const LAYER =
  "pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-[#2b241d]/80 p-4";
const SHEET =
  "flex w-full max-w-md flex-col gap-3 rounded border-2 border-[#8c6d46] bg-[#2b241d] p-4 text-[#e8dcc8]";

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
    <button type="button" onClick={onRequest} className={ACCESS_BUTTON}>
      Nouvelle partie
    </button>
  );
}

function DialogActions({ onConfirm, onCancel }: NewGameConfirmProps) {
  return (
    <div className="flex justify-end gap-2">
      <button type="button" onClick={onCancel} className={ACCESS_BUTTON}>Annuler</button>
      <button type="button" onClick={onConfirm} className={DANGER_BUTTON}>Continuer</button>
    </div>
  );
}

function DialogSheet({ onConfirm, onCancel }: NewGameConfirmProps) {
  return (
    <section className={SHEET}>
      <h2 className={SECTION_HEADING}>Nouvelle partie</h2>
      <p className="text-sm">{NEW_GAME_WARNING}</p>
      <DialogActions onConfirm={onConfirm} onCancel={onCancel} />
    </section>
  );
}

/** Confirmation bloquante : action destructrice, l'annulation laisse tout intact. */
export function NewGameConfirmDialog({ onConfirm, onCancel }: NewGameConfirmProps) {
  return (
    <div className={LAYER} role="alertdialog" aria-modal="true" aria-label="Nouvelle partie">
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

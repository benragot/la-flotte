import { useEffect, useState } from "react";
import type { RefObject } from "react";
import type { GridSize } from "./gridProjection";
import { INITIAL_VIEWPORT, measureElement } from "./containerSize";

function applyMeasure(element: HTMLElement, onSize: (size: GridSize) => void): void {
  const measured = measureElement(element);
  if (measured !== null) onSize(measured);
}

function observe(element: HTMLElement, onSize: (size: GridSize) => void): () => void {
  const observer = new ResizeObserver(() => applyMeasure(element, onSize));
  observer.observe(element);
  applyMeasure(element, onSize);
  return () => observer.disconnect();
}

function observeHost(host: RefObject<HTMLDivElement>, onSize: (size: GridSize) => void): () => void {
  const element = host.current;
  if (element === null || typeof ResizeObserver === "undefined") return () => undefined;
  return observe(element, onSize);
}

/** Taille réelle du conteneur (jamais `window`), pour centrer la carte sans passer sous le HUD. */
export function useContainerSize(host: RefObject<HTMLDivElement>): GridSize {
  const [size, setSize] = useState<GridSize>(INITIAL_VIEWPORT);
  useEffect(() => observeHost(host, setSize), [host]);
  return size;
}

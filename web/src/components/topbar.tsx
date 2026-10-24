import { createContext, useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * The panel's top bar is owned by Layout, but its title and actions belong to
 * each page. Pages render <TopBarTitle>/<TopBarActions> anywhere in their tree
 * and the content is portaled into the bar, so no page state lives in Layout.
 */
export interface TopBarSlots {
  title: HTMLElement | null;
  actions: HTMLElement | null;
}

export const TopBarContext = createContext<TopBarSlots>({ title: null, actions: null });

export function TopBarTitle({ children }: { children: ReactNode }) {
  const { title } = useContext(TopBarContext);
  return title ? createPortal(children, title) : null;
}

export function TopBarActions({ children }: { children: ReactNode }) {
  const { actions } = useContext(TopBarContext);
  return actions ? createPortal(children, actions) : null;
}

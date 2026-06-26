"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Portal target for popovers inside the flow canvas (fullscreen + inline
 * node editor). Select/dialog portals must mount here instead of body.
 */
const FlowPortalContext = createContext<HTMLElement | null>(null);

export function FlowPortalProvider({
  root,
  children,
}: {
  root: HTMLElement | null;
  children: ReactNode;
}) {
  return (
    <FlowPortalContext.Provider value={root}>
      {children}
    </FlowPortalContext.Provider>
  );
}

export function useFlowPortalRoot(): HTMLElement | null {
  return useContext(FlowPortalContext);
}

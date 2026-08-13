"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { useStore } from "zustand";

import {
  createOptimizationStore,
  defaultOptimizationState,
  type OptimizationState,
  type OptimizationStore,
  type OptimizationStoreApi,
} from "@/stores/optimization-store";

const OptimizationStoreContext =
  createContext<OptimizationStoreApi | null>(null);

export function OptimizationProvider({
  children,
  initialState = defaultOptimizationState,
}: {
  children: ReactNode;
  initialState?: OptimizationState;
}) {
  const [store] = useState(() => createOptimizationStore(initialState));

  return (
    <OptimizationStoreContext.Provider value={store}>
      {children}
    </OptimizationStoreContext.Provider>
  );
}

export function useOptimizationStore<T>(
  selector: (store: OptimizationStore) => T,
): T {
  const store = useContext(OptimizationStoreContext);

  if (!store) {
    throw new Error(
      "useOptimizationStore must be used within OptimizationProvider",
    );
  }

  return useStore(store, selector);
}

export function useOptionalOptimizationStoreApi() {
  return useContext(OptimizationStoreContext);
}

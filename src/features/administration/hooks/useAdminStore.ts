"use client";

import { useSyncExternalStore } from "react";
import {
  getAdminServerSnapshot,
  getAdminSnapshot,
  subscribeAdminStore,
} from "../domain/store";
import type { AdminStoreSnapshot } from "../domain/types";

export function useAdminStore(): AdminStoreSnapshot {
  return useSyncExternalStore(
    subscribeAdminStore,
    getAdminSnapshot,
    getAdminServerSnapshot,
  );
}

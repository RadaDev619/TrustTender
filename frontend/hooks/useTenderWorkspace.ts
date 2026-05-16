"use client";

import { useEffect, useState } from "react";
import {
  getResolvedTenderWorkspace,
  subscribeRuntimeProcurementData,
  type ResolvedTenderWorkspace,
} from "@/services/runtimeProcurementData";

export function useTenderWorkspace(tenderId: string) {
  const [workspace, setWorkspace] = useState<
    ResolvedTenderWorkspace | null | undefined
  >(undefined);

  useEffect(() => {
    const refresh = () => setWorkspace(getResolvedTenderWorkspace(tenderId));
    refresh();
    return subscribeRuntimeProcurementData(refresh);
  }, [tenderId]);

  return workspace;
}

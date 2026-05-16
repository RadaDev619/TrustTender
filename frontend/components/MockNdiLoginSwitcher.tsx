"use client";

import { BhutanNdiLoginButton } from "@/components/BhutanNdiLoginButton";
import type { MockNdiStorageMode } from "@/services/mockNdiSession";

interface MockNdiLoginSwitcherProps {
  storageMode?: MockNdiStorageMode;
  onSessionChange?: (identityHash: string | null) => void;
}

export function MockNdiLoginSwitcher(props: MockNdiLoginSwitcherProps) {
  return <BhutanNdiLoginButton {...props} />;
}

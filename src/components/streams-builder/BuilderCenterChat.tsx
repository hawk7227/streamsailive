"use client";

import ActualBuilderSessionChat from "./ActualBuilderSessionChat";
import type { BuilderChatConnection } from "./builderSystemContract";

type Props = {
  activeModule: string;
  connection: BuilderChatConnection;
  onConnectionChange: (next: BuilderChatConnection) => void;
};

export default function BuilderCenterChat({ connection, onConnectionChange }: Props) {
  return <ActualBuilderSessionChat connection={connection} onConnectionChange={onConnectionChange} />;
}

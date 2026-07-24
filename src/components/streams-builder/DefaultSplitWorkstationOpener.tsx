"use client";

import { useEffect } from "react";

export default function DefaultSplitWorkstationOpener() {
  useEffect(() => {
    const initialized = new WeakSet<Element>();

    function openSplitView() {
      for (const workstation of document.querySelectorAll(".liveWorkstation")) {
        if (initialized.has(workstation)) continue;

        const codeButton = Array.from(workstation.querySelectorAll<HTMLButtonElement>("button"))
          .find((button) => button.textContent?.trim() === "Code Editor");

        if (!codeButton) continue;
        initialized.add(workstation);

        if (!workstation.querySelector(".codePreviewSplit")) {
          codeButton.click();
        }
      }
    }

    openSplitView();
    const observer = new MutationObserver(openSplitView);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return null;
}

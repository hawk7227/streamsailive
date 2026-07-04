"use client";

import { useEffect } from "react";

export default function StreamsAIMobileBuilderFeelBridge() {
  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const clickHiddenTopMenu = () => {
      document.querySelector(".mobileTop button[aria-label='Open menu']")?.click();
    };

    const clickHiddenBuild = () => {
      const buildButton = Array.from(document.querySelectorAll(".mobileTop button")).find((button) => String(button.textContent || "").trim() === "Build");
      if (buildButton && !buildButton.disabled) buildButton.click();
    };

    const clickOriginalNav = (button) => {
      if (!button) return;
      button.dataset.streamsSkipMore = "1";
      button.click();
      window.setTimeout(() => { delete button.dataset.streamsSkipMore; }, 0);
    };

    const closeMore = () => {
      document.querySelector(".mobileMoreMenu")?.remove();
    };

    const openMore = (launchButton, profileButton) => {
      closeMore();
      const buildButton = Array.from(document.querySelectorAll(".mobileTop button")).find((button) => String(button.textContent || "").trim() === "Build");
      const menu = document.createElement("div");
      menu.className = "mobileMoreMenu";
      const build = document.createElement("button");
      build.type = "button";
      build.textContent = "Build";
      build.disabled = Boolean(buildButton?.disabled);
      build.addEventListener("click", () => { closeMore(); clickHiddenBuild(); });
      const launch = document.createElement("button");
      launch.type = "button";
      launch.textContent = "Launch";
      launch.addEventListener("click", () => { closeMore(); clickOriginalNav(launchButton); });
      const profile = document.createElement("button");
      profile.type = "button";
      profile.textContent = "Profile";
      profile.addEventListener("click", () => { closeMore(); clickOriginalNav(profileButton); });
      menu.append(build, launch, profile);
      document.body.appendChild(menu);
    };

    const patchBottomNav = () => {
      const nav = document.querySelector(".shell.mobile .mobileNav");
      if (!nav || nav.dataset.streamsBuilderFeelReady === "1") return;
      const buttons = Array.from(nav.querySelectorAll("button"));
      if (buttons.length < 5) return;
      const [homeButton, portfolioButton, createButton, launchButton, profileButton] = buttons;
      const menuButton = document.createElement("button");
      menuButton.type = "button";
      menuButton.textContent = "Menu";
      menuButton.addEventListener("click", clickHiddenTopMenu);
      nav.insertBefore(menuButton, homeButton);
      launchButton.textContent = "More";
      launchButton.dataset.streamsMobileMore = "1";
      profileButton.style.display = "none";
      nav.dataset.streamsBuilderFeelReady = "1";
      nav.addEventListener("click", (event) => {
        const target = event.target instanceof HTMLElement ? event.target.closest("button") : null;
        if (!target || target.dataset.streamsMobileMore !== "1" || target.dataset.streamsSkipMore === "1") return;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        openMore(launchButton, profileButton);
      }, true);
    };

    patchBottomNav();
    const observer = new MutationObserver(patchBottomNav);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      closeMore();
    };
  }, []);

  return null;
}

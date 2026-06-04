"use client";

import { useEffect } from "react";

const LINKS = [
  { id: "usage", label: "Usage", href: "/account/usage" },
  { id: "account", label: "Account", href: "/account/profile" },
];

function makeSvg(kind: string) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "22");
  svg.setAttribute("height", "22");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.8");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");

  const add = (tag: "path" | "circle", attrs: Record<string, string>) => {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
    svg.appendChild(el);
  };

  if (kind === "usage") {
    add("circle", { cx: "12", cy: "12", r: "9" });
    add("path", { d: "M8 14.5h8" });
    add("path", { d: "M8 10h8" });
    add("path", { d: "M12 6v12" });
    return svg;
  }

  add("path", { d: "M20 21a8 8 0 0 0-16 0" });
  add("circle", { cx: "12", cy: "7", r: "4" });
  return svg;
}

function applyLinks() {
  const groups = Array.from(document.querySelectorAll<HTMLElement>(".navGroup"));
  const accountGroup = groups.find((group) => group.querySelector("h3")?.textContent?.trim().toUpperCase() === "ACCOUNT");
  if (!accountGroup) return;

  for (const link of LINKS) {
    if (accountGroup.querySelector(`[data-streams-account-link="${link.id}"]`)) continue;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "navBtn";
    button.dataset.streamsAccountLink = link.id;
    button.title = link.label;
    button.appendChild(makeSvg(link.id));

    const label = document.createElement("span");
    label.textContent = link.label;
    button.appendChild(label);

    button.addEventListener("click", () => {
      window.location.assign(link.href);
    });

    const billing = Array.from(accountGroup.querySelectorAll<HTMLElement>(".navBtn")).find((item) => item.textContent?.includes("Billing"));
    if (billing?.nextSibling) accountGroup.insertBefore(button, billing.nextSibling);
    else accountGroup.appendChild(button);
  }
}

export default function StreamsGlobalAccountNavLinks() {
  useEffect(() => {
    applyLinks();
    const observer = new MutationObserver(applyLinks);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  return null;
}

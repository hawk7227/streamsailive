"use client";

import { useEffect } from "react";
import OpusLockedFrame from "./OpusLockedFrame";
import VoiceConversationLayer from "./VoiceConversationLayer";

const PROTECTED_JOBS_ROUTE = "/api/admingeneration/jobs";
const SAFE_SUBMIT_ROUTE = "/api/admingeneration/routed-submit-v2";

function rewriteAdminGenerationUrl(input) {
  if (typeof input === "string") {
    return input.includes(PROTECTED_JOBS_ROUTE)
      ? input.replace(PROTECTED_JOBS_ROUTE, SAFE_SUBMIT_ROUTE)
      : input;
  }

  if (input instanceof URL) {
    const nextUrl = input.toString();
    return nextUrl.includes(PROTECTED_JOBS_ROUTE)
      ? nextUrl.replace(PROTECTED_JOBS_ROUTE, SAFE_SUBMIT_ROUTE)
      : input;
  }

  if (input instanceof Request && input.url.includes(PROTECTED_JOBS_ROUTE)) {
    return new Request(input.url.replace(PROTECTED_JOBS_ROUTE, SAFE_SUBMIT_ROUTE), input);
  }

  return input;
}

export default function AdminGenerationRuntimeGuard() {
  useEffect(() => {
    const nativeFetch = window.fetch.bind(window);

    window.fetch = (input, init) => {
      return nativeFetch(rewriteAdminGenerationUrl(input), init);
    };

    return () => {
      window.fetch = nativeFetch;
    };
  }, []);

  return (
    <>
      <OpusLockedFrame />
      <VoiceConversationLayer />
    </>
  );
}

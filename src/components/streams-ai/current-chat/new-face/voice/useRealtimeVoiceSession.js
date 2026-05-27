"use client";

import { useCallback, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

const CALLS_URL = "https://api.openai.com/v1/realtime/calls";

function safeEventName(event) {
  return String(event?.type || event?.event || "realtime.event");
}

export function useRealtimeVoiceSession() {
  const { session } = useAuth();
  const peerRef = useRef(null);
  const dataChannelRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);

  const [state, setState] = useState("idle");
  const [statusText, setStatusText] = useState("Voice is idle.");
  const [events, setEvents] = useState([]);
  const [error, setError] = useState("");

  const pushEvent = useCallback((event) => {
    const nextEvent = {
      type: safeEventName(event),
      at: new Date().toISOString(),
      raw: event,
    };

    setEvents((current) => [nextEvent, ...current].slice(0, 30));
  }, []);

  const stop = useCallback(() => {
    try {
      dataChannelRef.current?.close();
    } catch {}

    try {
      peerRef.current?.close();
    } catch {}

    try {
      mediaStreamRef.current?.getTracks()?.forEach((track) => track.stop());
    } catch {}

    try {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.pause();
        remoteAudioRef.current.srcObject = null;
        remoteAudioRef.current.remove();
      }
    } catch {}

    dataChannelRef.current = null;
    peerRef.current = null;
    mediaStreamRef.current = null;
    remoteAudioRef.current = null;

    setState("idle");
    setStatusText("Voice session ended.");
  }, []);

  const start = useCallback(async () => {
    if (state === "connecting" || state === "listening" || state === "speaking") return;

    setError("");
    setState("requesting_mic");
    setStatusText("Requesting microphone permission...");

    if (typeof window === "undefined") {
      setError("Blocked: voice conversation requires a browser.");
      setState("error");
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Blocked: this browser does not support getUserMedia microphone access.");
      setState("error");
      return;
    }

    let micStream;

    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      mediaStreamRef.current = micStream;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Microphone permission was denied.");
      setState("error");
      setStatusText("Microphone permission failed.");
      return;
    }

    setState("creating_session");
    setStatusText("Creating secure Realtime voice session...");

    let tokenData;

    try {
      const tokenResponse = await fetch("/api/streams-ai/realtime/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({}),
      });

      tokenData = await tokenResponse.json();

      if (!tokenResponse.ok || !tokenData?.clientSecret) {
        throw new Error(tokenData?.error || "Realtime session endpoint did not return a client secret.");
      }
    } catch (err) {
      mediaStreamRef.current?.getTracks()?.forEach((track) => track.stop());
      setError(err instanceof Error ? err.message : "Realtime session creation failed.");
      setState("error");
      setStatusText("Realtime session failed.");
      return;
    }

    setState("connecting");
    setStatusText("Connecting voice stream...");

    try {
      const pc = new RTCPeerConnection();
      peerRef.current = pc;

      const remoteAudio = document.createElement("audio");
      remoteAudio.autoplay = true;
      remoteAudio.playsInline = true;
      remoteAudioRef.current = remoteAudio;
      document.body.appendChild(remoteAudio);

      pc.ontrack = (event) => {
        remoteAudio.srcObject = event.streams[0];
        setState("speaking");
        setStatusText("STREAMS is speaking.");
      };

      micStream.getAudioTracks().forEach((track) => pc.addTrack(track, micStream));

      const dataChannel = pc.createDataChannel("oai-events");
      dataChannelRef.current = dataChannel;

      dataChannel.addEventListener("open", () => {
        setState("listening");
        setStatusText("Listening. Speak naturally.");
        pushEvent({ type: "streams.voice.connected" });
      });

      dataChannel.addEventListener("message", (event) => {
        let parsed;
        try {
          parsed = JSON.parse(event.data);
        } catch {
          parsed = { type: "unparsed", data: event.data };
        }

        pushEvent(parsed);

        const type = String(parsed?.type || "");

        if (type.includes("speech_started") || type.includes("input_audio_buffer")) {
          setState("listening");
          setStatusText("Listening...");
        }

        if (type.includes("response.audio") || type.includes("response.created")) {
          setState("speaking");
          setStatusText("STREAMS is responding.");
        }

        if (type.includes("response.done")) {
          setState("listening");
          setStatusText("Listening. Speak naturally.");
        }

        if (type.includes("error")) {
          setState("error");
          setError(parsed?.error?.message || "Realtime session error.");
        }
      });

      dataChannel.addEventListener("close", () => {
        setStatusText("Voice data channel closed.");
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpResponse = await fetch(CALLS_URL, {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${tokenData.clientSecret}`,
          "Content-Type": "application/sdp",
        },
      });

      if (!sdpResponse.ok) {
        const text = await sdpResponse.text();
        throw new Error(text || "OpenAI Realtime WebRTC call failed.");
      }

      const answer = {
        type: "answer",
        sdp: await sdpResponse.text(),
      };

      await pc.setRemoteDescription(answer);
    } catch (err) {
      stop();
      setError(err instanceof Error ? err.message : "Realtime WebRTC connection failed.");
      setState("error");
      setStatusText("Realtime voice connection failed.");
    }
  }, [pushEvent, state, stop]);

  const sendTextEvent = useCallback((text) => {
    const dataChannel = dataChannelRef.current;

    if (!dataChannel || dataChannel.readyState !== "open") {
      setError("Voice event channel is not open.");
      return;
    }

    dataChannel.send(JSON.stringify({
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text }],
      },
    }));

    dataChannel.send(JSON.stringify({ type: "response.create" }));
  }, []);

  return {
    state,
    statusText,
    error,
    events,
    isActive: ["requesting_mic", "creating_session", "connecting", "listening", "speaking"].includes(state),
    start,
    stop,
    sendTextEvent,
  };
}

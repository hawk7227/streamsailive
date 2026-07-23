"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  VISIONS_CAPTURE_TYPES,
  VISIONS_IDENTITY_NOTICE,
  type VisionsCaptureMetadata,
  type VisionsCaptureType,
  type VisionsIdentityStatus,
} from "@/lib/streams-visions/identity";
import styles from "./identity.module.css";

type GatePayload = { status?: VisionsIdentityStatus; error?: string; authenticated?: boolean };
type CapturePreview = VisionsCaptureMetadata & { blob: Blob; localUrl: string };
type PublicKeyCredentialWithKey = PublicKeyCredential & { response: AuthenticatorAttestationResponse & { getPublicKey?: () => ArrayBuffer | null } };

const CAPTURE_COPY: Record<VisionsCaptureType, { title: string; instruction: string }> = {
  front: { title: "Look directly at the camera", instruction: "Keep your full face visible in clear, even light." },
  left_three_quarter: { title: "Turn slightly to your left", instruction: "Keep both eyes visible and hold still for the capture." },
  right_three_quarter: { title: "Turn slightly to your right", instruction: "Keep both eyes visible and hold still for the capture." },
  upper_body: { title: "Step back for an upper-body view", instruction: "Keep your face, shoulders, and upper body in the frame." },
};

function bytesToBase64Url(value: ArrayBuffer) {
  const bytes = new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function hashBlob(blob: Blob) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer())))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function captureDimensions(blob: Blob) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new window.Image();
    const url = URL.createObjectURL(blob);
    image.onload = () => { resolve({ width: image.naturalWidth, height: image.naturalHeight }); URL.revokeObjectURL(url); };
    image.onerror = () => { reject(new Error("The camera image could not be read.")); URL.revokeObjectURL(url); };
    image.src = url;
  });
}

export default function VisionsIdentityGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<VisionsIdentityStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirmations, setConfirmations] = useState([false, false, false]);
  const [fullName, setFullName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [country, setCountry] = useState("");
  const [stateRegion, setStateRegion] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneCode, setPhoneCode] = useState("");
  const [phoneCodeSent, setPhoneCodeSent] = useState(false);
  const [challenge, setChallenge] = useState("");
  const [sequence, setSequence] = useState<VisionsCaptureType[]>([...VISIONS_CAPTURE_TYPES]);
  const [captureIndex, setCaptureIndex] = useState(0);
  const [captures, setCaptures] = useState<CapturePreview[]>([]);
  const [cameraActive, setCameraActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deviceUnlocked, setDeviceUnlocked] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const capturesRef = useRef<CapturePreview[]>([]);
  const supabaseRef = useRef(createClient());

  useEffect(() => { capturesRef.current = captures; }, [captures]);

  const loadStatus = useCallback(async () => {
    const response = await fetch("/api/streams-ai/Visions/identity/status", { cache: "no-store", credentials: "same-origin" });
    const data = await response.json().catch(() => ({})) as GatePayload;
    if (response.status === 401) { setStatus(null); setLoading(false); return; }
    if (!response.ok || !data.status) throw new Error(data.error || "Identity setup could not be loaded.");
    setStatus(data.status);
    setPhone(data.status.phone || "");
    setFullName(data.status.fullName || "");
    setDateOfBirth(data.status.dateOfBirth || "");
    setCountry(data.status.country || "");
    setStateRegion(data.status.stateRegion || "");
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadStatus().catch((caught: unknown) => { setError(caught instanceof Error ? caught.message : "Identity setup could not be loaded."); setLoading(false); });
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      capturesRef.current.forEach((capture) => URL.revokeObjectURL(capture.localUrl));
    };
  }, [loadStatus]);

  async function postStatus(action: string, extra: Record<string, unknown> = {}) {
    setSubmitting(true); setError("");
    try {
      const response = await fetch("/api/streams-ai/Visions/identity/status", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ action, ...extra }) });
      const data = await response.json().catch(() => ({})) as GatePayload & { signedOut?: boolean };
      if (!response.ok) throw new Error(data.error || "The identity action could not be completed.");
      if (data.signedOut) { window.location.assign("/login"); return; }
      await loadStatus();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "The identity action could not be completed.");
    } finally { setSubmitting(false); }
  }

  async function saveAccountDetails() {
    await postStatus("save_account_details", { fullName, dateOfBirth, country, stateRegion });
  }

  async function acceptNotice() {
    if (confirmations.some((value) => !value)) { setError("Accept all three confirmations to continue."); return; }
    await postStatus("accept_notice", { confirmations });
  }

  async function sendPhoneCode() {
    setSubmitting(true); setError("");
    try {
      const normalized = phone.trim();
      if (!/^\+[1-9]\d{7,14}$/.test(normalized)) throw new Error("Enter the phone number with country code, such as +16025550123.");
      const { error: updateError } = await supabaseRef.current.auth.updateUser({ phone: normalized });
      if (updateError) throw updateError;
      setPhoneCodeSent(true);
    } catch (caught: unknown) { setError(caught instanceof Error ? caught.message : "The phone verification code could not be sent."); }
    finally { setSubmitting(false); }
  }

  async function verifyPhoneCode() {
    setSubmitting(true); setError("");
    try {
      const { error: verifyError } = await supabaseRef.current.auth.verifyOtp({ phone: phone.trim(), token: phoneCode.trim(), type: "phone_change" });
      if (verifyError) throw verifyError;
      setPhoneCodeSent(false); setPhoneCode("");
      await loadStatus();
    } catch (caught: unknown) { setError(caught instanceof Error ? caught.message : "The phone verification code was not accepted."); }
    finally { setSubmitting(false); }
  }

  async function openCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 1280 } }, audio: false });
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = stream;
    setCameraActive(true);
    window.requestAnimationFrame(() => {
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        void videoRef.current.play();
      }
    });
  }

  async function startCamera() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) { setError("This browser does not provide secure camera access."); return; }
    try {
      const response = await fetch("/api/streams-ai/Visions/identity/challenge", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ purpose: "capture" }) });
      const data = await response.json() as { challenge?: string; sequence?: VisionsCaptureType[]; error?: string };
      if (!response.ok || !data.challenge || !Array.isArray(data.sequence)) throw new Error(data.error || "A secure camera session could not be started.");
      captures.forEach((capture) => URL.revokeObjectURL(capture.localUrl));
      setCaptures([]);
      setChallenge(data.challenge);
      setSequence(data.sequence);
      setCaptureIndex(0);
      await openCamera();
    } catch (caught: unknown) { setError(caught instanceof Error ? caught.message : "Camera access was not granted."); }
  }

  async function takeCapture() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const captureType = sequence[captureIndex];
    if (!video || !canvas || !captureType || video.videoWidth < 320 || video.videoHeight < 320) { setError("Hold still until the camera image is clear."); return; }
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) { setError("The camera image could not be captured."); return; }
    context.setTransform(-1, 0, 0, 1, canvas.width, 0);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob) { setError("The camera image could not be captured."); return; }
    const dimensions = await captureDimensions(blob);
    const preview: CapturePreview = { captureType, blob, localUrl: URL.createObjectURL(blob), storagePath: "", sha256: await hashBlob(blob), contentType: "image/jpeg", sizeBytes: blob.size, ...dimensions };
    setCaptures((current) => {
      const replaced = current.find((item) => item.captureType === captureType);
      if (replaced) URL.revokeObjectURL(replaced.localUrl);
      return [...current.filter((item) => item.captureType !== captureType), preview];
    });
    if (captureIndex < sequence.length - 1) setCaptureIndex((current) => current + 1);
    else { streamRef.current?.getTracks().forEach((track) => track.stop()); setCameraActive(false); }
  }

  async function retakeCapture(captureType: VisionsCaptureType) {
    const index = sequence.indexOf(captureType);
    const current = captures.find((item) => item.captureType === captureType);
    if (current) URL.revokeObjectURL(current.localUrl);
    setCaptures((items) => items.filter((item) => item.captureType !== captureType));
    setCaptureIndex(index >= 0 ? index : 0);
    setError("");
    try { await openCamera(); } catch (caught: unknown) { setError(caught instanceof Error ? caught.message : "Camera access was not granted."); }
  }

  async function submitCaptures() {
    if (captures.length !== VISIONS_CAPTURE_TYPES.length) { setError("Capture all four required views before submitting."); return; }
    setSubmitting(true); setError("");
    try {
      const uploaded: VisionsCaptureMetadata[] = [];
      for (const capture of captures) {
        const prepareResponse = await fetch("/api/streams-ai/Visions/identity/captures", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ action: "prepare", challenge, captureType: capture.captureType, contentType: capture.contentType, sizeBytes: capture.sizeBytes }) });
        const prepared = await prepareResponse.json() as { uploadUrl?: string; storagePath?: string; error?: string };
        if (!prepareResponse.ok || !prepared.uploadUrl || !prepared.storagePath) throw new Error(prepared.error || "A private likeness upload could not be prepared.");
        const uploadResponse = await fetch(prepared.uploadUrl, { method: "PUT", headers: { "Content-Type": capture.contentType }, body: capture.blob });
        if (!uploadResponse.ok) throw new Error("A private likeness image could not be uploaded.");
        uploaded.push({ captureType: capture.captureType, storagePath: prepared.storagePath, sha256: capture.sha256, contentType: capture.contentType, sizeBytes: capture.sizeBytes, width: capture.width, height: capture.height });
      }
      const finalizeResponse = await fetch("/api/streams-ai/Visions/identity/captures", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ action: "finalize", challenge, captures: uploaded }) });
      const finalized = await finalizeResponse.json() as { error?: string };
      if (!finalizeResponse.ok) throw new Error(finalized.error || "The private likeness profile could not be submitted.");
      captures.forEach((capture) => URL.revokeObjectURL(capture.localUrl));
      setCaptures([]); setChallenge("");
      await loadStatus();
    } catch (caught: unknown) { setError(caught instanceof Error ? caught.message : "The private likeness profile could not be submitted."); }
    finally { setSubmitting(false); }
  }

  async function registerDeviceLock() {
    setSubmitting(true); setError("");
    try {
      if (!window.PublicKeyCredential || !navigator.credentials) throw new Error("This device does not support a platform biometric or passkey lock.");
      const challengeResponse = await fetch("/api/streams-ai/Visions/identity/challenge", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ purpose: "webauthn_register" }) });
      const challengeData = await challengeResponse.json() as { challenge?: string; error?: string };
      if (!challengeResponse.ok || !challengeData.challenge) throw new Error(challengeData.error || "A secure device challenge could not be created.");
      const credential = await navigator.credentials.create({ publicKey: {
        challenge: base64UrlToBytes(challengeData.challenge) as BufferSource,
        rp: { name: "Streams Visions", id: window.location.hostname },
        user: { id: crypto.getRandomValues(new Uint8Array(32)) as BufferSource, name: "Streams user", displayName: "Streams Visions user" },
        pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: "platform", residentKey: "preferred", userVerification: "required" },
        timeout: 60000,
        attestation: "none",
      } }) as PublicKeyCredentialWithKey | null;
      if (!credential) throw new Error("The device lock was cancelled.");
      const publicKey = credential.response.getPublicKey?.();
      if (!publicKey) throw new Error("This browser did not provide a verifiable device public key.");
      const response = await fetch("/api/streams-ai/Visions/identity/biometric", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ action: "register", credentialId: credential.id, publicKeySpki: bytesToBase64Url(publicKey), clientDataJSON: bytesToBase64Url(credential.response.clientDataJSON) }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "The device lock could not be enabled.");
      await loadStatus();
    } catch (caught: unknown) { setError(caught instanceof Error ? caught.message : "The device lock could not be enabled."); }
    finally { setSubmitting(false); }
  }

  async function unlockVisions() {
    setSubmitting(true); setError("");
    try {
      const challengeResponse = await fetch("/api/streams-ai/Visions/identity/challenge", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ purpose: "webauthn_authenticate" }) });
      const challengeData = await challengeResponse.json() as { challenge?: string; error?: string };
      if (!challengeResponse.ok || !challengeData.challenge) throw new Error(challengeData.error || "A secure device challenge could not be created.");
      const credential = await navigator.credentials.get({ publicKey: { challenge: base64UrlToBytes(challengeData.challenge) as BufferSource, timeout: 60000, userVerification: "required", rpId: window.location.hostname } }) as PublicKeyCredential | null;
      if (!credential) throw new Error("Private Visions access was cancelled.");
      const responseData = credential.response as AuthenticatorAssertionResponse;
      const response = await fetch("/api/streams-ai/Visions/identity/biometric", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ action: "authenticate", credentialId: credential.id, clientDataJSON: bytesToBase64Url(responseData.clientDataJSON), authenticatorData: bytesToBase64Url(responseData.authenticatorData), signature: bytesToBase64Url(responseData.signature) }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "The device could not unlock private visions.");
      setDeviceUnlocked(true);
    } catch (caught: unknown) { setError(caught instanceof Error ? caught.message : "The device could not unlock private visions."); }
    finally { setSubmitting(false); }
  }

  if (loading) return <main className={styles.screen}><div className={styles.content}><p className={styles.kicker}>STREAMS VISIONS</p><h1>Protecting your private future.</h1></div></main>;
  if (!status) return <main className={styles.screen}><div className={styles.content}><p className={styles.kicker}>STREAMS VISIONS</p><h1>Create your Streams account first.</h1><p className={styles.lead}>Your regular account can be created now. Visions remains locked until identity, likeness, and device protection are complete.</p><div className={styles.actions}><Link className={styles.primary} href="/signup?next=/streams-ai/Visions">Create account</Link><Link className={styles.secondary} href="/login?next=/streams-ai/Visions">Sign in</Link></div></div></main>;
  if (status.canEnterVisions && deviceUnlocked) return <>{children}</>;

  let body: ReactNode;
  if (!status.emailVerified) {
    body = <><p className={styles.kicker}>VERIFY YOUR ACCOUNT</p><h1>Confirm your email before Visions continues.</h1><p className={styles.lead}>Open the confirmation message sent by Streams, then return here and refresh this screen.</p><div className={styles.actions}><button className={styles.primary} type="button" onClick={() => void loadStatus()} disabled={submitting}>I verified my email</button><Link className={styles.secondary} href="/login">Return to sign in</Link></div></>;
  } else if (!status.accountDetailsComplete) {
    body = <><p className={styles.kicker}>COMPLETE YOUR ACCOUNT</p><h1>Use your real account details.</h1><p className={styles.lead}>These details support account integrity, recovery, and the identity review attached to your private Visions profile.</p><label className={styles.field}><span>Full name</span><input value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" /></label><label className={styles.field}><span>Date of birth</span><input value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} type="date" autoComplete="bday" /></label><label className={styles.field}><span>Country</span><input value={country} onChange={(event) => setCountry(event.target.value)} autoComplete="country-name" /></label><label className={styles.field}><span>State or region</span><input value={stateRegion} onChange={(event) => setStateRegion(event.target.value)} autoComplete="address-level1" /></label><div className={styles.actions}><button className={styles.primary} type="button" onClick={() => void saveAccountDetails()} disabled={submitting}>Save account details</button></div></>;
  } else if (!status.phoneVerified) {
    body = <><p className={styles.kicker}>SECURE YOUR ACCOUNT</p><h1>Verify the phone you control.</h1><p className={styles.lead}>Streams uses your verified phone for account recovery and fraud protection.</p><label className={styles.field}><span>Phone with country code</span><input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" placeholder="+16025550123" /></label>{phoneCodeSent ? <label className={styles.field}><span>Verification code</span><input value={phoneCode} onChange={(event) => setPhoneCode(event.target.value)} inputMode="numeric" autoComplete="one-time-code" placeholder="000000" /></label> : null}<div className={styles.actions}>{phoneCodeSent ? <button className={styles.primary} type="button" onClick={() => void verifyPhoneCode()} disabled={submitting || phoneCode.trim().length < 6}>Verify phone</button> : <button className={styles.primary} type="button" onClick={() => void sendPhoneCode()} disabled={submitting}>Send code</button>}</div></>;
  } else if (!status.noticeAccepted) {
    body = <><p className={styles.kicker}>IDENTITY AND PRIVACY NOTICE</p><h1>{VISIONS_IDENTITY_NOTICE.title}</h1>{VISIONS_IDENTITY_NOTICE.paragraphs.map((paragraph) => <p className={styles.noticeText} key={paragraph}>{paragraph}</p>)}<ul className={styles.useList}>{VISIONS_IDENTITY_NOTICE.uses.map((use) => <li key={use}>{use}</li>)}</ul><div className={styles.confirmations}>{VISIONS_IDENTITY_NOTICE.confirmations.map((label, index) => <label key={label}><input type="checkbox" checked={confirmations[index]} onChange={(event) => setConfirmations((current) => current.map((value, itemIndex) => itemIndex === index ? event.target.checked : value))} /><span>{label}</span></label>)}</div><div className={styles.actions}><button className={styles.primary} type="button" onClick={() => void acceptNotice()} disabled={submitting}>Accept and continue</button><Link className={styles.secondary} href="/streams-ai">Leave setup</Link></div></>;
  } else if (status.likenessProfileStatus === "locked" || status.likenessProfileStatus === "capturing" || status.likenessProfileStatus === "retake_required" || status.likenessProfileStatus === "deleted") {
    const currentType = sequence[captureIndex];
    body = <>{cameraActive && currentType ? <><p className={styles.kicker}>LIVE-PERSON CAPTURE · {captureIndex + 1} OF 4</p><h1>{CAPTURE_COPY[currentType].title}</h1><p className={styles.lead}>{CAPTURE_COPY[currentType].instruction}</p><div className={styles.cameraStage}><video ref={videoRef} muted playsInline /><div className={styles.faceGuide} aria-hidden="true" /></div><button className={styles.primary} type="button" onClick={() => void takeCapture()}>Capture this view</button></> : captures.length === 4 ? <><p className={styles.kicker}>REVIEW YOUR LIKENESS</p><h1>Confirm each image is clear and authentic.</h1><p className={styles.lead}>These private references help Visions portray you consistently. Retake any image that does not represent you accurately.</p><div className={styles.captureGrid}>{captures.map((capture) => <figure key={capture.captureType}><Image src={capture.localUrl} alt={CAPTURE_COPY[capture.captureType].title} width={capture.width} height={capture.height} unoptimized /><figcaption><span>{CAPTURE_COPY[capture.captureType].title}</span><button type="button" onClick={() => void retakeCapture(capture.captureType)}>Retake</button></figcaption></figure>)}</div><div className={styles.actions}><button className={styles.primary} type="button" onClick={() => void submitCaptures()} disabled={submitting}>Submit private likeness</button><button className={styles.secondaryButton} type="button" onClick={() => void startCamera()} disabled={submitting}>Start over</button></div></> : <><p className={styles.kicker}>REAL-PERSON VERIFICATION</p><h1>Visions needs to recognize you before it can place you inside your future.</h1><p className={styles.lead}>You will capture four current views using the live camera. Uploads, gallery images, filters, and blank profile images are not accepted.</p><ul className={styles.rules}><li>One person only</li><li>No sunglasses or face-covering filters</li><li>Clear, even lighting</li><li>Recent and unaltered appearance</li></ul><div className={styles.actions}><button className={styles.primary} type="button" onClick={() => void startCamera()} disabled={submitting}>Begin secure face setup</button><Link className={styles.secondary} href="/streams-ai">Leave setup</Link></div></>}<canvas ref={canvasRef} className={styles.hiddenCanvas} /></>;
  } else if (status.likenessProfileStatus === "pending_review" || status.livenessStatus === "manual_review") {
    body = <><p className={styles.kicker}>PRIVATE REVIEW</p><h1>Your identity and likeness are being reviewed.</h1><p className={styles.lead}>{status.reviewReason || "Streams is checking the live-person capture and profile integrity before private Visions access is unlocked."}</p><div className={styles.actions}><button className={styles.primary} type="button" onClick={() => void loadStatus()} disabled={submitting}>Check review status</button><button className={styles.secondaryButton} type="button" onClick={() => void postStatus("replace_likeness")} disabled={submitting}>Replace images</button></div></>;
  } else if (status.likenessProfileStatus === "rejected" || status.livenessStatus === "rejected") {
    body = <><p className={styles.kicker}>REVIEW REQUIRED</p><h1>Visions remains locked.</h1><p className={styles.lead}>{status.reviewReason || "The submitted identity set could not be approved."}</p><div className={styles.actions}><button className={styles.primary} type="button" onClick={() => void postStatus("replace_likeness")} disabled={submitting}>Retake images</button><button className={styles.secondaryButton} type="button" onClick={() => void postStatus("appeal")} disabled={submitting}>Request manual review</button></div></>;
  } else if (!status.biometricLockEnabled) {
    body = <><p className={styles.kicker}>PROTECT PRIVATE VISIONS</p><h1>Enable your device’s biometric or passkey lock.</h1><p className={styles.lead}>Your device verifies access. Streams stores the public credential needed to validate the unlock, never the device’s facial or fingerprint template.</p><div className={styles.actions}><button className={styles.primary} type="button" onClick={() => void registerDeviceLock()} disabled={submitting}>Enable device lock</button></div></>;
  } else {
    body = <><p className={styles.kicker}>PRIVATE VISIONS LOCKED</p><h1>Only you should enter your dreams.</h1><p className={styles.lead}>Use the biometric, fingerprint, device passcode, or passkey protected by this device.</p><div className={styles.actions}><button className={styles.primary} type="button" onClick={() => void unlockVisions()} disabled={submitting}>Unlock Streams Visions</button><button className={styles.secondaryButton} type="button" onClick={() => void postStatus("report_compromise")} disabled={submitting}>Report account compromise</button></div></>;
  }

  return <main className={styles.screen}><div className={styles.content}>{body}{error ? <p className={styles.error} role="alert">{error}</p> : null}</div></main>;
}

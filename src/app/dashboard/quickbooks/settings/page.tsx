"use client";

/**
 * app/settings/quickbooks/page.tsx  (adjust path to match your routing)
 *
 * Uses your existing API.tsx wrappers instead of raw fetch — same pattern
 * as your other QuickBooks Integration functions (getQboHealth, etc).
 *
 * IMPORTANT: update the import path below to wherever api.tsx actually
 * lives in your project (e.g. "@/lib/api", "@/services/api", "../../api").
 */

import { useEffect, useRef, useState } from "react";
import { getQboStatus, connectQbo, disconnectQbo } from "@/utils/api"; // ← fix this path

type TokenStatus = {
  hasAccessToken?: boolean;
  hasRefreshToken?: boolean;
  isExpired?: boolean;
  realmId?: string | null;
  expiresAt?: string | null;
  environment?: string;
};

export default function QuickBooksSettingsPage() {
  const [status, setStatus] = useState<TokenStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);
  const [waitingForAuth, setWaitingForAuth] = useState(false);

  // async function loadStatus() {
  //   setLoading(true);
  //   setError(null);
  //   try {
  //     const res = await getQboStatus();
  //     const json = res.data; // axios-style response — adjust if your API wrapper differs
  //     if (!json.success) throw new Error(json.message || "Failed to load status");
  //     setStatus(json.data);
  //   } catch (err: any) {
  //     setError(err?.response?.data?.message || err.message || "Could not load QuickBooks connection status");
  //   } finally {
  //     setLoading(false);
  //   }
  // }

  useEffect(() => {
    let isMounted = true;

    async function load() {
      if (isMounted) await loadStatus();
    }
    load();

    return () => {
      isMounted = false;
    };
  }, []);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // silent = true → spinner/error flicker nahi hoga (polling ke liye)
  async function loadStatus(silent = false): Promise<TokenStatus | null> {
    if (!silent) setLoading(true);
    if (!silent) setError(null);
    try {
      const res = await getQboStatus();
      const json = res.data;
      if (!json.success) throw new Error(json.message || "Failed to load status");
      setStatus(json.data);
      return json.data as TokenStatus;
    } catch (err: any) {
      if (!silent) setError(err?.response?.data?.message || err.message || "Could not load QuickBooks connection status");
      return null;
    } finally {
      if (!silent) setLoading(false);
    }
  }

  function stopPolling() {
    if (pollRef.current) clearInterval(pollRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    pollRef.current = null;
    timeoutRef.current = null;
    setWaitingForAuth(false);
  }

  async function handleConnect() {
    setActionLoading(true);
    setError(null);

    // ✅ click ke foran baad tab kholo (await se pehle) taake popup blocker na roke
    // ✅ noopener/noreferrer NAHI lagana, warna window.open null return karta hai
    const authWindow = window.open("", "_blank");
    if (!authWindow) {
      setError("Popup blocked — please allow popups for this site and try again");
      setActionLoading(false);
      return;
    }

    try {
      const res = await connectQbo();
      const json = res.data;
      if (!json.success || !json.authorizationUri) {
        throw new Error(json.message || "Could not start QuickBooks connection");
      }

      authWindow.location.href = json.authorizationUri; // blank tab ab auth page pe jayega

      setActionLoading(false);
      setWaitingForAuth(true);

      // ✅ har 2 sec status check — token milte hi UI khud update
      pollRef.current = setInterval(async () => {
        const s = await loadStatus(true);
        const connectedNow = !!s?.hasAccessToken && !s?.isExpired;

        if (connectedNow) {
          stopPolling();
          try { authWindow.close(); } catch { }
          return;
        }
        // user ne tab khud band kar diya → polling band (upar status already refresh ho chuka)
        if (authWindow.closed) stopPolling();
      }, 2000);

      // safety: 5 min baad polling band
      timeoutRef.current = setTimeout(stopPolling, 5 * 60 * 1000);
    } catch (err: any) {
      authWindow.close();
      setError(err?.response?.data?.message || err.message || "Something went wrong starting the connection");
      setActionLoading(false);
    }
  }

  // unmount pe cleanup
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);
  async function handleDisconnect() {
    setActionLoading(true);
    setError(null);
    try {
      const res = await disconnectQbo();
      const json = res.data;
      if (!json.success) throw new Error(json.message || "Could not disconnect");
      setConfirmingDisconnect(false);
      await loadStatus();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || "Something went wrong disconnecting");
    } finally {
      setActionLoading(false);
    }
  }

  const isConnected = !!status?.hasAccessToken;

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "48px 20px" }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 6 }} className="text-gray-400">
        QuickBooks Online Connection
      </h1>
      <p style={{ color: "#666", fontSize: 14, marginBottom: 28 }}>
        Manage ALCO CRM&apos;s connection to your QuickBooks Online company file.
      </p>

      {loading && <p style={{ fontSize: 14, color: "#666" }}>Checking connection status…</p>}

      {waitingForAuth && (
        <p style={{ fontSize: 14, color: "#666", marginBottom: 12 }}>
          Complete the QuickBooks sign-in in the tab that just opened. This page will
          update automatically once you&apos;re done.
        </p>
      )}

      {error && (
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#b91c1c",
            fontSize: 13,
            padding: "10px 14px",
            borderRadius: 8,
            marginBottom: 20,
          }}
        >
          {error}
        </div>
      )}

      {!loading && status && (
        <>
          <div
            style={{
              border: "1px solid #e5e5e5",
              borderRadius: 12,
              padding: 20,
              marginBottom: 20,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: isConnected && !status.isExpired ? "#22c55e" : "#d1d5db",
                  display: "inline-block",
                }}
              />
              <strong style={{ fontSize: 15 }} className="text-gray-400">
                {isConnected && !status.isExpired
                  ? "Connected"
                  : isConnected && status.isExpired
                    ? "Connected — token expired"
                    : "Not connected"}
              </strong>
            </div>

            {status.realmId && (
              <p style={{ fontSize: 13, color: "#666", margin: "4px 0" }}>
                Company ID: {status.realmId}
              </p>
            )}
            {status.expiresAt && (
              <p style={{ fontSize: 13, color: "#666", margin: "4px 0" }}>
                Token expires: {new Date(status.expiresAt).toLocaleString()}
              </p>
            )}
            {status.environment && (
              <p style={{ fontSize: 13, color: "#666", margin: "4px 0" }}>
                Environment: {status.environment}
              </p>
            )}
          </div>

          {!isConnected || status.isExpired ? (
            <button
              onClick={handleConnect}
              disabled={actionLoading || waitingForAuth}
              style={{
                background: "#2CA01C",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "10px 20px",
                fontSize: 14,
                fontWeight: 600,
                cursor: actionLoading || waitingForAuth ? "not-allowed" : "pointer",
                opacity: actionLoading || waitingForAuth ? 0.6 : 1,
              }}
            >
              {actionLoading
                ? "Redirecting…"
                : waitingForAuth
                  ? "Waiting for authorization…"
                  : "Connect to QuickBooks"}
            </button>
          ) : !confirmingDisconnect ? (
            <button
              onClick={() => setConfirmingDisconnect(true)}
              style={{
                background: "#fff",
                color: "#b91c1c",
                border: "1px solid #fecaca",
                borderRadius: 8,
                padding: "10px 20px",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Disconnect QuickBooks
            </button>
          ) : (
            <div
              style={{
                border: "1px solid #fecaca",
                background: "#fef2f2",
                borderRadius: 8,
                padding: 16,
              }}
            >
              <p style={{ fontSize: 14, marginBottom: 12 }} className="text-gray-700">
                Disconnecting will stop ALCO CRM from reading new data from QuickBooks
                Online. Data already stored in the CRM will not be deleted immediately —
                see the{" "}
                <a href="/privacy-policy" style={{ color: "#2563eb", textDecoration: "underline" }}>
                  Privacy Policy
                </a>{" "}
                for the retention period. Are you sure?
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={handleDisconnect}
                  disabled={actionLoading}
                  style={{
                    background: "#b91c1c",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    padding: "8px 16px",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: actionLoading ? "not-allowed" : "pointer",
                  }}
                >
                  {actionLoading ? "Disconnecting…" : "Yes, disconnect"}
                </button>
                <button
                  onClick={() => setConfirmingDisconnect(false)}
                  disabled={actionLoading}
                  style={{
                    background: "#fff",
                    color: "#374151",
                    border: "1px solid #d1d5db",
                    borderRadius: 8,
                    padding: "8px 16px",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

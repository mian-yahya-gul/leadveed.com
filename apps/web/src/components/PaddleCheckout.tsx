"use client";

import { useEffect, useState } from "react";

type Props = { token: string; sandbox: boolean; priceId: string; email?: string; userId: string; successUrl: string };

declare global {
  interface Window {
    Paddle?: {
      Environment: { set(env: "sandbox" | "production"): void };
      Initialize(opts: { token: string }): void;
      Checkout: { open(opts: Record<string, unknown>): void };
    };
  }
}

const SRC = "https://cdn.paddle.com/paddle/v2/paddle.js";

function loadPaddle(): Promise<NonNullable<Window["Paddle"]>> {
  if (window.Paddle) return Promise.resolve(window.Paddle);
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SRC;
    s.async = true;
    s.onload = () => (window.Paddle ? resolve(window.Paddle) : reject(new Error("Paddle did not load")));
    s.onerror = () => reject(new Error("Paddle did not load"));
    document.head.appendChild(s);
  });
}

let initialized = false;

/** Opens Paddle's overlay checkout as soon as the page loads, with a button to reopen it. */
export function PaddleCheckout({ token, sandbox, priceId, email, userId, successUrl }: Props) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  function open() {
    window.Paddle?.Checkout.open({
      items: [{ priceId, quantity: 1 }],
      ...(email ? { customer: { email } } : {}),
      customData: { user_id: userId },
      settings: { displayMode: "overlay", successUrl, allowLogout: false },
    });
  }

  useEffect(() => {
    let cancelled = false;
    loadPaddle()
      .then((Paddle) => {
        if (cancelled) return;
        if (!initialized) {
          if (sandbox) Paddle.Environment.set("sandbox");
          Paddle.Initialize({ token });
          initialized = true;
        }
        setState("ready");
        open();
      })
      .catch(() => !cancelled && setState("error"));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state === "error") {
    return <p className="mt-8 text-sm text-red-600">The checkout couldn&apos;t load. Please disable any ad blocker for this page and refresh.</p>;
  }
  return (
    <button type="button" onClick={open} disabled={state !== "ready"} className="btn-primary mt-8 px-8 py-3">
      {state === "ready" ? "Open checkout" : "Loading checkout…"}
    </button>
  );
}

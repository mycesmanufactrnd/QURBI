import React, { useEffect } from "react";
import { LockKeyhole } from "lucide-react";
import { useAuthPrompt } from "@/lib/auth-prompt-context";

export default function AuthRequiredState({
  title = "Sign in required",
  message = "Sign in to continue.",
  returnTo = "/",
}) {
  const { requestSignIn } = useAuthPrompt();

  useEffect(() => {
    requestSignIn({ returnTo, message });
  }, [message, requestSignIn, returnTo]);

  return (
    <main className="aisyah-page flex min-h-screen flex-col items-center justify-center px-6 pb-28 text-center">
      <LockKeyhole className="h-12 w-12 text-[#41362D]/35" />
      <h1 className="mt-4 text-xl font-bold text-[#41362D]">{title}</h1>
      <p className="mt-2 max-w-sm text-sm text-[#41362D]/65">{message}</p>
      <button
        type="button"
        onClick={() => requestSignIn({ returnTo, message })}
        className="mt-5 rounded-xl bg-gradient-to-br from-[#41362D] to-[#6B594A] px-6 py-3 text-sm font-bold text-white"
      >
        Sign In
      </button>
    </main>
  );
}

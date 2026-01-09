"use client";

import React, { useCallback, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, LogOut, UserRound } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../auth/useAuth";

/**
 * Client-side profile page UI.
 *
 * - **Signed out**: displays an anonymous user icon, a prompt to authenticate, and a
 *   "Sign in with Google" button that triggers the popup flow.
 * - **Signed in**: displays the user's avatar (if available), email, uid, and a sign-out button.
 *
 * All state transitions (loading → signed_out / signed_in) are handled by AuthProvider;
 * this component simply renders based on the current auth status.
 */
export default function ProfilePageClient() {
  const { status, user, signInWithGoogle, signOut } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignIn = useCallback(async () => {
    setIsSigningIn(true);
    try {
      await signInWithGoogle();
      toast.success("Signed in successfully");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign-in failed";
      toast.error(message);
    } finally {
      setIsSigningIn(false);
    }
  }, [signInWithGoogle]);

  const handleSignOut = useCallback(async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      toast.success("Signed out");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign-out failed";
      toast.error(message);
    } finally {
      setIsSigningOut(false);
    }
  }, [signOut]);

  return (
    <div className="h-full w-full bg-gray-900 flex flex-col overflow-hidden">
      {/* Simple back link */}
      <header className="shrink-0 px-4 py-3 border-b border-gray-700 bg-gray-800">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-gray-300 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to viewer
        </Link>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center p-6 overflow-y-auto">
        <div className="w-full max-w-sm flex flex-col items-center text-center">
          {status === "loading" && <LoadingState />}
          {status === "unavailable" && <UnavailableState />}
          {status === "signed_out" && (
            <SignedOutState onSignIn={handleSignIn} isSigningIn={isSigningIn} />
          )}
          {status === "signed_in" && user && (
            <SignedInState
              user={user}
              onSignOut={handleSignOut}
              isSigningOut={isSigningOut}
            />
          )}
        </div>
      </main>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Sub-components                                                             */
/* -------------------------------------------------------------------------- */

function LoadingState() {
  return (
    <>
      <div className="h-24 w-24 rounded-full border-4 border-gray-700 flex items-center justify-center mb-6">
        <div className="h-6 w-6 rounded-full border-2 border-mariner-400/40 border-t-mariner-200 animate-spin" />
      </div>
      <p className="text-gray-400 text-sm">Checking authentication...</p>
    </>
  );
}

function UnavailableState() {
  return (
    <>
      <div className="h-24 w-24 rounded-full border-2 border-gray-600 flex items-center justify-center mb-6">
        <UserRound className="h-12 w-12 text-gray-500" aria-hidden="true" />
      </div>
      <h1 className="text-xl font-semibold text-gray-100 mb-2">Authentication Unavailable</h1>
      <p className="text-gray-400 text-sm mb-6">
        Firebase authentication is not configured. Please check your environment variables.
      </p>
    </>
  );
}

function SignedOutState({
  onSignIn,
  isSigningIn,
}: {
  onSignIn: () => void;
  isSigningIn: boolean;
}) {
  return (
    <>
      {/* Large anonymous user icon */}
      <div className="h-28 w-28 rounded-full border-2 border-gray-600 flex items-center justify-center mb-6">
        <UserRound className="h-14 w-14 text-gray-300" aria-hidden="true" />
      </div>

      <h1 className="text-xl font-semibold text-gray-100 mb-2">Anonymous User</h1>
      <p className="text-gray-400 text-sm mb-8">
        Please authenticate to unlock more features
      </p>

      <button
        type="button"
        onClick={onSignIn}
        disabled={isSigningIn}
        className={[
          "w-full max-w-xs px-5 py-3 rounded-lg border border-gray-600 bg-gray-800/60",
          "text-gray-100 font-medium text-sm",
          "hover:bg-gray-700/80 hover:border-gray-500 transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mariner-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900",
          "disabled:opacity-50 disabled:cursor-not-allowed",
        ].join(" ")}
      >
        {isSigningIn ? "Signing in..." : "Sign In with Google"}
      </button>
    </>
  );
}

function SignedInState({
  user,
  onSignOut,
  isSigningOut,
}: {
  user: { uid: string; email: string | null; photoURL: string | null; displayName: string | null };
  onSignOut: () => void;
  isSigningOut: boolean;
}) {
  const displayName = user.displayName || user.email || "User";

  return (
    <>
      {/* Avatar */}
      <div className="h-28 w-28 rounded-full border-2 border-mariner-600/60 overflow-hidden flex items-center justify-center mb-6 bg-gray-800">
        {user.photoURL ? (
          <Image
            src={user.photoURL}
            alt={`Profile avatar for ${displayName}`}
            width={112}
            height={112}
            className="h-full w-full object-cover"
          />
        ) : (
          <UserRound className="h-14 w-14 text-gray-300" aria-hidden="true" />
        )}
      </div>

      {/* Display name */}
      <h1 className="text-xl font-semibold text-gray-100 mb-4">{displayName}</h1>

      {/* User details */}
      <dl className="w-full max-w-xs text-left space-y-3 mb-8">
        {user.email && (
          <div>
            <dt className="text-xs text-gray-500 uppercase tracking-wide">Email</dt>
            <dd className="text-sm text-gray-200 break-all">{user.email}</dd>
          </div>
        )}
        <div>
          <dt className="text-xs text-gray-500 uppercase tracking-wide">User ID</dt>
          <dd className="text-sm text-gray-200 font-mono break-all">{user.uid}</dd>
        </div>
      </dl>

      {/* Sign out button */}
      <button
        type="button"
        onClick={onSignOut}
        disabled={isSigningOut}
        className={[
          "w-full max-w-xs inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg",
          "border border-gray-600 bg-gray-800/60",
          "text-gray-100 font-medium text-sm",
          "hover:bg-gray-700/80 hover:border-gray-500 transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mariner-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900",
          "disabled:opacity-50 disabled:cursor-not-allowed",
        ].join(" ")}
      >
        <LogOut className="h-4 w-4" aria-hidden="true" />
        {isSigningOut ? "Signing out..." : "Sign Out"}
      </button>
    </>
  );
}

"use client";

import React, { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Loader2, LogOut, Pencil, UserRound } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../auth/useAuth";
import { useCompactLandscape } from "../utils/useCompactLandscape";
import { UsernameReservationModal } from "../components/UsernameReservationModal";
import { getUsernameForUser } from "../utils/usernameService";

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
  const [username, setUsername] = useState<string | null>(null);
  const [isLoadingUsername, setIsLoadingUsername] = useState(false);
  const [isUsernameModalOpen, setIsUsernameModalOpen] = useState(false);
  const isCompactLandscape = useCompactLandscape();

  // Fetch username when user signs in
  useEffect(() => {
    if (status === "signed_in" && user) {
      setIsLoadingUsername(true);
      getUsernameForUser(user.uid)
        .then((fetchedUsername) => {
          setUsername(fetchedUsername);
        })
        .catch((err) => {
          console.log("[ProfilePageClient] No username found", err);
          // Don't show error toast - username is optional
        })
        .finally(() => {
          setIsLoadingUsername(false);
        });
    } else {
      // Reset username when signed out
      setUsername(null);
    }
  }, [status, user]);

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
      {/* Fixed header to match main page - ensures header renders above sidebar.
          Uses same responsive padding as GameViewerPage (py-1 in compact landscape, py-3 otherwise). */}
      <header
        className={[
          "fixed top-0 left-0 right-0 z-50 bg-gray-800 border-b border-gray-700 shadow-md",
          isCompactLandscape ? "py-0" : "py-3",
        ].join(" ")}
      >
        {/* min-h-10 (40px) matches the main page header content height (logo is h-10) */}
        <div className="mx-auto flex w-full max-w-[1600px] items-center min-h-10 px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-gray-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to viewer
          </Link>
        </div>
      </header>

      {/* Main content area.
          Header height calculation:
          - Normal: py-3 (24px) + min-h-10 (40px) + border (1px) = ~65px
          - Compact landscape: py-1 (8px) + min-h-10 (40px) + border (1px) = ~49px
          Add extra buffer to ensure content never hides under the navbar.
          On mobile: align content to top for two-column grid layout
          On desktop: center content vertically for single-column layout */}
      <main
        className={[
          "flex-1 flex items-start md:items-center justify-center px-4 sm:px-6 pb-4 sm:pb-6 overflow-y-auto",
          isCompactLandscape ? "pt-16" : "pt-[76px]",
        ].join(" ")}
      >
        <div className="w-full max-w-sm md:flex md:flex-col md:items-center md:text-center">
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
              username={username}
              isLoadingUsername={isLoadingUsername}
              onSetUsername={() => setIsUsernameModalOpen(true)}
            />
          )}
        </div>
      </main>

      {/* Username reservation modal */}
      {user && (
        <UsernameReservationModal
          isOpen={isUsernameModalOpen}
          onClose={() => setIsUsernameModalOpen(false)}
          userId={user.uid}
          onSuccess={(newUsername) => {
            setUsername(newUsername);
            toast.success(`Username set to "${newUsername}"`);
          }}
        />
      )}
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
  username,
  isLoadingUsername,
  onSetUsername,
}: {
  user: { uid: string; email: string | null; photoURL: string | null; displayName: string | null };
  onSignOut: () => void;
  isSigningOut: boolean;
  username: string | null;
  isLoadingUsername: boolean;
  onSetUsername: () => void;
}) {
  const displayName = user.displayName || user.email || "User";

  return (
    <>
      {/* Mobile: Two-column grid layout (< md breakpoint)
          - Left: Avatar + name (fixed, non-scrollable)
          - Right: User details + actions (scrollable)
          Desktop: Single-column centered layout (>= md breakpoint) */}
      <div className="pt-8 w-full md:hidden">
        <div className="grid grid-cols-[auto_1fr] sm:gap-16 items-start">
          {/* Left column: Avatar + Name (fixed) */}
          <div className="flex flex-col items-center text-center sticky top-0">
            <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-full border-2 border-mariner-600/60 overflow-hidden flex items-center justify-center bg-gray-800">
              {user.photoURL ? (
                <Image
                  src={user.photoURL}
                  alt={`Profile avatar for ${displayName}`}
                  width={96}
                  height={96}
                  className="h-full w-full object-cover"
                />
              ) : (
                <UserRound className="h-10 w-10 sm:h-12 sm:w-12 text-gray-300" aria-hidden="true" />
              )}
            </div>
            <h1 className="text-base sm:text-lg font-semibold text-gray-100 mt-3 max-w-[120px] wrap-break-word">
              {displayName}
            </h1>
          </div>

          {/* Right column: User details + actions (scrollable) */}
          <div className="flex flex-col min-h-0 overflow-y-auto">
            <dl className="text-left space-y-3 mb-6">
              {/* Username field */}
              <div>
                <dt className="text-xs text-gray-500 uppercase tracking-wide">Username</dt>
                <dd className="text-sm text-gray-200 flex items-center gap-2">
                  {isLoadingUsername ? (
                    <span className="inline-flex items-center gap-1.5 text-gray-400">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Loading...
                    </span>
                  ) : username ? (
                    <span className="font-mono">{username}</span>
                  ) : (
                    <>
                      <span className="text-gray-400 italic">None</span>
                      <button
                        type="button"
                        onClick={onSetUsername}
                        className={[
                          "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs",
                          "bg-mariner-600/80 hover:bg-mariner-500 text-white",
                          "transition-colors",
                        ].join(" ")}
                      >
                        <Pencil className="h-3 w-3" aria-hidden="true" />
                        Set
                      </button>
                    </>
                  )}
                </dd>
              </div>

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

            <button
              type="button"
              onClick={onSignOut}
              disabled={isSigningOut}
              className={[
                "w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg",
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
          </div>
        </div>
      </div>

      {/* Desktop: Single-column centered layout (>= md breakpoint) */}
      <div className="hidden md:flex md:flex-col md:items-center md:text-center">
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
          {/* Username field */}
          <div>
            <dt className="text-xs text-gray-500 uppercase tracking-wide">Username</dt>
            <dd className="text-sm text-gray-200 flex items-center gap-2">
              {isLoadingUsername ? (
                <span className="inline-flex items-center gap-1.5 text-gray-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Loading...
                </span>
              ) : username ? (
                <span className="font-mono">{username}</span>
              ) : (
                <>
                  <span className="text-gray-400 italic">None</span>
                  <button
                    type="button"
                    onClick={onSetUsername}
                    className={[
                      "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs",
                      "bg-mariner-600/80 hover:bg-mariner-500 text-white",
                      "transition-colors",
                    ].join(" ")}
                  >
                    <Pencil className="h-3 w-3" aria-hidden="true" />
                    Set
                  </button>
                </>
              )}
            </dd>
          </div>

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
      </div>
    </>
  );
}

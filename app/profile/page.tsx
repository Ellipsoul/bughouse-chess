import ProfilePageClient from "./ProfilePageClient";

/**
 * Profile page route.
 *
 * Server component wrapper that renders the client-side profile UI.
 * Authentication state is managed entirely on the client via AuthProvider.
 */
export default function ProfilePage() {
  return <ProfilePageClient />;
}

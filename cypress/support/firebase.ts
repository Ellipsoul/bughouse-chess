/**
 * Firebase Test Utilities for Cypress
 *
 * Provides helper commands for testing with Firebase Auth and Firestore emulators.
 * These utilities interact directly with the emulators' REST APIs.
 */

/* -------------------------------------------------------------------------- */
/* Configuration                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Firebase Auth Emulator configuration.
 * Must match the values in cypress.config.ts and firebase.json.
 */
const AUTH_EMULATOR_HOST = "127.0.0.1:9099";
const FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
const PROJECT_ID = "demo-bughouse";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export interface TestUser {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
}

export interface CreateTestUserOptions {
  email?: string;
  password?: string;
  displayName?: string;
  photoURL?: string;
}

interface SignUpResponse {
  localId: string;
  email: string;
  idToken: string;
  refreshToken: string;
}

interface SignInResponse {
  localId: string;
  email: string;
  idToken: string;
  refreshToken: string;
  displayName?: string;
}

/* -------------------------------------------------------------------------- */
/* Auth Emulator API Functions                                                */
/* -------------------------------------------------------------------------- */

/**
 * Creates a new user in the Firebase Auth Emulator.
 *
 * @param options - User creation options
 * @returns The created user's UID and other details
 */
export async function createTestUser(options: CreateTestUserOptions = {}): Promise<TestUser> {
  const {
    email = `test-${Date.now()}@example.com`,
    password = "testpassword123",
    displayName = "Test User",
  } = options;

  const response = await fetch(
    `http://${AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
        displayName,
        returnSecureToken: true,
      }),
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create test user: ${error}`);
  }

  const data: SignUpResponse = await response.json();

  return {
    uid: data.localId,
    email: data.email,
    displayName,
  };
}

/**
 * Signs in a user with email and password in the Auth Emulator.
 * Returns the ID token that can be used for authentication.
 *
 * @param email - User's email
 * @param password - User's password
 * @returns Sign in response with tokens
 */
export async function signInTestUser(
  email: string,
  password: string,
): Promise<SignInResponse> {
  const response = await fetch(
    `http://${AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true,
      }),
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to sign in test user: ${error}`);
  }

  return await response.json();
}

/**
 * Deletes all users from the Auth Emulator.
 * Useful for cleaning up between tests.
 */
export async function clearAuthEmulator(): Promise<void> {
  const response = await fetch(
    `http://${AUTH_EMULATOR_HOST}/emulator/v1/projects/${PROJECT_ID}/accounts`,
    {
      method: "DELETE",
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to clear auth emulator: ${error}`);
  }
}

/**
 * Gets the configuration for the Auth Emulator.
 * Useful for debugging.
 */
export async function getAuthEmulatorConfig(): Promise<unknown> {
  const response = await fetch(
    `http://${AUTH_EMULATOR_HOST}/emulator/v1/projects/${PROJECT_ID}/config`,
    {
      method: "GET",
    },
  );

  if (!response.ok) {
    return null;
  }

  return await response.json();
}

/* -------------------------------------------------------------------------- */
/* Firestore Emulator API Functions                                           */
/* -------------------------------------------------------------------------- */

/**
 * Clears all data from the Firestore Emulator.
 * Useful for cleaning up between tests.
 */
export async function clearFirestoreEmulator(): Promise<void> {
  const response = await fetch(
    `http://${FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
    {
      method: "DELETE",
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to clear firestore emulator: ${error}`);
  }
}

/* -------------------------------------------------------------------------- */
/* Cypress Commands                                                           */
/* -------------------------------------------------------------------------- */

// Extend Cypress namespace with custom commands
declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Creates a new test user in the Firebase Auth Emulator.
       * @param options - Optional user creation settings
       */
      createTestUser(options?: CreateTestUserOptions): Chainable<TestUser>;

      /**
       * Signs in a test user using email and password via REST API.
       * Note: This doesn't sign in the user in the browser - use loginWithFirebase for that.
       * @param email - User's email
       * @param password - User's password
       */
      signInTestUser(email: string, password: string): Chainable<SignInResponse>;

      /**
       * Creates a user and signs them in via REST API.
       * Note: This doesn't sign in the user in the browser - use loginWithFirebase for that.
       * @param options - Optional user creation settings
       */
      loginAsNewUser(options?: CreateTestUserOptions): Chainable<TestUser>;

      /**
       * Creates a user in the emulator and signs them in via the Firebase client SDK in the browser.
       * This is the proper way to authenticate for E2E tests.
       * @param options - Optional user creation settings
       */
      loginWithFirebase(options?: CreateTestUserOptions): Chainable<TestUser>;

      /**
       * Signs out the current user in the browser via Firebase client SDK.
       */
      logoutWithFirebase(): Chainable<void>;

      /**
       * Clears all users from the Auth Emulator.
       */
      clearAuthEmulator(): Chainable<void>;

      /**
       * Clears all data from the Firestore Emulator.
       */
      clearFirestoreEmulator(): Chainable<void>;

      /**
       * Clears both Auth and Firestore emulators.
       * Useful for resetting state between tests.
       */
      clearEmulators(): Chainable<void>;
    }
  }
}

/**
 * Registers Firebase test commands with Cypress.
 * Call this in cypress/support/component.ts or cypress/support/e2e.ts.
 */
export function registerFirebaseCommands(): void {
  Cypress.Commands.add("createTestUser", (options?: CreateTestUserOptions) => {
    return cy.wrap<Promise<TestUser>, TestUser>(createTestUser(options), { log: false }).then((user: TestUser) => {
      Cypress.log({
        name: "createTestUser",
        message: `Created user: ${user.email}`,
        consoleProps: () => ({ ...user }),
      });
      return user;
    });
  });

  Cypress.Commands.add("signInTestUser", (email: string, password: string) => {
    return cy.wrap<Promise<SignInResponse>, SignInResponse>(signInTestUser(email, password), { log: false }).then((response: SignInResponse) => {
      Cypress.log({
        name: "signInTestUser",
        message: `Signed in: ${email}`,
        consoleProps: () => ({ ...response }),
      });
      return response;
    });
  });

  Cypress.Commands.add("loginAsNewUser", (options?: CreateTestUserOptions) => {
    const password = options?.password ?? "testpassword123";
    return cy.createTestUser({ ...options, password }).then((user: TestUser) => {
      return cy.signInTestUser(user.email, password).then(() => user);
    });
  });

  /**
   * Creates a user in the emulator and signs them in via the Firebase client SDK.
   * This actually signs the user into the running app.
   */
  Cypress.Commands.add("loginWithFirebase", (options?: CreateTestUserOptions) => {
    const password = options?.password ?? "testpassword123";
    const email = options?.email ?? `test-${Date.now()}@example.com`;
    const displayName = options?.displayName ?? "Test User";

    // First create the user in the emulator via REST API
    return cy.wrap<Promise<TestUser>, TestUser>(
      createTestUser({ email, password, displayName }),
      { log: false }
    ).then((user: TestUser) => {
      // Then sign in via the Firebase client SDK in the browser
      return cy.window().then((win) => {
        return new Cypress.Promise<TestUser>((resolve, reject) => {
          // Access the Firebase Auth from the window
          // We need to use dynamic import since Firebase is loaded in the app
          const signInPromise = (async () => {
            // The app should have Firebase loaded - we'll use the REST API to sign in
            // and then set the auth state via localStorage
            const response = await fetch(
              `http://${AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password, returnSecureToken: true }),
              }
            );

            if (!response.ok) {
              throw new Error("Failed to sign in");
            }

            const data = await response.json();

            // Set the Firebase auth state in localStorage
            // Firebase stores auth state with a key like: firebase:authUser:<apiKey>:<appName>
            const authKey = `firebase:authUser:fake-api-key-for-testing:[DEFAULT]`;
            const authState = {
              uid: data.localId,
              email: data.email,
              emailVerified: true,
              displayName: displayName,
              isAnonymous: false,
              providerData: [{
                providerId: "password",
                uid: data.email,
                displayName: displayName,
                email: data.email,
                phoneNumber: null,
                photoURL: null,
              }],
              stsTokenManager: {
                refreshToken: data.refreshToken,
                accessToken: data.idToken,
                expirationTime: Date.now() + 3600000,
              },
              createdAt: String(Date.now()),
              lastLoginAt: String(Date.now()),
              apiKey: "fake-api-key-for-testing",
              appName: "[DEFAULT]",
            };

            win.localStorage.setItem(authKey, JSON.stringify(authState));

            return user;
          })();

          signInPromise.then(resolve).catch(reject);
        });
      }).then((user: TestUser) => {
        Cypress.log({
          name: "loginWithFirebase",
          message: `Logged in as: ${user.email}`,
          consoleProps: () => ({ ...user }),
        });
        return user;
      });
    });
  });

  /**
   * Signs out the current user by clearing Firebase auth state from localStorage.
   */
  Cypress.Commands.add("logoutWithFirebase", () => {
    cy.window().then((win) => {
      // Clear all Firebase auth keys from localStorage
      const keysToRemove: string[] = [];
      for (let i = 0; i < win.localStorage.length; i++) {
        const key = win.localStorage.key(i);
        if (key && key.startsWith("firebase:authUser:")) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => win.localStorage.removeItem(key));
    });

    Cypress.log({
      name: "logoutWithFirebase",
      message: "Logged out user",
    });
  });

  Cypress.Commands.add("clearAuthEmulator", () => {
    return cy.wrap<Promise<void>, void>(clearAuthEmulator(), { log: false }).then(() => {
      Cypress.log({
        name: "clearAuthEmulator",
        message: "Cleared all users from Auth Emulator",
      });
    });
  });

  Cypress.Commands.add("clearFirestoreEmulator", () => {
    return cy.wrap<Promise<void>, void>(clearFirestoreEmulator(), { log: false }).then(() => {
      Cypress.log({
        name: "clearFirestoreEmulator",
        message: "Cleared all data from Firestore Emulator",
      });
    });
  });

  Cypress.Commands.add("clearEmulators", () => {
    return cy.clearAuthEmulator().then(() => cy.clearFirestoreEmulator());
  });
}

/* -------------------------------------------------------------------------- */
/* Test Helpers                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Default test user credentials.
 * Use these for consistent test user creation.
 */
export const DEFAULT_TEST_USER = {
  email: "testuser@example.com",
  password: "testpassword123",
  displayName: "Test User",
} as const;

/**
 * Creates a unique test user email based on timestamp.
 * Useful for avoiding conflicts between parallel tests.
 */
export function uniqueTestEmail(prefix = "test"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

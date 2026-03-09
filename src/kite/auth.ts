import { KiteConnect } from "kiteconnect";
import open from "open";
import { createServer } from "http";
import { URL } from "url";
import { getEnvCredentials } from "./client";
import { saveAccessToken } from "../db/tokens";
import type { UserId } from "../types";

const AUTH_PORT = 3000;
const AUTH_TIMEOUT_MS = 120_000; // 2 minutes to complete login

/**
 * Full OAuth login flow for a user:
 * 1. Spins up a local HTTP server on port 3000
 * 2. Opens the Kite login URL in the browser
 * 3. Captures the request_token from the redirect
 * 4. Calls generateSession() to get access_token
 * 5. Saves the access_token to Turso DB
 * Returns the access_token on success.
 */
export async function runKiteLogin(userId: UserId): Promise<string> {
  const { apiKey, apiSecret } = getEnvCredentials(userId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const kite = new (KiteConnect as any)({ api_key: apiKey }) as { getLoginURL: () => string; generateSession: (token: string, secret: string) => Promise<{ access_token: string }> };

  const loginUrl = kite.getLoginURL();

  return new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      try {
        if (!req.url) return;

        const parsedUrl = new URL(req.url, `http://127.0.0.1:${AUTH_PORT}`);
        const requestToken = parsedUrl.searchParams.get("request_token");
        const status = parsedUrl.searchParams.get("status");

        if (status !== "success" || !requestToken) {
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end(`<h2>❌ Login failed or cancelled. You can close this tab.</h2>`);
          server.close();
          reject(new Error("Kite login failed or was cancelled."));
          return;
        }

        // Exchange request_token for access_token
        const session = await kite.generateSession(requestToken, apiSecret);
        const accessToken = session.access_token;

        // Persist to DB
        await saveAccessToken(userId, accessToken);

        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`
          <html>
            <body style="font-family:sans-serif;text-align:center;padding:40px">
              <h2>✅ Login successful!</h2>
              <p>You are now authenticated as <strong>${userId}</strong>.</p>
              <p>You can close this tab and return to the terminal.</p>
            </body>
          </html>
        `);

        server.close();
        resolve(accessToken);
      } catch (err) {
        server.close();
        reject(err);
      }
    });

    server.listen(AUTH_PORT, "127.0.0.1", async () => {
      console.log(`\n🔐 Opening Kite login for ${userId}...`);
      console.log(`   If the browser doesn't open, visit:\n   ${loginUrl}\n`);
      await open(loginUrl);
    });

    // Timeout safety — don't hang forever
    setTimeout(() => {
      server.close();
      reject(new Error("Login timed out (2 minutes). Please try again."));
    }, AUTH_TIMEOUT_MS);
  });
}

import { Router } from "express";

const router = Router();

router.post("/github-token", async (req, res) => {
  const { code, redirectUri } = req.body as {
    code?: string;
    redirectUri?: string;
  };

  if (!code || typeof code !== "string") {
    res.status(400).json({ error: "code is required" });
    return;
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    req.log.error("GitHub OAuth env vars not set (GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET)");
    res.status(500).json({ error: "GitHub OAuth not configured on this server" });
    return;
  }

  try {
    const response = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        ...(redirectUri ? { redirect_uri: redirectUri } : {}),
      }),
    });

    const data = (await response.json()) as {
      access_token?: string;
      error?: string;
      error_description?: string;
    };

    if (data.error || !data.access_token) {
      req.log.warn({ error: data.error }, "GitHub token exchange error");
      res.status(400).json({
        error: data.error_description ?? data.error ?? "Token exchange failed",
      });
      return;
    }

    res.json({ access_token: data.access_token });
  } catch (err) {
    req.log.error(err, "GitHub token exchange request failed");
    res.status(500).json({ error: "Token exchange failed. Please try again." });
  }
});

export default router;

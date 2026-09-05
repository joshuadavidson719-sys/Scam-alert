import { Router, type IRouter } from "express";

const router: IRouter = Router();

router.get("/child-safety", (_req, res) => {
  res
    .status(200)
    .type("html")
    .send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta
      name="description"
      content="ScamAlert standards against child sexual abuse and exploitation."
    />
    <title>Child Safety Standards | ScamAlert</title>
    <style>
      :root {
        color-scheme: light;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #f4f8f7;
        color: #173531;
      }
      * { box-sizing: border-box; }
      body { margin: 0; line-height: 1.65; }
      main {
        width: min(760px, calc(100% - 32px));
        margin: 48px auto;
        padding: clamp(28px, 6vw, 56px);
        background: #ffffff;
        border: 1px solid #dce9e6;
        border-radius: 20px;
        box-shadow: 0 18px 50px rgba(17, 70, 62, 0.09);
      }
      .eyebrow {
        margin: 0 0 8px;
        color: #007d6d;
        font-size: 0.78rem;
        font-weight: 800;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }
      h1, h2 { line-height: 1.2; color: #103f38; }
      h1 { margin: 0 0 12px; font-size: clamp(2rem, 7vw, 3.25rem); }
      h2 { margin: 34px 0 10px; font-size: 1.25rem; }
      p, li { color: #405c57; }
      ul { padding-left: 1.25rem; }
      .notice {
        margin: 28px 0;
        padding: 18px 20px;
        border-left: 4px solid #00a990;
        border-radius: 0 12px 12px 0;
        background: #ebfaf7;
      }
      a { color: #006f61; font-weight: 700; }
      footer {
        margin-top: 40px;
        padding-top: 20px;
        border-top: 1px solid #dce9e6;
        color: #6a817d;
        font-size: 0.9rem;
      }
    </style>
  </head>
  <body>
    <main>
      <p class="eyebrow">ScamAlert safety policy</p>
      <h1>Child Safety Standards</h1>
      <p>
        ScamAlert is committed to protecting children and maintaining a safe
        community. We have zero tolerance for child sexual abuse and
        exploitation (CSAE), child sexual abuse material (CSAM), grooming,
        trafficking, or any content or conduct that sexualizes or endangers a
        child.
      </p>

      <div class="notice">
        Content involving the abuse or exploitation of a child is strictly
        prohibited, regardless of whether it is real, generated, altered, or
        shared with harmful intent.
      </div>

      <h2>Prohibited content and conduct</h2>
      <ul>
        <li>Creating, uploading, requesting, sharing, or promoting CSAM.</li>
        <li>Sexualizing minors or encouraging sexual contact with minors.</li>
        <li>Grooming, sextortion, trafficking, or attempts to exploit a child.</li>
        <li>Links, instructions, or communities that facilitate child exploitation.</li>
      </ul>

      <h2>Reporting safety concerns</h2>
      <p>
        Users can report concerning posts or accounts through ScamAlert's
        in-app reporting tools. Urgent child-safety concerns may also be sent
        to
        <a href="mailto:joshuadavidson719@gmail.com">joshuadavidson719@gmail.com</a>.
        Please do not email or redistribute illegal imagery.
      </p>

      <h2>Our response</h2>
      <p>
        We review reports and may remove content, restrict or terminate
        accounts, preserve relevant records, and take other protective action.
        When required or appropriate, we report apparent CSAM and child
        exploitation to the relevant authorities and child-protection
        organizations, and cooperate with lawful investigations.
      </p>

      <h2>Immediate danger</h2>
      <p>
        If a child is in immediate danger, contact local emergency services or
        the appropriate law-enforcement agency in your country.
      </p>

      <footer>Effective September 4, 2026 · ScamAlert</footer>
    </main>
  </body>
</html>`);
});

export default router;
import { Router, type IRouter } from "express";

const router: IRouter = Router();

router.get("/privacy-policy", (_req, res) => {
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
      content="Learn what information ScamAlert collects, how it is used, and how to request its deletion."
    />
    <title>Privacy Policy | ScamAlert</title>
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
      a { color: #006f61; font-weight: 700; }
      .notice {
        margin: 28px 0;
        padding: 18px 20px;
        border-left: 4px solid #00a990;
        border-radius: 0 12px 12px 0;
        background: #ebfaf7;
      }
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
      <p class="eyebrow">ScamAlert</p>
      <h1>Privacy Policy</h1>
      <p>Last updated: November 3, 2026</p>
      <p>
        This policy explains how ScamAlert collects, uses, stores, and shares
        information when you use the app. If you have questions or want to
        request deletion of your account information, contact
        <a href="mailto:joshuadavidson719@gmail.com">joshuadavidson719@gmail.com</a>.
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li>
          <strong>Account and profile information:</strong> email address,
          username, and information you choose to add, such as a bio, category,
          or profile image. If you choose Google sign-in, Google provides basic
          account information such as your email, display name, and profile
          image.
        </li>
        <li>
          <strong>Content you submit:</strong> posts, descriptions, comments,
          likes, follows, messages, and reports, including details you choose
          to include in a report.
        </li>
        <li>
          <strong>Media you select:</strong> images or videos you choose to
          attach to a post. The app accesses selected media to provide that
          feature; it does not need access to your entire library in the
          background.
        </li>
        <li>
          <strong>Notification information:</strong> if you grant notification
          permission, the app may store a push notification token and
          notification preferences or records needed to deliver and display
          notifications.
        </li>
        <li>
          <strong>Service and device information:</strong> our service
          providers may process technical information, such as app/device
          details, IP address, and authentication or diagnostic events, to
          operate, secure, and troubleshoot their services.
        </li>
      </ul>

      <h2>How we use information</h2>
      <ul>
        <li>Create and secure your account and show your profile.</li>
        <li>Publish and display community posts, comments, likes, and follows.</li>
        <li>Provide chat, notifications, reporting, and moderation features.</li>
        <li>Maintain, troubleshoot, and protect the app and its users.</li>
        <li>Respond to support requests and comply with legal obligations.</li>
      </ul>

      <h2>What other users can see</h2>
      <p>
        Posts and related media you submit are intended to be shared with the
        ScamAlert community. Your username, profile image, bio, and community
        activity may be visible to other users. Direct messages are intended
        for the chat participants. Reports are used for moderation and may be
        reviewed by people responsible for app safety. Do not post information
        you do not want other users to see.
      </p>

      <h2>AI tools and Premium purchases</h2>
      <p>
        Groq processes the text, links, and phone numbers you submit to the text AI
        tools. OpenAI processes your image prompts and image frames for Premium
        generation. Do not submit passwords, banking credentials, or sensitive
        personal information. AI assessments do not establish whether a person,
        phone number, or website is safe.
      </p>
      <p>
        We store generation prompts and results privately so you can recover
        interrupted requests, and record subscription identifiers and credit usage
        to apply your monthly allowance. Generated results are not published to
        other users unless you share them. RevenueCat verifies subscriptions;
        Google Play handles Android payments. We do not receive or store your
        payment-card details. You may request deletion using the contact details below.
      </p>
      <h2>Institutional subscriptions</h2>
      <p>
        Whop processes website subscriptions for banks and credit unions. When you
        open institutional checkout, we send Whop your institution name, app account
        identifier and selected market. Whop handles payment details, billing
        history, receipts and cancellation under its own privacy policy. Scam Alert
        does not receive or store card or bank details. A checkout return does not
        by itself confirm payment or activate app access.
      </p>
      <h2>Institutional passkeys</h2>
      <p>
        Institutional website checkout requires a passkey, a verified account and
        recent sign-in. We store public keys, website scope, verification counters
        and minimal security metadata in server-protected Firebase records.
        Fingerprints, face scans, device PINs and private passkey keys stay with
        your device or passkey provider and are not sent to Scam Alert.
        Approval challenges expire and cannot be reused. If all registered devices
        are lost, manual identity review is required; an email reset does not
        remove passkey protection.
      </p>
      <h2>Profile photos</h2>
      <p>
        If you choose a profile photo, the image is stored in our app storage and
        its reference is saved in your Firebase profile. Profile images are visible
        to other users and may be accessed through their image links. Do not upload
        sensitive or private images. You can use a preset avatar instead.
      </p>
      <h2>Service providers and sharing</h2>
      <p>
        ScamAlert uses Firebase services provided by Google to support account
        authentication and store app data and user-selected media. If you use
        Google sign-in, Google processes your sign-in request. Expo's push
        notification service may process push tokens and notification content
        to deliver notifications when you allow them. These providers process
        information under their own privacy terms and to provide their
        services. We do not sell personal information or use it for
        third-party advertising.
      </p>

      <h2>Permissions and choices</h2>
      <p>
        You can choose whether to use Google sign-in, whether to submit
        optional profile details or post media, and whether to allow
        notifications. You can manage app permissions in your device settings.
        You may contact us to request access to or deletion of your account
        information.
      </p>

      <h2>Retention and deletion requests</h2>
      <p>
        We keep account information and content for as long as needed to
        provide the service, operate the community, address safety reports, and
        meet legal obligations. To request account and personal-data deletion,
        email
        <a href="mailto:joshuadavidson719@gmail.com">joshuadavidson719@gmail.com</a>
        from the email address associated with your account and include
        “ScamAlert account deletion” in the subject. We may retain limited
        information when needed for safety, fraud prevention, legal compliance,
        or dispute resolution.
      </p>

      <h2>Children's privacy</h2>
      <p>
        ScamAlert prohibits child sexual abuse and exploitation. If you
        believe a child has provided personal information or is at risk, please
        contact us at
        <a href="mailto:joshuadavidson719@gmail.com">joshuadavidson719@gmail.com</a>.
        See our
        <a href="/api/child-safety">Child Safety Standards</a>.
      </p>

      <h2>Changes and contact</h2>
      <p>
        We may update this policy as the app changes or legal requirements
        change. The current version will be published on this page. For privacy
        questions or requests, email
        <a href="mailto:joshuadavidson719@gmail.com">joshuadavidson719@gmail.com</a>.
      </p>

      <footer>
        <a href="/api/child-safety">Child Safety Standards</a>
      </footer>
    </main>
  </body>
</html>`);
});

export default router;
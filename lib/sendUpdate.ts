import { resend, FROM } from "@/lib/email";

type SendUpdateResult = Awaited<ReturnType<typeof resend.emails.send>>;

/**
 * Send a product update or newsletter email.
 * @param to     Single email or array of recipients
 * @param subject  Email subject line
 * @param html     HTML body
 * @param text     Optional plain-text fallback (auto-generated from HTML if omitted)
 */
export async function sendUpdate(
  to: string | string[],
  subject: string,
  html: string,
  text?: string
): Promise<SendUpdateResult> {
  try {
    return await resend.emails.send({
      from: FROM.updates, // updates@aeobro.com
      to,
      subject,
      html,
      text: text ?? html.replace(/<[^>]+>/g, ""),
      headers: {
        // helpful but optional:
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        "List-Unsubscribe": "<mailto:unsubscribe@aeobro.com>",
      },
      // reply_to: "support@aeobro.com", // uncomment if you want a reply-to
      // tags: [{ name: "source", value: "product-update" }], // useful for analytics
    });
  } catch (err) {
    console.error("sendUpdate failed:", err);
    throw err;
  }
}

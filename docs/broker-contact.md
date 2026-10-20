# Global Broker contact relay

The customer uses the Broker “Bize ulaşın” form. Personal owner email/phone stay private. Broker signs a validated message and an HMAC of the edge IP; the AI Visibility server verifies the signature and timestamp before touching storage. Only the configured `ADMIN_RECOVERY_EMAIL` receives the notification through the existing verified sender. Customer fields cannot choose a recipient. No automatic reply or customer enrollment is created.

Set the same production-only `BROKER_CONTACT_RELAY_SECRET` in both projects. This value is never committed or exposed to the browser. Preview deployments cannot forward through production. The existing mail credentials remain solely in AI Visibility.

Messages persist in the server database before the provider call. The same receipt and exact body reuse the existing message; conflicting content is rejected. The existing provider deduplication mechanism prevents a second email. Limits are three new messages per edge-IP digest per ten minutes and fifty globally per rolling day, enforced under a database lock across function instances.

`email_accepted` means the email service accepted the message, not that inbox delivery or reading was proven. `queued` means the private message is saved but email forwarding is pending. The existing daily cycle retries up to two queued items after its own work; an ambiguous send outside the provider deduplication window is held for review. The protected `/admin/broker-mesajlari` inbox also offers retry for queued messages. Message bodies are never returned by the public Broker endpoint.

The owner mailbox production test has one fixed UUID, clearly labels itself as a system test, and repeats the same payload to verify deduplication. It is not real-customer acceptance evidence.

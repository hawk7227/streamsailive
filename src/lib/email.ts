import { toErrorMessage } from "@/lib/utils/error";
import nodemailer from "nodemailer";
import { createAdminClient } from "@/lib/supabase/admin";
import { SMTP_FROM, SMTP_HOST, SMTP_PASS, SMTP_SECURE, SMTP_USER } from "@/lib/env";

interface SendEmailParams {
    to: string;
    subject: string;
    body: string;
    workspaceId: string;
    lead?: {
        name?: string;
        email?: string;
        phone?: string;
        company?: string;
        [key: string]: unknown;
    };
    fromName?: string;
    fromEmail?: string;
}

export async function sendEmail({
    to,
    subject,
    body,
    workspaceId,
    lead,
    fromName,
    fromEmail,
}: SendEmailParams) {
    try {
        // Variable Substitution
        let finalSubject = subject;
        let finalBody = body;

        if (lead) {
            const variables = {
                name: lead.name || "",
                email: lead.email || "",
                phone: lead.phone || "",
                company: lead.company || "",
                ...lead,
            };

            Object.entries(variables).forEach(([key, value]) => {
                if (typeof value === "string" || typeof value === "number") {
                    const valStr = String(value);
                    const regex = new RegExp(`\\[${key}\\]`, "gi");
                    const regexMustache = new RegExp(`{{${key}}}`, "gi");
                    finalSubject = finalSubject.replace(regex, valStr).replace(regexMustache, valStr);
                    finalBody = finalBody.replace(regex, valStr).replace(regexMustache, valStr);
                }
            });
        }

        // Initialize Supabase Admin to fetch secrets/integrations securely
        const supabase = createAdminClient();

        // Fetch the active SMTP integration for this workspace/workflow
        const { data: integration } = await supabase
            .from("workflow_integrations")
            .select("id")
            .eq("workflow_id", workspaceId)
            .eq("integration_type", "smtp")
            .eq("is_active", true)
            .maybeSingle();

        let transporter;

        if (integration) {
            const { data: credentials } = await supabase
                .from("integration_credentials")
                .select("credential_key, credential_value")
                .eq("integration_id", integration.id);

            if (credentials && credentials.length > 0) {
                const credentialsObj: Record<string, string> = {};
                credentials.forEach((cred: Record<string, string>) => {
                    credentialsObj[cred.credential_key] = cred.credential_value;
                });
                const { host, port, username, password, from_name, use_tls } = credentialsObj;

                transporter = nodemailer.createTransport({
                    host,
                    port: parseInt(port),
                    secure: use_tls === "true",
                    auth: { user: username, pass: password },
                });

                // Override from details if not provided
                if (!fromName && from_name) fromName = from_name;

                // If fromEmail is not provided, default to the SMTP username
                if (!fromEmail && username) fromEmail = username;
            }
        }

        // Fallback to Env Vars
        if (!transporter) {
            if (SMTP_HOST) {
                transporter = nodemailer.createTransport({
                    host: SMTP_HOST,
                    port: parseInt(process.env.SMTP_PORT || "587"),
                    secure: SMTP_SECURE === "true",
                    auth: {
                        user: SMTP_USER,
                        pass: SMTP_PASS,
                    },
                });
            } else {
                console.log("MOCK EMAIL SEND:", { to, finalSubject, finalBody });
                return { success: true, message: "Mock email sent (no config)", mock: true };
            }
        }

        const info = await transporter.sendMail({
            from: `"${fromName || "StreamsAI"}" <${fromEmail || SMTP_FROM || "no-reply@streamsai.com"}>`,
            to,
            subject: finalSubject,
            text: finalBody,
            html: `<div style="white-space: pre-wrap;">${finalBody}</div>`,
        });

        console.log("Email sent:", info.messageId);
        return { success: true, messageId: info.messageId };

    } catch (error: unknown) {
        console.error("Error in sendEmail:", error);
        throw new Error(toErrorMessage(error) || "Failed to send email");
    }
}

import twilio from "twilio";

type LeadLike = {
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  [key: string]: any;
};

function substitute(text: string, lead?: LeadLike) {
  if (!lead || !text) return text;
  let out = text;
  const variables = {
    name: lead.name || "",
    email: lead.email || "",
    phone: lead.phone || "",
    company: lead.company || "",
    ...lead,
  };

  for (const [key, value] of Object.entries(variables)) {
    if (typeof value === "string" || typeof value === "number") {
      const valStr = String(value);
      const bracket = new RegExp(`\\[${key}\\]`, "gi");
      const mustache = new RegExp(`{{${key}}}`, "gi");
      out = out.replace(bracket, valStr).replace(mustache, valStr);
    }
  }
  return out;
}

function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) return null;
  return twilio(accountSid, authToken);
}

export async function sendSms(params: {
  to: string;
  body: string;
  lead?: LeadLike;
}) {
  const from = process.env.TWILIO_FROM_NUMBER;
  const client = getTwilioClient();
  const finalBody = substitute(params.body, params.lead);

  if (!client || !from) {
    console.log("MOCK SMS SEND:", { to: params.to, body: finalBody });
    return { success: true, mock: true };
  }

  const message = await client.messages.create({
    from,
    to: params.to,
    body: finalBody,
  });

  return { success: true, sid: message.sid };
}

export async function sendMms(params: {
  to: string;
  body: string;
  mediaUrl: string;
  lead?: LeadLike;
}) {
  const from = process.env.TWILIO_FROM_NUMBER;
  const client = getTwilioClient();
  const finalBody = substitute(params.body, params.lead);

  if (!client || !from) {
    console.log("MOCK MMS SEND:", { to: params.to, body: finalBody, mediaUrl: params.mediaUrl });
    return { success: true, mock: true };
  }

  const message = await client.messages.create({
    from,
    to: params.to,
    body: finalBody,
    mediaUrl: [params.mediaUrl],
  });

  return { success: true, sid: message.sid };
}


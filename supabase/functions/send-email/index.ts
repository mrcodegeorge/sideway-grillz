import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import nodemailer from "npm:nodemailer@6.9.13";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const {
      smtpHost,
      smtpPort = 587,
      smtpSecurity = "TLS",
      smtpUsername,
      smtpPassword,
      smtpFromName = "Sideways Grillz POS",
      smtpFromEmail,
      to,
      subject,
      text,
      html,
    } = await req.json();

    if (!smtpHost || !smtpUsername || !smtpPassword) {
      return new Response(
        JSON.stringify({ error: "Missing SMTP host, username, or password." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!to || !subject) {
      return new Response(
        JSON.stringify({ error: "Missing recipient email (to) or subject." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const portNum = Number(smtpPort) || 587;
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: portNum,
      secure: smtpSecurity === "SSL" || portNum === 465,
      auth: {
        user: smtpUsername,
        pass: smtpPassword,
      },
      tls:
        smtpSecurity === "None"
          ? { rejectUnauthorized: false }
          : undefined,
    });

    const fromAddress = smtpFromEmail || smtpUsername;
    const info = await transporter.sendMail({
      from: `"${smtpFromName}" <${fromAddress}>`,
      to: Array.isArray(to) ? to.join(", ") : to,
      subject,
      text: text || "",
      html: html || undefined,
    });

    return new Response(
      JSON.stringify({ success: true, messageId: info.messageId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || "Email failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});


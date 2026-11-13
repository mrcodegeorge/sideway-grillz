import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
      provider = "Arkesel",
      senderId = "SidewaysPOS",
      apiKey = "",
      apiSecret = "",
      to,
      message,
    } = await req.json();

    if (!to || !message) {
      return new Response(
        JSON.stringify({ error: "Missing recipient phone (to) or message." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let cleanPhone = String(to).trim().replace(/\s+/g, "");
    // Normalize Ghana local 0XXXXXXXXX to 233XXXXXXXXX if needed
    if (cleanPhone.startsWith("0") && cleanPhone.length === 10) {
      cleanPhone = `233${cleanPhone.slice(1)}`;
    }

    let providerResponse;

    if (provider === "Arkesel") {
      const res = await fetch("https://sms.arkesel.com/api/v2/sms/send", {
        method: "POST",
        headers: {
          "api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sender: senderId,
          message,
          recipients: [cleanPhone],
        }),
      });
      providerResponse = await res.json();
      if (!res.ok) throw new Error(providerResponse?.message || "Arkesel SMS failed");
    } else if (provider === "Hubtel") {
      const url = new URL("https://smsc.hubtel.com/v1/messages/send");
      url.searchParams.set("clientid", apiKey);
      url.searchParams.set("clientsecret", apiSecret);
      url.searchParams.set("from", senderId);
      url.searchParams.set("to", cleanPhone);
      url.searchParams.set("content", message);

      const res = await fetch(url.toString(), { method: "GET" });
      providerResponse = await res.json();
      if (!res.ok) throw new Error(providerResponse?.Message || "Hubtel SMS failed");
    } else if (provider === "mNotify") {
      const res = await fetch(
        `https://api.mnotify.com/api/sms/quick?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipient: [cleanPhone],
            sender: senderId,
            message,
            is_schedule: false,
            schedule_date: "",
          }),
        }
      );
      providerResponse = await res.json();
      if (!res.ok) throw new Error(providerResponse?.message || "mNotify SMS failed");
    } else if (provider === "Twilio") {
      // apiKey = Account SID, apiSecret = Auth Token
      const form = new URLSearchParams();
      form.set("To", cleanPhone.startsWith("+") ? cleanPhone : `+${cleanPhone}`);
      form.set("From", senderId);
      form.set("Body", message);

      const auth = btoa(`${apiKey}:${apiSecret}`);
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${apiKey}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: form.toString(),
        }
      );
      providerResponse = await res.json();
      if (!res.ok) throw new Error(providerResponse?.message || "Twilio SMS failed");
    } else {
      throw new Error(`Unsupported provider: ${provider}`);
    }

    return new Response(
      JSON.stringify({ success: true, provider, response: providerResponse }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || "SMS failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});


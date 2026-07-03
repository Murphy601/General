import "dotenv/config";

function required(name, fallback = "") {
  return process.env[name] ?? fallback;
}

export const config = {
  port: Number(process.env.PORT || 3000),

  whatsapp: {
    accessToken: required("WHATSAPP_ACCESS_TOKEN"),
    phoneNumberId: required("WHATSAPP_PHONE_NUMBER_ID"),
    businessAccountId: required("WHATSAPP_BUSINESS_ACCOUNT_ID"),
    verifyToken: required("WHATSAPP_VERIFY_TOKEN", "sokoni_verify_token"),
    apiVersion: required("WHATSAPP_API_VERSION", "v21.0"),
  },

  openai: {
    apiKey: required("OPENAI_API_KEY"),
    model: required("OPENAI_MODEL", "gpt-4o-mini"),
  },

  affiliates: {
    kilimall: required("KILIMALL_AFFILIATE_ID", "demo-kilimall"),
    jumia: required("JUMIA_AFFILIATE_ID", "demo-jumia"),
    aliexpress: required("ALIEXPRESS_AFFILIATE_ID", "demo-aliexpress"),
    temu: required("TEMU_AFFILIATE_ID", "demo-temu"),
    amazon: required("AMAZON_AFFILIATE_TAG", "demo-amazon"),
  },

  adminNotifyUrl: required("ADMIN_NOTIFY_URL"),

  brand: {
    name: "Sokoni",
    tagline: "Your Market, On WhatsApp.",
  },
};

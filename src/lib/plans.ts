export interface PlanDefinition {
  id: 'free' | 'pro';
  label: string;
  monthlyPrice: number;
  botLimit: number;
  tokenQuota: number;
  chatQuota: number;
  features: string[];
  highlighted?: boolean;
}

export const PLANS: Record<'free' | 'pro', PlanDefinition> = {
  free: {
    id: 'free',
    label: 'Free',
    monthlyPrice: 0,
    botLimit: 1,
    tokenQuota: 25000,
    chatQuota: 50,
    features: [
      '1 Chatbot / project',
      '25K tokens per month',
      '50 chat messages per month (unlimited with custom API key)',
      'Lead capture in chat widget',
      'Email + Telegram lead notifications',
      'Community support',
    ],
  },
  pro: {
    id: 'pro',
    label: 'Pro',
    monthlyPrice: 9,
    botLimit: 10,
    tokenQuota: 2500000,
    chatQuota: 50000,
    highlighted: true,
    features: [
      'Up to 10 chatbots / projects',
      '2.5M tokens per month',
      '50,000 chat messages per month',
      'Advance lead capture + CTA forms',
      'Email, WhatsApp & Telegram notifications',
      'Usage analytics & quota dashboard',
      'Priority email support',
    ],
  },
};

export const PAYPAL_PLAN_PRICE = PLANS.pro.monthlyPrice;
export const PAYPAL_PLAN_LABEL = PLANS.pro.label;

export function getPlanInfo(plan?: string | null): PlanDefinition {
  return plan === 'pro' ? PLANS.pro : PLANS.free;
}

export function formatTokens(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return String(n);
}

export function formatMoney(centsOrDollars: number): string {
  return `$${centsOrDollars.toFixed(2)}`;
}
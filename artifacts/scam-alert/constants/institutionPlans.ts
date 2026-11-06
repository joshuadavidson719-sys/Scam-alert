export type PricingStatus = "set" | "local-not-set" | "tbc";

export type InstitutionRegion = {
  id: string;
  name: string;
  group: "Eastern Caribbean (XCD)" | "Canada (CAD)" | "Other Caribbean" | "International";
  currency: string | null;
  status: PricingStatus;
  monthly: number | null;
  priceLabel: string;
};

const xcd = (id: string, name: string): InstitutionRegion => ({
  id, name, group: "Eastern Caribbean (XCD)", currency: "XCD", status: "set",
  monthly: 2000, priceLabel: "EC$2,000",
});

const localNotSet = (id: string, name: string, currency: string): InstitutionRegion => ({
  id, name, group: "Other Caribbean", currency, status: "local-not-set",
  monthly: null, priceLabel: "Local pricing not set",
});

export const INSTITUTION_REGIONS: InstitutionRegion[] = [
  xcd("gd", "Grenada"),
  xcd("ag", "Antigua and Barbuda"),
  xcd("dm", "Dominica"),
  xcd("kn", "Saint Kitts and Nevis"),
  xcd("lc", "Saint Lucia"),
  xcd("vc", "Saint Vincent and the Grenadines"),
  xcd("ai", "Anguilla"),
  xcd("ms", "Montserrat"),
  { id: "ca", name: "Canada", group: "Canada (CAD)", currency: "CAD", status: "set", monthly: 2000, priceLabel: "CA$2,000" },
  localNotSet("jm", "Jamaica", "JMD"),
  localNotSet("tt", "Trinidad and Tobago", "TTD"),
  localNotSet("bb", "Barbados", "BBD"),
  localNotSet("gy", "Guyana", "GYD"),
  localNotSet("bz", "Belize", "BZD"),
  localNotSet("bs", "Bahamas", "BSD"),
  { id: "other", name: "Other country", group: "International", currency: null, status: "tbc", monthly: null, priceLabel: "Pricing to be confirmed" },
];

export const DEFAULT_REGION_ID = "gd";

export const INSTITUTION_SERVICES = [
  {
    icon: "shield" as const,
    title: "Name protection watch",
    body: "Our team looks out for fake pages and impersonation using your institution's name, and flags what we find to you. Proposed as a managed, people-led service, not automated monitoring.",
  },
  {
    icon: "users" as const,
    title: "Daily scam education",
    body: "Short, regular reminders for employees and customers to beware of scams, drawn from what the community is reporting.",
  },
  {
    icon: "radio" as const,
    title: "Public-awareness ads",
    body: "Awareness campaigns about scams and suspicious activity, shared with the public under a scope and advertising budget agreed with you.",
  },
];

export const INSTITUTION_CAVEATS = [
  "Billing is per institution, renews automatically every 30 days, and is managed through Whop.",
  "Confirm service delivery, onboarding and advertising budget with Scam Alert. Buying a subscription does not automatically launch advertisements.",
  "This is a proposed managed service. It does not guarantee fraud prevention or removal of fake pages.",
  "Community reports are not official takedown requests.",
];

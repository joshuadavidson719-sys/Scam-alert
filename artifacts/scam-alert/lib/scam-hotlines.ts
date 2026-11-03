export interface ScamHotline {
  countryCode: string;
  country: string;
  agency: string;
  phone: string;
  purpose: string;
  hours?: string;
  sourceUrl: string;
  verifiedOn: string;
}

// Checked against each agency's own published information, not AI-generated contacts.
// General police and advice lines are explicitly distinguished from reporting lines.
// Do not infer international dialling formats for domestic short codes or toll-free lines.
const verifiedOn = "2026-11-03";
export const SCAM_HOTLINES: ScamHotline[] = [
  {
    countryCode: "AR", country: "Argentina", agency: "Defensa del Consumidor",
    phone: "0800 666 1518", purpose: "Consumer advice and help with complaints about goods or services; not a police crime-reporting line.",
    hours: "Monday–Friday, 8 am–4 pm (Argentina time)",
    sourceUrl: "https://www.argentina.gob.ar/defensadelconsumidor/informacion", verifiedOn,
  },
  {
    countryCode: "AU", country: "Australia", agency: "Australian Cyber Security Hotline",
    phone: "1300 292 371", purpose: "Cyber security incident advice and assistance. Ask about reporting cybercrime or online scams.",
    sourceUrl: "https://www.cyber.gov.au/about-us/about-acsc/contact-us", verifiedOn,
  },
  {
    countryCode: "CA", country: "Canada", agency: "Canadian Anti-Fraud Centre",
    phone: "1 888 495 8501", purpose: "Report fraud and cybercrime, including attempted scams. Also contact local police if you were a victim.",
    hours: "Monday–Friday, 10 am–4:45 pm Eastern; closed on holidays",
    sourceUrl: "https://antifraudcentre-centreantifraude.ca/report-signalez-eng.htm", verifiedOn,
  },
  {
    countryCode: "FR", country: "France", agency: "Info-Escroqueries — Police Nationale",
    phone: "0805 805 817", purpose: "Police and gendarmerie advice for online scam victims; guidance on how to report.",
    hours: "Monday–Friday, 9 am–6:30 pm (France time)",
    sourceUrl: "https://www.police-nationale.interieur.gouv.fr/actualite/info-escroqueries-plate-forme-pour-signaler-escroqueries-sur-internet", verifiedOn,
  },
  {
    countryCode: "GD", country: "Grenada", agency: "Royal Grenada Police Force headquarters",
    phone: "+1 473 440 3999", purpose: "General police headquarters contact. Ask how to report suspected fraud; this is not a dedicated scam hotline.",
    sourceUrl: "https://www.gov.gd/index.php/emergency-services", verifiedOn,
  },
  {
    countryCode: "HK", country: "Hong Kong", agency: "Anti-Deception Coordination Centre",
    phone: "18222", purpose: "Anti-scam consultation for suspicious deception cases. An enquiry line, not a substitute for filing a police report.",
    hours: "24 hours",
    sourceUrl: "https://www.adcc.gov.hk/en-hk/contact-us.html", verifiedOn,
  },
  {
    countryCode: "IN", country: "India", agency: "National Cyber Crime Helpline",
    phone: "1930", purpose: "Report online financial fraud promptly. Also follow the reporting steps on the national cybercrime portal.",
    sourceUrl: "https://cybercrime.gov.in/webform/Crime_NodalGrivanceList.aspx", verifiedOn,
  },
  {
    countryCode: "JM", country: "Jamaica", agency: "Major Organised Crime & Anti-Corruption Agency",
    phone: "888 662 2847", purpose: "Report organised financial crime or corruption. For other scams, ask which police unit should receive the report.",
    sourceUrl: "https://www.moca.gov.jm/", verifiedOn,
  },
  {
    countryCode: "KE", country: "Kenya", agency: "Directorate of Criminal Investigations",
    phone: "0800 722 203", purpose: "Police crime-information line. Provide information about suspected criminal activity, including fraud.",
    sourceUrl: "https://www.dci.go.ke/contact-us", verifiedOn,
  },
  {
    countryCode: "MY", country: "Malaysia", agency: "National Scam Response Centre",
    phone: "997", purpose: "Urgent response to recently discovered online financial scams. Contact your bank immediately and file a police report as directed.",
    sourceUrl: "https://nfcc.jpm.gov.my/index.php/en/about-nsrc", verifiedOn,
  },
  {
    countryCode: "NZ", country: "New Zealand", agency: "Police non-emergency reporting",
    phone: "105", purpose: "Report fraud, scams, or cybercrime when an emergency response is not required.",
    sourceUrl: "https://www.police.govt.nz/use-105", verifiedOn,
  },
  {
    countryCode: "SG", country: "Singapore", agency: "ScamShield Helpline",
    phone: "1799", purpose: "Advice if you are unsure whether something is a scam; guidance on what to do next.",
    hours: "24 hours, every day",
    sourceUrl: "https://www.tech.gov.sg/products-and-services/for-citizens/scam-prevention/scamshield", verifiedOn,
  },
  {
    countryCode: "ZA", country: "South Africa", agency: "SAPS Crime Stop",
    phone: "08600 10111", purpose: "Anonymous crime tips, including information about fraud. Domestic shared-call line; not for emergency response.",
    hours: "24 hours",
    sourceUrl: "https://www.saps.gov.za/crimestop/cs_qa.php", verifiedOn,
  },
  {
    countryCode: "ES", country: "Spain", agency: "INCIBE cybersecurity helpline",
    phone: "017", purpose: "Free, confidential cybersecurity and online-scam advice. Ask how to contact the appropriate reporting authority.",
    sourceUrl: "https://www.incibe.es/linea-de-ayuda-en-ciberseguridad", verifiedOn,
  },
  {
    countryCode: "TT", country: "Trinidad and Tobago", agency: "Police customer service",
    phone: "+1 868 612 0102", purpose: "General police contact. Ask for the Fraud Squad; the published customer-service extension is 13119.",
    sourceUrl: "https://ttps.gov.tt/contact/", verifiedOn,
  },
  {
    countryCode: "GB", country: "United Kingdom — England, Wales & Northern Ireland", agency: "Report Fraud",
    phone: "0300 123 2040", purpose: "Fraud and cybercrime reporting. For Scotland, use the separate Police Scotland listing.",
    sourceUrl: "https://www.actionfraud.police.uk/reportscam", verifiedOn,
  },
  {
    countryCode: "GB-SCT", country: "United Kingdom — Scotland", agency: "Police Scotland non-emergency contact",
    phone: "101", purpose: "Non-emergency police reporting, including fraud. For incidents needing immediate assistance, use the local emergency service instead.",
    sourceUrl: "https://www.scotland.police.uk/contact-us/", verifiedOn,
  },
  {
    countryCode: "US", country: "United States", agency: "Federal Trade Commission",
    phone: "1 877 382 4357", purpose: "Consumer Response Center for fraud and scam reports or guidance. Does not guarantee recovery of lost money.",
    sourceUrl: "https://www.ftc.gov/about-ftc/contact", verifiedOn,
  },
];

export function findScamHotlines(query: string): ScamHotline[] {
  const list = [...SCAM_HOTLINES].sort((a, b) => a.country.localeCompare(b.country));
  const search = query.trim().toLowerCase();
  if (!search) return list;
  const aliases: Record<string, string> = { uk: "gb", usa: "us", "u.s.": "us" };
  const code = aliases[search] ?? search;
  const countryMatches = list.filter((h) => h.countryCode.toLowerCase().split("-")[0] === code);
  if (countryMatches.length) return countryMatches;
  const tokens = search.match(/[a-z]+|\d+/g) ?? [];
  if (!tokens.length) return [];
  return list.filter((h) => {
    const text = `${h.country} ${h.countryCode} ${h.agency} ${h.phone}`
      .toLowerCase().replace(/[^a-z0-9]/g, "");
    return tokens.every((token) => text.includes(token));
  });
}

/**
 * Intelligent Business Niche & Role Subtitle Detector
 * Analyzes scraped website content, meta description, brand name, and URL
 * to determine the business domain and generate a tailored, niche-accurate
 * chatbot role subtitle (e.g. "Patient Care Assistant", "Store Concierge", "Technical Specialist").
 */

interface NichePattern {
  niche: string;
  subtitle: string;
  keywords: RegExp;
}

const NICHE_PATTERNS: NichePattern[] = [
  // 1. Healthcare, Medical, Dental, Wellness
  {
    niche: 'healthcare',
    subtitle: 'Patient Care Assistant • Inquiries & Appointments',
    keywords: /\b(dental|dentist|teeth|clinic|patient|doctor|medical|hospital|therapy|mental health|pediatric|orthodont|chiropract|physiotherap|surgery|healthcare|wellness|physician|dermatolog|caregiver|pharmacy|medication)\b/i,
  },
  // 2. E-Commerce, Retail, Fashion, Online Store
  {
    niche: 'ecommerce',
    subtitle: 'Store Concierge • Orders & Instant Support',
    keywords: /\b(shop|store|cart|checkout|ecommerce|e-commerce|clothing|apparel|fashion|shoes|jewelry|perfume|boutique|delivery|shipping|catalog|products|buy now|add to cart|discount|footwear|accessories)\b/i,
  },
  // 3. Real Estate, Property, Housing, Rentals
  {
    niche: 'realestate',
    subtitle: 'Real Estate Specialist • Property & Listing Guide',
    keywords: /\b(real estate|realtor|realty|property|properties|apartments|condo|housing|rentals|mortgage|listings|commercial property|broker|villas|plots|buy home|sell home|tenants|landlord)\b/i,
  },
  // 4. Legal, Law Firms, Attorneys
  {
    niche: 'legal',
    subtitle: 'Legal Inquiries Assistant • Consultation Guide',
    keywords: /\b(attorney|lawyer|law firm|legal|litigation|counsel|personal injury|notary|justice|law practice|advocate|paralegal|solicitor|barrister|court|statute)\b/i,
  },
  // 5. Finance, Banking, Accounting, Tax, Wealth
  {
    niche: 'finance',
    subtitle: 'Financial & Advisory Specialist • Client Solutions',
    keywords: /\b(insurance|wealth management|accounting|accountant|tax|cpa|audit|investment|banking|financial|loans|fund|fintech|credit|payroll|bookkeep|brokerage|portfolio)\b/i,
  },
  // 6. Food, Dining, Restaurant, Cafe, Bakery
  {
    niche: 'restaurant',
    subtitle: 'Dining & Reservations Host • Menu Guide',
    keywords: /\b(restaurant|menu|food|cafe|coffee|dining|bakery|dishes|cuisine|order food|reservations|table booking|catering|bistro|bar & grill|pizzeria|chef|brunch)\b/i,
  },
  // 7. Education, Academies, Schools, Courses
  {
    niche: 'education',
    subtitle: 'Admissions & Course Advisor • Student Support',
    keywords: /\b(academy|school|university|college|course|curriculum|training|learning|tuition|student|admissions|campus|certification|degree|educat|bootcamp|tutor|institute)\b/i,
  },
  // 8. Travel, Tourism, Hotels, Hospitality
  {
    niche: 'travel',
    subtitle: 'Travel & Guest Concierge • Booking Support',
    keywords: /\b(hotel|resort|travel|vacation|booking|stay|tour|tourism|flight|trip|adventure|destination|hostel|inn|suites|luggage|itinerary|sightseeing|hospitality)\b/i,
  },
  // 9. SaaS, Tech, Software, Cloud, AI
  {
    niche: 'saas_tech',
    subtitle: 'Technical Product Specialist • Solutions Assistant',
    keywords: /\b(saas|software|api|cloud|devops|database|platform|automation|cybersecurity|developer|open source|analytics|sdk|infrastructure|web app|crm|erp)\b/i,
  },
  // 10. Digital Agencies, Marketing, SEO, Design
  {
    niche: 'agency',
    subtitle: 'Digital Strategy Consultant • Client Growth',
    keywords: /\b(agency|marketing|seo|branding|social media|advertising|web design|digital marketing|campaigns|creative studio|growth marketing|lead generation|copywriting|pr agency)\b/i,
  },
  // 11. Construction, Architecture, Remodeling, Home Services
  {
    niche: 'construction',
    subtitle: 'Project & Estimation Guide • Services Assistant',
    keywords: /\b(construction|architect|interior design|renovation|remodeling|plumbing|roofing|electrician|contractor|builder|handyman|flooring|carpentry|home improvement|landscaping)\b/i,
  },
  // 12. Automotive, Car Dealerships, Mechanics
  {
    niche: 'automotive',
    subtitle: 'Automotive Specialist • Vehicle & Service Guide',
    keywords: /\b(automotive|cars|vehicles|dealership|auto repair|mechanic|test drive|used cars|car rental|tires|oil change|detailing|auto body|transmission)\b/i,
  },
  // 13. Fitness, Gyms, Personal Training, Athletics
  {
    niche: 'fitness',
    subtitle: 'Fitness & Wellness Advisor • Member Support',
    keywords: /\b(fitness|gym|workout|trainer|crossfit|bodybuilding|yoga|pilates|personal training|aerobics|martial arts|sports club|nutrition|strength)\b/i,
  },
  // 14. Beauty, Salons, Spas, Aesthetics
  {
    niche: 'beauty',
    subtitle: 'Beauty & Wellness Concierge • Appointments',
    keywords: /\b(salon|spa|haircut|hairstylist|massage|skincare|facials|makeup|manicure|pedicure|esthetics|aesthetics|cosmetics|barbershop)\b/i,
  },
  // 15. Logistics, Freight, Moving & Storage
  {
    niche: 'logistics',
    subtitle: 'Logistics Coordinator • Tracking & Quotes',
    keywords: /\b(logistics|freight|cargo|shipping|moving company|movers|warehouse|storage|supply chain|courier|transportation|dispatch)\b/i,
  },
];

/**
 * Derives a tailored business role subtitle based on website content, brand name, and URL.
 */
export function deriveBusinessRoleSubtitle(
  brandName?: string,
  content?: string,
  url?: string,
  topics?: string[]
): string {
  const combined = [
    brandName || '',
    content || '',
    url || '',
    (topics || []).join(' '),
  ].join(' ').toLowerCase();

  // Test against each niche pattern
  for (const p of NICHE_PATTERNS) {
    if (p.keywords.test(combined)) {
      return p.subtitle;
    }
  }

  // If brand name is available, generate a clean professional identity
  const cleanBrand = (brandName || '').replace(/Assistant|Bot|AI|Website/gi, '').trim();
  if (cleanBrand && cleanBrand.length > 2) {
    return `${cleanBrand} Specialist • Verified Assistant`;
  }

  return 'Official AI Assistant • Verified Support';
}

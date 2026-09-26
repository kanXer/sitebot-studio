/**
 * Intelligent Business Niche & Role Subtitle Detector
 * Analyzes scraped website content, meta description, brand name, and URL
 * to determine the business domain and generate a tailored, niche-accurate
 * chatbot role subtitle (e.g. "Patient Care Assistant", "Store Concierge", "Technical Specialist").
 *
 * Detection is SCORED, not first-match-wins.
 *
 * The previous implementation returned the subtitle of the first niche whose
 * regex happened to match, in a hardcoded order with healthcare at the top. Any
 * site that merely mentioned a client industry (a digital marketing agency
 * listing "healthcare" among the sectors it serves) was therefore labelled
 * "Patient Care Assistant" even when "digital marketing" appeared many times.
 * Now every niche is scored across every field and the strongest signal wins.
 */

interface NichePattern {
  niche: string;
  subtitle: string;
  /** Unambiguous terms. Worth 3 points per hit. */
  strong: string[];
  /** Common/ambiguous terms. Worth 1 point per hit. */
  weak: string[];
}

const NICHE_PATTERNS: NichePattern[] = [
  // 1. Digital Marketing, Agencies, SEO, Ads  (listed first: it is the most
  //    commonly mis-detected niche because agency sites describe many industries)
  {
    niche: 'digital_marketing',
    subtitle: 'Digital Marketing Assistant • Growth & Campaign Guide',
    strong: [
      'digital marketing',
      'marketing agency',
      'digital agency',
      'creative agency',
      'advertising agency',
      'branding agency',
      'performance marketing',
      'search engine optimization',
      'social media marketing',
      'content marketing',
      'email marketing',
      'marketing strategy',
      'google ads',
      'facebook ads',
      'meta ads',
      'lead generation',
      'media buying',
      'keyword research',
      'technical seo',
      'on page seo',
      'local seo',
      'google analytics',
      'search ranking',
      'search rankings',
      'conversion rate',
      'cost per click',
      'return on ad spend',
      'influencer marketing',
      'web design',
      'website design',
      'landing page',
      'landing pages',
    ],
    weak: [
      'seo',
      'ppc',
      'cpc',
      'roas',
      'ads',
      'adwords',
      'analytics',
      'campaign',
      'campaigns',
      'marketing',
      'advertising',
      'social media',
      'branding',
      'audience',
      'engagement',
      'impressions',
      'reach',
      'traffic',
      'conversion',
      'conversions',
      'funnel',
      'copywriting',
      'creatives',
      'targeting',
      'organic',
      'keywords',
      'influencer',
      'strategy',
      'google business profile',
    ],
  },
  // 2. Healthcare, Medical, Dental, Wellness
  {
    niche: 'healthcare',
    subtitle: 'Patient Care Assistant • Inquiries & Appointments',
    strong: [
      'dental clinic',
      'dental care',
      'dentist',
      'dentistry',
      'orthodontic',
      'orthodontics',
      'dermatology',
      'dermatologist',
      'patient portal',
      'medical clinic',
      'health clinic',
      'clinic',
      'hospital',
      'physician',
      'pediatric',
      'pediatrics',
      'psychiatrist',
      'psychiatry',
      'therapist',
      'pharmacy',
      'oncology',
      'cardiology',
      'neurology',
      'gynecology',
      'optometry',
      'optometrist',
      'veterinary',
      'emergency room',
      'ambulance',
      'emergency medical',
      'hospice',
      'midwife',
      'sonography',
    ],
    weak: [
      'patient',
      'patients',
      'clinical',
      'clinics',
      'medical',
      'medicine',
      'health',
      'healthcare',
      'wellness',
      'therapy',
      'therapies',
      'surgery',
      'surgeries',
      'diagnosis',
      'symptoms',
      'prescription',
      'medication',
      'medications',
      'appointment',
      'appointments',
      'care',
      'doctor',
      'doctors',
      'nurse',
      'nurses',
      'vaccination',
      'vaccine',
      'screening',
      'chronic',
      'rehabilitation',
      'physiotherapy',
      'chiropractic',
      'neurologist',
      'cardiologist',
    ],
  },
  // 3. E-Commerce, Retail, Fashion, Online Store
  {
    niche: 'ecommerce',
    subtitle: 'Store Concierge • Orders & Instant Support',
    strong: [
      'add to cart',
      'shopping cart',
      'checkout',
      'ecommerce',
      'e-commerce',
      'online store',
      'shopify',
      'woocommerce',
      'product page',
      'buy now',
      'free shipping',
      'in stock',
      'out of stock',
      'size guide',
      'size chart',
      'wishlist',
      'my orders',
      'track order',
      'track your order',
      'cash on delivery',
      'return policy',
    ],
    weak: [
      'shop',
      'store',
      'cart',
      'products',
      'orders',
      'order',
      'delivery',
      'shipping',
      'clothing',
      'apparel',
      'fashion',
      'shoes',
      'footwear',
      'jewelry',
      'jewellery',
      'perfume',
      'boutique',
      'accessories',
      'discount',
      'discounts',
      'sale',
      'catalog',
      'catalogue',
      'collections',
      'variants',
      'cartoon',
    ],
  },
  // 4. Real Estate, Property, Housing, Rentals
  {
    niche: 'realestate',
    subtitle: 'Real Estate Specialist • Property & Listing Guide',
    strong: [
      'real estate',
      'realtor',
      'realtors',
      'realty',
      'mortgage',
      'rentals',
      'leasing',
      'property management',
      'buying a home',
      'selling a home',
      'first time buyer',
      'floor plan',
      'square feet',
      'bedroom',
      'apartments for sale',
      'apartments for rent',
    ],
    weak: [
      'property',
      'properties',
      'apartment',
      'apartments',
      'condo',
      'condominium',
      'housing',
      'listings',
      'listing',
      'broker',
      'brokerage',
      'villas',
      'plots',
      'landlord',
      'tenant',
      'tenants',
      'rent',
      'lease',
      'commercial property',
    ],
  },
  // 5. Legal, Law Firms, Attorneys
  {
    niche: 'legal',
    subtitle: 'Legal Inquiries Assistant • Consultation Guide',
    strong: [
      'law firm',
      'law office',
      'legal services',
      'legal consultation',
      'attorney',
      'attorneys',
      'lawyer',
      'lawyers',
      'litigation',
      'personal injury',
      'law practice',
      'legal advice',
      'barrister',
      'paralegal',
      'solicitor',
      'power of attorney',
      'divorce lawyer',
      'immigration lawyer',
    ],
    weak: [
      'legal',
      'counsel',
      'notary',
      'justice',
      'advocate',
      'statute',
      'court',
      'courtroom',
      'lawsuit',
      'testimony',
      'deposition',
      'case law',
      'consultation',
      'representation',
    ],
  },
  // 6. Finance, Banking, Accounting, Tax, Wealth
  {
    niche: 'finance',
    subtitle: 'Financial & Advisory Specialist • Client Solutions',
    strong: [
      'wealth management',
      'accounting services',
      'tax preparation',
      'tax filing',
      'tax return',
      'financial planning',
      'investment planning',
      'retirement planning',
      'loan application',
      'credit repair',
      'insurance broker',
      'insurance agency',
      'cpa firm',
      'bookkeeping services',
    ],
    weak: [
      'insurance',
      'accounting',
      'accountant',
      'accountants',
      'tax',
      'cpa',
      'audit',
      'investment',
      'investments',
      'banking',
      'financial',
      'finance',
      'loans',
      'loan',
      'mortgage lender',
      'fintech',
      'credit',
      'payroll',
      'bookkeeping',
      'brokerage',
      'portfolio',
      'savings',
    ],
  },
  // 7. Food, Dining, Restaurant, Cafe, Bakery
  {
    niche: 'restaurant',
    subtitle: 'Dining & Reservations Host • Menu Guide',
    strong: [
      'restaurant',
      'restaurants',
      'menu',
      'our menu',
      'cafe',
      'coffee shop',
      'bakery',
      'pizzeria',
      'bistro',
      'bar and grill',
      'table booking',
      'book a table',
      'reservation',
      'reservations',
      'fine dining',
      'takeaway',
      'dine in',
      'chef',
    ],
    weak: [
      'food',
      'dining',
      'dishes',
      'cuisine',
      'brunch',
      'breakfast',
      'lunch',
      'dinner',
      'beverages',
      'cocktails',
      'catering',
      'delivery',
      'chef',
    ],
  },
  // 8. Education, Academies, Schools, Courses
  {
    niche: 'education',
    subtitle: 'Admissions & Course Advisor • Student Support',
    strong: [
      'academy',
      'school',
      'university',
      'college',
      'curriculum',
      'tuition fees',
      'admissions',
      'campus',
      'certification course',
      'degree program',
      'bootcamp',
      'training institute',
      'skill development',
      'e learning',
      'online courses',
    ],
    weak: [
      'course',
      'courses',
      'training',
      'learning',
      'students',
      'student',
      'certification',
      'degree',
      'degree',
      'tutor',
      'tutoring',
      'institute',
      'faculty',
      'syllabus',
      'educat',
      'classroom',
    ],
  },
  // 9. Travel, Tourism, Hotels, Hospitality
  {
    niche: 'travel',
    subtitle: 'Travel & Guest Concierge • Booking Support',
    strong: [
      'hotel',
      'hotels',
      'resort',
      'hostel',
      'guest house',
      'guesthouse',
      'travel agency',
      'travel package',
      'tour package',
      'flight booking',
      'flight tickets',
      'hotel booking',
      'room booking',
      'airport transfer',
      'tour itinerary',
      'sightseeing',
      'luggage',
    ],
    weak: [
      'travel',
      'tourism',
      'tourist',
      'vacation',
      'booking',
      'bookings',
      'stay',
      'trip',
      'tours',
      'adventure',
      'destination',
      'itinerary',
      'suites',
      'hospitality',
      'holiday',
      'holidays',
    ],
  },
  // 10. SaaS, Tech, Software, Cloud, AI
  {
    niche: 'saas_tech',
    subtitle: 'Technical Product Specialist • Solutions Assistant',
    strong: [
      'saas',
      'software as a service',
      'api',
      'apis',
      'cloud',
      'devops',
      'database',
      'cybersecurity',
      'open source',
      'sdk',
      'infrastructure',
      'web app',
      'web application',
      'crm',
      'erp',
      'machine learning',
      'artificial intelligence',
      'integration',
      'integrations',
      'developer',
      'technical support',
      'bug fix',
    ],
    weak: [
      'software',
      'platform',
      'automation',
      'analytics',
      'data',
      'server',
      'hosting',
      'security',
      'network',
      'users',
      'dashboard',
      'app',
      'product',
    ],
  },
  // 11. Construction, Architecture, Remodeling, Home Services
  {
    niche: 'construction',
    subtitle: 'Project & Estimation Guide • Services Assistant',
    strong: [
      'construction company',
      'general contractor',
      'architecture firm',
      'interior design',
      'renovation',
      'remodeling',
      'roofing',
      'plumbing',
      'electrician',
      'hvac',
      'home improvement',
      'home services',
      'flooring',
      'carpentry',
      'landscaping',
      'building permit',
    ],
    weak: [
      'construction',
      'architect',
      'architects',
      'contractor',
      'builder',
      'handyman',
      'remodel',
      'estimate',
      'estimates',
      'quotation',
      'blueprint',
      'renovation',
    ],
  },
  // 12. Automotive, Car Dealerships, Mechanics
  {
    niche: 'automotive',
    subtitle: 'Automotive Specialist • Vehicle & Service Guide',
    strong: [
      'car dealership',
      'auto dealership',
      'car dealer',
      'used cars',
      'new cars',
      'test drive',
      'auto repair',
      'car repair',
      'mechanic',
      'car service',
      'auto body',
      'oil change',
      'tyre',
      'tires',
      'transmission',
      'car detailing',
    ],
    weak: [
      'automotive',
      'cars',
      'car',
      'vehicles',
      'vehicle',
      'dealer',
      'motor',
      'engine',
      'brakes',
      'suspension',
      'driving',
    ],
  },
  // 13. Fitness, Gyms, Personal Training, Athletics
  {
    niche: 'fitness',
    subtitle: 'Fitness & Wellness Advisor • Member Support',
    strong: [
      'gym',
      'gymnasium',
      'fitness studio',
      'personal training',
      'crossfit',
      'bodybuilding',
      'weight training',
      'strength training',
      'pilates',
      'yoga studio',
      'martial arts',
      'sports club',
      'membership plans',
      'personal trainer',
    ],
    weak: [
      'fitness',
      'workout',
      'workouts',
      'trainer',
      'yoga',
      'aerobics',
      'nutrition',
      'diet plan',
      'gym',
      'training',
      'mobility',
      'strength',
    ],
  },
  // 14. Beauty, Salons, Spas, Aesthetics
  {
    niche: 'beauty',
    subtitle: 'Beauty & Wellness Concierge • Appointments',
    strong: [
      'salon',
      'spa',
      'hair salon',
      'beauty salon',
      'barbershop',
      'barber',
      'haircut',
      'hairstylist',
      'hair styling',
      'skincare',
      'skin care',
      'facial',
      'facials',
      'makeup',
      'manicure',
      'pedicure',
      'massage',
      'aesthetics',
      'esthetics',
      'cosmetics',
      'nail salon',
    ],
    weak: [
      'beauty',
      'spa',
      'salon',
      'treatment',
      'treatments',
      'glow',
      'bridal makeup',
      'grooming',
    ],
  },
  // 15. Logistics, Freight, Moving & Storage
  {
    niche: 'logistics',
    subtitle: 'Logistics Coordinator • Tracking & Quotes',
    strong: [
      'logistics company',
      'freight forwarding',
      'supply chain',
      'moving company',
      'moving services',
      'warehousing',
      'cold storage',
      'courier service',
      'last mile delivery',
      'fleet management',
      'cargo insurance',
      'customs clearance',
    ],
    weak: [
      'logistics',
      'freight',
      'cargo',
      'shipping',
      'movers',
      'warehouse',
      'storage',
      'courier',
      'transportation',
      'dispatch',
      'tracking',
      'delivery',
    ],
  },
];

/** Per-occurrence caps so a single repeated word cannot dominate the score. */
const STRONG_CAP = 3;
const WEAK_CAP = 2;

/** Relative importance of each field. */
const BRAND_WEIGHT = 3;
const URL_WEIGHT = 2;
const TOPIC_WEIGHT = 2;
const CONTENT_WEIGHT = 1;

const STRONG_POINTS = 3;
const WEAK_POINTS = 1;

/** Below this the signal is too weak to trust, so we fall back to brand naming. */
const MIN_SCORE = 4;

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Counts how many of `terms` appear in `haystack`, counting each term up to
 * `cap` times. Word-boundary aware so "app" does not match "apple" and
 * "care" does not match "career".
 */
function countTermHits(haystack: string, terms: string[], cap: number): number {
  if (!haystack) return 0;
  let total = 0;
  for (const term of terms) {
    const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegExp(term)}([^a-z0-9]|$)`, 'g');
    const matches = haystack.match(pattern);
    if (matches && matches.length > 0) {
      total += Math.min(matches.length, cap);
    }
  }
  return total;
}

function scoreNiche(pattern: NichePattern, brand: string, content: string, url: string, topics: string) {
  const fields: Array<[string, number]> = [
    [brand, BRAND_WEIGHT],
    [url, URL_WEIGHT],
    [topics, TOPIC_WEIGHT],
    [content, CONTENT_WEIGHT],
  ];

  let strongHits = 0;
  let weakHits = 0;

  for (const [value, weight] of fields) {
    if (!value) continue;
    strongHits += countTermHits(value, pattern.strong, STRONG_CAP);
    weakHits += countTermHits(value, pattern.weak, WEAK_CAP);
  }

  return strongHits * STRONG_POINTS + weakHits * WEAK_POINTS;
}

export interface NicheDetectionResult {
  niche: string;
  subtitle: string;
  score: number;
  runnerUp: string;
  runnerUpScore: number;
  /** True when no niche scored above the trust threshold. */
  isFallback: boolean;
}

/**
 * Full niche detection with diagnostics. Prefer this when you want to know
 * *why* a role title was chosen (logging, admin UI, debugging mislabels).
 */
export function detectBusinessNiche(
  brandName?: string,
  content?: string,
  url?: string,
  topics?: string[]
): NicheDetectionResult {
  const brand = (brandName || '').toLowerCase();
  const body = (content || '').toLowerCase();
  const site = (url || '').toLowerCase();
  const topicText = (topics || []).join(' ').toLowerCase();

  const scored = NICHE_PATTERNS.map((pattern) => ({
    pattern,
    score: scoreNiche(pattern, brand, body, site, topicText),
  })).sort((a, b) => b.score - a.score);

  const best = scored[0];
  const second = scored[1];

  if (best && best.score >= MIN_SCORE) {
    return {
      niche: best.pattern.niche,
      subtitle: best.pattern.subtitle,
      score: best.score,
      runnerUp: second?.pattern.niche || '',
      runnerUpScore: second?.score || 0,
      isFallback: false,
    };
  }

  return {
    niche: 'general',
    subtitle: buildBrandFallbackSubtitle(brandName),
    score: best?.score || 0,
    runnerUp: second?.pattern.niche || '',
    runnerUpScore: second?.score || 0,
    isFallback: true,
  };
}

/**
 * Derives a tailored business role subtitle based on website content, brand
 * name, and URL.
 */
export function deriveBusinessRoleSubtitle(
  brandName?: string,
  content?: string,
  url?: string,
  topics?: string[]
): string {
  return detectBusinessNiche(brandName, content, url, topics).subtitle;
}

function buildBrandFallbackSubtitle(brandName?: string): string {
  // If brand name is available, generate a clean professional identity
  const cleanBrand = (brandName || '').replace(/Assistant|Bot|AI|Website/gi, '').trim();
  if (cleanBrand && cleanBrand.length > 2) {
    return `${cleanBrand} Specialist • Verified Assistant`;
  }

  return 'Official AI Assistant • Verified Support';
}

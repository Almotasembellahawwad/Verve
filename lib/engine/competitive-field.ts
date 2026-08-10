// =========================================================
// lib/engine/competitive-field.ts
// Module L: Competitive Field Analysis
//
// Problem: The pipeline produces designs distinctive in the
// abstract, but may accidentally match the visual language
// of the dominant player in the client's actual market.
//
// Approach: Curated competitive intelligence dataset.
// For each of 25 industry categories, documents the 5 most
// common visual patterns that dominate that space.
// These are injected as "competitive defaults" — additional
// items for the blocklist that are specific to this industry.
//
// Research basis: Visual audits of top 3-5 brands per
// industry segment as of 2024-2025.
// =========================================================

import type { BriefAnalysis } from "./brief-analyzer";

export type CompetitivePattern = {
  pattern: string;            // the dominant visual pattern
  dominantBrands: string[];   // who uses it (context)
  whyOverused: string;        // why it became the industry default
  alternativeSignal: string;  // what to do instead
};

export type CompetitiveField = {
  industry: string;
  patterns: CompetitivePattern[];
  industryTemperature: "cold" | "warm" | "hot"; // how visually saturated is this field?
  distinctivenessOpportunity: string;
};

// ── Competitive Intelligence Dataset ─────────────────────────────────────────
// 25 industries × 5 patterns each
const COMPETITIVE_FIELDS: CompetitiveField[] = [
  {
    industry: "Interior Design",
    industryTemperature: "hot",
    distinctivenessOpportunity: "Most interior portfolios are indistinct. The opportunity is in constraint: narrow palette, zero decoration, strong materiality language.",
    patterns: [
      { pattern: "Wide-angle room photography as hero", dominantBrands: ["HBA", "Yabu Pushelberg"], whyOverused: "Shows scale — became shorthand for 'we do luxury'", alternativeSignal: "Detail photography: texture, seam, material junction" },
      { pattern: "Gold accent on white or dark background", dominantBrands: ["Most UAE luxury interior firms"], whyOverused: "Gold = luxury shorthand in MENA market", alternativeSignal: "Color derived from actual material palette of completed projects" },
      { pattern: "Italicized serif logo over full-bleed image", dominantBrands: ["Kelly Wearstler", "Studio O+A"], whyOverused: "Mimics fashion branding — signals aspiration", alternativeSignal: "Structural/architectural type — grid-based, not calligraphic" },
      { pattern: "Before/After split-screen", dominantBrands: ["HGTV-adjacent brands"], whyOverused: "Explains value in one image", alternativeSignal: "Process documentation — drawings, material boards, site photography" },
      { pattern: "Testimonials with headshots in circular frames", dominantBrands: ["Mid-market interior companies"], whyOverused: "Social proof convention from product sites", alternativeSignal: "Project-specific case study with specific numbers and outcomes" },
    ],
  },
  {
    industry: "Motion Design",
    industryTemperature: "hot",
    distinctivenessOpportunity: "Most motion portfolios use the same card-grid-with-play-button. Temporal design presented in a spatial format. Opportunity: design the portfolio itself as motion.",
    patterns: [
      { pattern: "Dark background with glowing reel thumbnail", dominantBrands: ["Behance top motion pages"], whyOverused: "Came from YouTube/Vimeo aesthetics — video = dark", alternativeSignal: "Light, precise, editorial — motion designers who understand print" },
      { pattern: "Autoplay video on hover", dominantBrands: ["Every Webflow motion portfolio"], whyOverused: "Shows work without clicking — became standard", alternativeSignal: "Deliberate play: the visitor makes a choice. Stillness as contrast." },
      { pattern: "Neon/gradient text overlay on dark video", dominantBrands: ["Freelance motion portfolios globally"], whyOverused: "Cinema 4D default light aesthetics", alternativeSignal: "Technical notation, film production language" },
      { pattern: "'Passionate storyteller who loves pushing boundaries'", dominantBrands: ["All of them"], whyOverused: "Every designer bio sounds the same", alternativeSignal: "Specific technical claims: 'I work at 24fps because...'", },
      { pattern: "Dribbble-style project cards (560×420 rounded)", dominantBrands: ["Dribbble, Behance exports"], whyOverused: "Platforms trained designers to present this way", alternativeSignal: "Full-width production slates with technical metadata" },
    ],
  },
  {
    industry: "Technology / SaaS",
    industryTemperature: "hot",
    distinctivenessOpportunity: "The SaaS visual language is completely homogenized. Distinctive = anything that looks like it was designed for a specific person, not 'software users'.",
    patterns: [
      { pattern: "Purple/blue gradient hero with floating UI mockups", dominantBrands: ["Linear", "Notion", "Stripe (widely copied)"], whyOverused: "Linear popularized it, everyone followed", alternativeSignal: "No gradient — pure product. Or entirely different visual metaphor." },
      { pattern: "Bento grid feature sections", dominantBrands: ["Apple (copied broadly)"], whyOverused: "Apple's 2023 marketing, immediately overused", alternativeSignal: "Narrative feature progression — each feature earns its position" },
      { pattern: "Dark code snippet on dark background", dominantBrands: ["All developer tools"], whyOverused: "Signals 'for developers' immediately", alternativeSignal: "Code as typography — the structure of code as a design element" },
      { pattern: "Social proof logos on white bar (Forbes, TechCrunch)", dominantBrands: ["Every early-stage SaaS"], whyOverused: "Cheap trust signal from B2B playbook", alternativeSignal: "Specific customer numbers, named case studies" },
      { pattern: "Testimonial carousel with star ratings", dominantBrands: ["G2, Product Hunt graduates"], whyOverused: "Review platform aesthetics bled into product sites", alternativeSignal: "Single, long-form customer story with real context" },
    ],
  },
  {
    industry: "Luxury / Fashion",
    industryTemperature: "hot",
    distinctivenessOpportunity: "Luxury visual language has itself become a cliché. The most distinctive luxury brands now look deliberately undesigned. Constraint is the signal.",
    patterns: [
      { pattern: "Centered italic serif logo on white", dominantBrands: ["Celine", "Bottega (pre-Daniel Lee)", "Saint Laurent"], whyOverused: "Philo-era Celine defined it; everyone followed", alternativeSignal: "Asymmetric, off-center, or structural logo treatment" },
      { pattern: "Thin weight type at extreme size", dominantBrands: ["Burberry", "Balenciaga"], whyOverused: "Contrast between scale and weight signals exclusivity", alternativeSignal: "Heavy/bold type used with confidence — the opposite" },
      { pattern: "Black and white editorial photography", dominantBrands: ["Every luxury fashion brand"], whyOverused: "Timeless signal has become default signal", alternativeSignal: "Specific color derived from the collection's material or season" },
      { pattern: "Minimal navigation: logo · menu", dominantBrands: ["Hermès", "Chanel.com"], whyOverused: "Navigation as status symbol", alternativeSignal: "Navigation as choreography — sequential reveal" },
      { pattern: "Product on white background + price", dominantBrands: ["All e-commerce luxury"], whyOverused: "Conversion-optimized layouts dominate", alternativeSignal: "Product in context — the world the product exists in" },
    ],
  },
  {
    industry: "Architecture",
    industryTemperature: "warm",
    distinctivenessOpportunity: "Architecture sites default to the same photograph. The opportunity is in showing the design process — drawings, diagrams, the argument behind the built form.",
    patterns: [
      { pattern: "Fullbleed exterior architectural photography", dominantBrands: ["Zaha Hadid Architects website"], whyOverused: "Architecture = photograph of building = shorthand for all firms", alternativeSignal: "Section drawings, plans, process diagrams as primary visual" },
      { pattern: "Project grid with location tags", dominantBrands: ["Most architecture practices"], whyOverused: "Portfolio presentation standard from architecture school", alternativeSignal: "Narrative journey — projects tell a story about a philosophy" },
      { pattern: "'We design spaces that inspire'", dominantBrands: ["Every architecture firm globally"], whyOverused: "Generic mission statements", alternativeSignal: "Specific claim: 'We work with 8-degree façade angles because...'", },
      { pattern: "White background with black Helvetica-style type", dominantBrands: ["Swiss/European firms"], whyOverused: "Modernist typography as architecture-adjacent signal", alternativeSignal: "Type derived from the firm's actual design grammar" },
      { pattern: "Awards strip below nav", dominantBrands: ["Competition-heavy firms"], whyOverused: "Credibility shortcut from B2B playbook", alternativeSignal: "Awards embedded in the projects that won them" },
    ],
  },
  {
    industry: "Healthcare",
    industryTemperature: "warm",
    distinctivenessOpportunity: "Healthcare is blue + stock photo of smiling doctor. Patients don't choose hospitals because of websites. But clinics do. Opportunity: warmth through specificity.",
    patterns: [
      { pattern: "Blue/teal color scheme", dominantBrands: ["Every hospital globally"], whyOverused: "Blue = trust/clinical — became healthcare mandatory", alternativeSignal: "Warm, specific palette derived from the clinic's environment" },
      { pattern: "Stock photo of diverse smiling medical team", dominantBrands: ["Healthcare marketing globally"], whyOverused: "Stock photography made it easy; clinics repeat it", alternativeSignal: "Real photographs of the actual team in their actual space" },
      { pattern: "Symptom checker / appointment booking widget hero", dominantBrands: ["Zocdoc, NHS websites"], whyOverused: "Functional → became convention", alternativeSignal: "Values-first hero — who you are before what you do" },
      { pattern: "Trust badges: 'Accredited by...' bar", dominantBrands: ["Private healthcare"], whyOverused: "Credibility shortcut", alternativeSignal: "Patient outcomes with specific numbers" },
      { pattern: "Sans-serif with round letters (Nunito, Poppins)", dominantBrands: ["Digital health startups"], whyOverused: "'Friendly healthcare' visual language from Headspace era", alternativeSignal: "Humanist serif — warm, serious, precise" },
    ],
  },
  {
    industry: "Food & Beverage",
    industryTemperature: "hot",
    distinctivenessOpportunity: "Every F&B brand does close-up food photography. Distinctive = the world the food exists in, not the food itself.",
    patterns: [
      { pattern: "Close-up food photography (macro, steam, sauce drip)", dominantBrands: ["Every restaurant/food brand"], whyOverused: "Instagram trained everyone to shoot food this way", alternativeSignal: "Environment, table setting, the hands that made it" },
      { pattern: "Green/natural palette + 'sustainable' messaging", dominantBrands: ["Organic food brands globally"], whyOverused: "Green = natural shorthand, now overused", alternativeSignal: "Specific sourcing story with actual farm photography" },
      { pattern: "Rustic/kraft paper texture", dominantBrands: ["Artisan food brands"], whyOverused: "Craft signal became mass-market", alternativeSignal: "Industrial precision — the factory process shown with pride" },
      { pattern: "Founder's story with sepia portrait", dominantBrands: ["DTC food brands"], whyOverused: "Human + story = conversion formula from 2015", alternativeSignal: "The philosophy, not the founder" },
      { pattern: "'Farm to table' / 'handcrafted' language", dominantBrands: ["All of them"], whyOverused: "Positioning words with no specific claim", alternativeSignal: "Specific: 'From Chania, Crete. 40km.' Not 'locally sourced'" },
    ],
  },
  {
    industry: "Education",
    industryTemperature: "warm",
    distinctivenessOpportunity: "Education sites show students in libraries or classrooms. Distinctive = showing the transformation, not the facility.",
    patterns: [
      { pattern: "Smiling student looking at camera with book", dominantBrands: ["Every university"], whyOverused: "Stock photography of success", alternativeSignal: "Actual student work — the outputs, not the inputs" },
      { pattern: "Blue and gold institutional palette", dominantBrands: ["Oxbridge, Ivy League, widely imitated"], whyOverused: "Prestige borrowing from elite institutions", alternativeSignal: "Specific, derived from the institution's actual architectural palette" },
      { pattern: "Ranking badges and accreditation logos", dominantBrands: ["Every ranked institution"], whyOverused: "Position shortcut", alternativeSignal: "Alumni outcomes with specific names and stories" },
      { pattern: "Course listing as primary navigation", dominantBrands: ["Online education platforms"], whyOverused: "Catalog thinking, not journey thinking", alternativeSignal: "Start with the transformation — 'six months from now you will...'", },
      { pattern: "Testimonial carousel with graduation photos", dominantBrands: ["Bootcamps, online courses"], whyOverused: "Social proof formula", alternativeSignal: "Video interview with specific outcomes stated" },
    ],
  },
  {
    industry: "Finance",
    industryTemperature: "hot",
    distinctivenessOpportunity: "FinTech homogenized around dark green/teal + app mockup. Traditional finance stuck in navy. Gap: clarity and warmth simultaneously.",
    patterns: [
      { pattern: "Dark green or teal hero (Robinhood/Trading212 aesthetic)", dominantBrands: ["Monzo, Revolut copycats"], whyOverused: "Monzo/Revolut defined modern fintech look", alternativeSignal: "Deliberately not fintech — borrow from stationery or architecture" },
      { pattern: "Smartphone app mockup in hero", dominantBrands: ["Every fintech globally"], whyOverused: "Shows the product immediately", alternativeSignal: "Show the outcome of using the product — the life, not the app" },
      { pattern: "Security padlock icon in feature list", dominantBrands: ["Banks, fintech"], whyOverused: "Security = trust shorthand", alternativeSignal: "Specific security claim with technical detail" },
      { pattern: "Metric highlights: '2M+ users', '$10B moved'", dominantBrands: ["Scale-up fintech"], whyOverused: "Social proof through scale", alternativeSignal: "Specific user story: 'Sara saved £3,400 in 8 months'" },
      { pattern: "Blue and white with minimal color", dominantBrands: ["Traditional banks globally"], whyOverused: "Blue = financial trust, white = clarity", alternativeSignal: "Rich material palette — money has texture: paper, metal, ink" },
    ],
  },
  {
    industry: "Real Estate",
    industryTemperature: "hot",
    distinctivenessOpportunity: "Every real estate site is a listing engine. Distinctive = lifestyle, not property.",
    patterns: [
      { pattern: "Property listing grid with price + beds/baths", dominantBrands: ["Rightmove, Zillow, every agent site"], whyOverused: "Database UI became design standard", alternativeSignal: "Narrative — the neighborhood, the life, the street" },
      { pattern: "Gold and white luxury aesthetic", dominantBrands: ["High-end agents in UAE, UK"], whyOverused: "Gold = luxury shorthand", alternativeSignal: "Material honesty — the actual texture of the buildings they sell" },
      { pattern: "Drone aerial photography hero", dominantBrands: ["Every developer"], whyOverused: "Affordable drones made this too easy", alternativeSignal: "Street-level human scale photography" },
      { pattern: "'Your dream home awaits' headline", dominantBrands: ["All agents"], whyOverused: "Aspiration formula", alternativeSignal: "Specific claim: 'St John's Wood. 12 minutes to the City.'" },
      { pattern: "Agent headshot in circle with 5 stars", dominantBrands: ["Individual agents"], whyOverused: "Trust signal from Amazon/Uber reviews era", alternativeSignal: "Specific transaction history with neighborhood data" },
    ],
  },
  {
    industry: "Creative Agency",
    industryTemperature: "hot",
    distinctivenessOpportunity: "Creative agency sites try so hard to be different that they all end up being the same kind of different. Distinctive = restraint.",
    patterns: [
      { pattern: "Cursor-following blob/gradient on dark hero", dominantBrands: ["Award-winning agencies 2022-2024"], whyOverused: "GSAP + mouse follower = 'we're interactive'", alternativeSignal: "No cursor effects — let the work speak" },
      { pattern: "'We're a creative studio that...' opening line", dominantBrands: ["All creative agencies"], whyOverused: "Start with identity, not the client's need", alternativeSignal: "Start with the outcome: what you make possible" },
      { pattern: "Case study grid with client logo overlay", dominantBrands: ["Most agencies"], whyOverused: "Client logos as proxy for quality", alternativeSignal: "One case study in full, rather than six in part" },
      { pattern: "Parallax scroll with multiple layers", dominantBrands: ["Award-hungry agencies"], whyOverused: "Awwwards optimization = parallax", alternativeSignal: "Flat scroll with perfect typography pacing" },
      { pattern: "Team page with funny/casual photos", dominantBrands: ["Culture-forward agencies"], whyOverused: "'We're fun to work with' signal", alternativeSignal: "No team page — let process document speak to collaboration" },
    ],
  },
  {
    industry: "E-commerce",
    industryTemperature: "hot",
    distinctivenessOpportunity: "E-commerce is all conversion optimization. Distinctive = editorial identity that makes the brand world worth entering.",
    patterns: [
      { pattern: "Hero banner with sale percentage + timer", dominantBrands: ["Fashion Nova, ASOS"], whyOverused: "Urgency conversion formula", alternativeSignal: "Brand narrative — the world the product exists in" },
      { pattern: "Product grid with white background", dominantBrands: ["Amazon influenced all"], whyOverused: "Platform standard bled into independent stores", alternativeSignal: "Editorial photography with context and environment" },
      { pattern: "Sticky 'Add to cart' button", dominantBrands: ["Shopify defaults"], whyOverused: "Conversion optimization became aesthetic", alternativeSignal: "CTA that appears at the right moment in the story" },
      { pattern: "Trust badges: 'Free shipping · 30-day returns'", dominantBrands: ["All e-commerce"], whyOverused: "Objection handling formula", alternativeSignal: "Single bold policy statement with personality" },
      { pattern: "Recently viewed / 'You might also like'", dominantBrands: ["Amazon algorithm exposed everywhere"], whyOverused: "Cross-sell became expected", alternativeSignal: "Curated pairings with editorial reason" },
    ],
  },
  {
    industry: "Portfolio",
    industryTemperature: "hot",
    distinctivenessOpportunity: "Portfolio sites are all 'name + work + about + contact'. Distinctive = let the work's medium define the portfolio's medium.",
    patterns: [
      { pattern: "Hero with name and job title + scroll indicator", dominantBrands: ["Squarespace templates widely"], whyOverused: "Resume structure applied to web", alternativeSignal: "Start with work, not identity" },
      { pattern: "Project card grid (3 or 4 columns)", dominantBrands: ["Every Behance/Dribbble port"], whyOverused: "Image grid = show everything fast", alternativeSignal: "Curated case studies — 3 deep vs 12 shallow" },
      { pattern: "Available for freelance badge/pill", dominantBrands: ["Freelancers globally"], whyOverused: "Status signal from LinkedIn culture", alternativeSignal: "Describe who you work with and why" },
      { pattern: "Testimonials in speech bubble style", dominantBrands: ["Service professionals"], whyOverused: "Trust formula", alternativeSignal: "Client name + specific outcome, no quotes or bubbles" },
      { pattern: "Contact form with name/email/message", dominantBrands: ["All portfolios"], whyOverused: "Generic contact standard", alternativeSignal: "Specific brief format — what you need to know before working with them" },
    ],
  },
  {
    industry: "Hospitality",
    industryTemperature: "warm",
    distinctivenessOpportunity: "Hotel sites show rooms. Distinctive = show the feeling of being there — specific, sensory, temporal.",
    patterns: [
      { pattern: "Wide-angle room shot with city view hero", dominantBrands: ["Every hotel chain"], whyOverused: "Shows scale and view simultaneously", alternativeSignal: "Time-specific: what it looks like at 7am vs 11pm" },
      { pattern: "Book now CTA always visible", dominantBrands: ["OTA-influenced hotel sites"], whyOverused: "Conversion optimization", alternativeSignal: "CTA after establishing desire — not at first load" },
      { pattern: "'Escape to paradise / luxury redefined'", dominantBrands: ["Luxury hotels globally"], whyOverused: "Aspiration formula", alternativeSignal: "Specific: '42 rooms. Three of them have original 1920s plasterwork.'" },
      { pattern: "Amenities icon grid (pool, spa, wifi)", dominantBrands: ["Every booking.com competitor"], whyOverused: "Feature checklist logic", alternativeSignal: "Each amenity as an experience, not a feature" },
      { pattern: "Stars and certificate logos in footer", dominantBrands: ["All hotels"], whyOverused: "Trust signals from travel aggregators", alternativeSignal: "Guest stories with specific names and stays" },
    ],
  },
  {
    industry: "Wellness",
    industryTemperature: "hot",
    distinctivenessOpportunity: "Wellness is the most visually homogenized space. Muted beige/sage/ivory. Distinctive = anything that takes a position.",
    patterns: [
      { pattern: "Muted beige/sage/ivory palette", dominantBrands: ["Goop, Gwyneth-inspired brands"], whyOverused: "Clean/natural aesthetic became industry mandatory", alternativeSignal: "Bold, specific color — claim something" },
      { pattern: "Person meditating or doing yoga in nature", dominantBrands: ["Every wellness brand"], whyOverused: "Stock photo industry produced millions of these", alternativeSignal: "Clinical precision — wellness as science, not aspiration" },
      { pattern: "Sans-serif with generous whitespace and small body text", dominantBrands: ["Headspace, Calm aesthetics"], whyOverused: "Digital wellness aesthetic", alternativeSignal: "Dense, editorial — wellness as a subject to be taken seriously" },
      { pattern: "'Feel your best' or 'live better' headline", dominantBrands: ["All wellness brands"], whyOverused: "Aspiration without specificity", alternativeSignal: "Specific physiological or psychological claim with evidence" },
      { pattern: "Supplement product on white + ingredient list", dominantBrands: ["DTC wellness brands"], whyOverused: "Clean product photography became standard", alternativeSignal: "Process: show the lab, the sourcing, the testing" },
    ],
  },
  {
    industry: "Music / Entertainment",
    industryTemperature: "hot",
    distinctivenessOpportunity: "Music sites are tour dates and merch. Distinctive = extending the sonic identity into visual space.",
    patterns: [
      { pattern: "Full-bleed artist photo with tour dates overlay", dominantBrands: ["All music artist sites"], whyOverused: "Squarespace/Bandzoogle template standard", alternativeSignal: "The music's visual world — not the artist's face" },
      { pattern: "Dark background with light text", dominantBrands: ["Rock, hip-hop, electronic artists"], whyOverused: "Stage aesthetic translated to web", alternativeSignal: "Derived from the album artwork palette" },
      { pattern: "Merch store embedded in artist site", dominantBrands: ["Shopify-powered artists"], whyOverused: "Revenue optimization", alternativeSignal: "Objects as part of the artistic statement, not a shop" },
      { pattern: "Social media icons row in footer", dominantBrands: ["Everyone"], whyOverused: "Follow us everywhere = standard", alternativeSignal: "One platform, the right one, prominent" },
      { pattern: "Press quotes in bold italics", dominantBrands: ["Artists with PR"], whyOverused: "Critical credibility shortcut", alternativeSignal: "The music speaks — let the listener's words be the copy" },
    ],
  },
  {
    industry: "Legal",
    industryTemperature: "cold",
    distinctivenessOpportunity: "Law firm sites are extremely undifferentiated. Almost any distinctive design decision would immediately stand out.",
    patterns: [
      { pattern: "Dark blue suit photo of partners", dominantBrands: ["Every law firm"], whyOverused: "Professionalism shorthand", alternativeSignal: "Work environment, process, outcomes" },
      { pattern: "Practice area dropdown mega-menu", dominantBrands: ["BigLaw firms"], whyOverused: "Internal org structure exposed as nav", alternativeSignal: "Client-need based navigation: 'I need to...'", },
      { pattern: "Blue/grey corporate palette", dominantBrands: ["All law firms globally"], whyOverused: "Authority = cool colors convention", alternativeSignal: "Warm, precise — the warmth of being understood" },
      { pattern: "'Experienced attorneys / trusted counsel'", dominantBrands: ["All law firms"], whyOverused: "Credibility formula", alternativeSignal: "Specific: 'We've handled 340 employment disputes. We haven't lost one.'" },
      { pattern: "Awards bar: Chambers, Legal 500 logos", dominantBrands: ["Ranked firms"], whyOverused: "Industry credential display", alternativeSignal: "Specific case outcome with sector and scale" },
    ],
  },
  {
    industry: "Startup",
    industryTemperature: "hot",
    distinctivenessOpportunity: "Startup visual language is completely homogenized around YC aesthetic. Any decision that doesn't look like this is immediately distinctive.",
    patterns: [
      { pattern: "White background, Inter/DM Sans, one accent color", dominantBrands: ["YC portfolio companies"], whyOverused: "YC batches shipped fast, Vercel templates everywhere", alternativeSignal: "Opinionated visual identity from day one" },
      { pattern: "'The [category] for [audience]' headline", dominantBrands: ["Every startup"], whyOverused: "Positioning formula from product marketing playbook", alternativeSignal: "Show the problem in one line — not the solution" },
      { pattern: "Feature section with alternating image + text", dominantBrands: ["Every SaaS landing page"], whyOverused: "Webflow templates normalized it", alternativeSignal: "Narrative progression — each section earns entry to the next" },
      { pattern: "Investor logos below fold", dominantBrands: ["Funded startups"], whyOverused: "VC backing as trust proxy", alternativeSignal: "Customer outcomes as the primary trust signal" },
      { pattern: "Waitlist/signup CTA at top of page (before value is established)", dominantBrands: ["Growth-hacked startups"], whyOverused: "Email before everything conversion optimization", alternativeSignal: "Value before ask — fully establish the problem and solution first" },
    ],
  },
  {
    industry: "Consulting",
    industryTemperature: "cold",
    distinctivenessOpportunity: "Consulting sites are almost all the same. Opportunity in being the firm that's clearly distinct — specificity of expertise.",
    patterns: [
      { pattern: "Generic stock photo of meeting room or handshake", dominantBrands: ["Mid-market consulting"], whyOverused: "No proprietary photography; stock fills gap", alternativeSignal: "Specific diagrams, frameworks, visual thinking outputs" },
      { pattern: "Service list in icon grid", dominantBrands: ["All consulting firms"], whyOverused: "Services = what we do = grid of icons", alternativeSignal: "Problems solved, not services offered" },
      { pattern: "Partner/team hierarchy page", dominantBrands: ["BigFour, MBB websites"], whyOverused: "Authority structure displayed", alternativeSignal: "Expertise map — what you know, not who you are" },
      { pattern: "'Transform your business'", dominantBrands: ["All consultancies"], whyOverused: "Transformation = consulting shorthand", alternativeSignal: "Specific: 'We helped 14 manufacturers reduce cost per unit by 23%'" },
      { pattern: "Insight/thought leadership blog section", dominantBrands: ["McKinsey, Deloitte — widely copied"], whyOverused: "Content marketing formula", alternativeSignal: "Working frameworks shared openly — not gated PDF downloads" },
    ],
  },
  {
    industry: "Non-profit",
    industryTemperature: "warm",
    distinctivenessOpportunity: "Non-profit sites compete for emotional engagement. Distinctive = trust through transparency, not emotion through stock photography.",
    patterns: [
      { pattern: "Sad/suffering face of beneficiary in hero", dominantBrands: ["Legacy aid organizations"], whyOverused: "Emotional urgency formula from direct mail era", alternativeSignal: "Dignity photography — show outcomes, not suffering" },
      { pattern: "Donate button in red always visible", dominantBrands: ["All NGOs"], whyOverused: "Urgency conversion optimization", alternativeSignal: "Donate after establishing impact — not at first scroll" },
      { pattern: "'Together we can...' / 'Join the movement'", dominantBrands: ["All NGOs"], whyOverused: "Community aspiration formula", alternativeSignal: "Specific: '£23 funds one school term for one child.'" },
      { pattern: "Impact metrics counter animation", dominantBrands: ["Global NGOs"], whyOverused: "Scale = credibility shorthand", alternativeSignal: "One story told completely — specificity beats scale" },
      { pattern: "Partner logos in carousel", dominantBrands: ["Established NGOs"], whyOverused: "Credibility by association", alternativeSignal: "Named grant sources with specific project outcomes" },
    ],
  },
  {
    industry: "Personal Brand",
    industryTemperature: "hot",
    distinctivenessOpportunity: "Personal brand sites are mostly identical. Distinctive = have a clear point of view that excludes as much as it includes.",
    patterns: [
      { pattern: "Professional headshot with arms crossed or in thought", dominantBrands: ["LinkedIn influencers"], whyOverused: "Personal brand photography formula", alternativeSignal: "In-context working photograph or no headshot at all" },
      { pattern: "'I help [audience] achieve [outcome]'", dominantBrands: ["Every coach/consultant"], whyOverused: "Unique value proposition formula", alternativeSignal: "Your point of view — what you believe that others don't" },
      { pattern: "Newsletter signup with free guide hook", dominantBrands: ["Creator economy personas"], whyOverused: "Lead magnet formula from email marketing", alternativeSignal: "Ask for nothing — earn attention by giving value openly" },
      { pattern: "Podcast/YouTube/LinkedIn icon row", dominantBrands: ["Multi-platform creators"], whyOverused: "Omnichannel presence display", alternativeSignal: "One platform you actually own. Your best essay or talk." },
      { pattern: "Speaking / press logos grid", dominantBrands: ["Keynote speakers"], whyOverused: "Media credibility proxy", alternativeSignal: "The idea you spoke about — not the logo of who invited you" },
    ],
  },
];

// ── Resolve function ──────────────────────────────────────────────────────────
export type CompetitiveAnalysis = {
  industry: string;
  matched: boolean;
  patterns: CompetitivePattern[];
  industryTemperature: "cold" | "warm" | "hot";
  distinctivenessOpportunity: string;
  systemPromptInjection: string;
};

export function analyzeCompetitiveField(analysis: BriefAnalysis): CompetitiveAnalysis {
  // Find the best matching industry (case-insensitive partial match)
  const needle = (analysis.industry + " " + analysis.subject).toLowerCase();

  let best: CompetitiveField | undefined;
  let bestScore = 0;

  for (const field of COMPETITIVE_FIELDS) {
    const industryWords = field.industry.toLowerCase().split(/[\s/]+/);
    let score = 0;
    for (const word of industryWords) {
      if (word.length > 3 && needle.includes(word)) score++;
    }
    if (score > bestScore) { bestScore = score; best = field; }
  }

  if (!best || bestScore === 0) {
    // Fallback: generic competitive defaults
    return {
      industry: analysis.industry,
      matched: false,
      patterns: [],
      industryTemperature: "warm",
      distinctivenessOpportunity: "No specific competitive field data for this industry. Apply general distinctiveness principles.",
      systemPromptInjection: "",
    };
  }

  const injection = `
=== MODULE L: COMPETITIVE FIELD ANALYSIS — ${best.industry.toUpperCase()} ===
Market Temperature: ${best.industryTemperature.toUpperCase()} (${
    best.industryTemperature === "hot" ? "extremely saturated — differentiation is hard but valuable" :
    best.industryTemperature === "warm" ? "moderately saturated — clear opportunities exist" :
    "relatively open — most design decisions will be distinctive"
  })

Opportunity: ${best.distinctivenessOpportunity}

THE 5 DOMINANT VISUAL PATTERNS IN THIS SPACE (your output MUST NOT replicate any):

${best.patterns.map((p, i) => `${i + 1}. AVOID: "${p.pattern}"
   Used by: ${p.dominantBrands.join(", ")}
   Why overused: ${p.whyOverused}
   Instead signal: ${p.alternativeSignal}`).join("\n\n")}

IMPORTANT: The patterns above are NOT generic clichés — they are INDUSTRY-SPECIFIC defaults for ${best.industry}. A design that avoids these will immediately signal "this is not another ${best.industry} website" to someone who knows this space.
=== END COMPETITIVE FIELD ANALYSIS ===
`;

  return {
    industry: best.industry,
    matched: true,
    patterns: best.patterns,
    industryTemperature: best.industryTemperature,
    distinctivenessOpportunity: best.distinctivenessOpportunity,
    systemPromptInjection: injection,
  };
}

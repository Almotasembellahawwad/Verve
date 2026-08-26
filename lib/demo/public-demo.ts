import type { GeneratedProject } from "@/lib/project/types";

export const PUBLIC_DEMO_BRIEF = "مطعم مصري معاصر في القاهرة يعيد تقديم وصفات الدلتا والصعيد. الجمهور من سكان القاهرة والزوار الباحثين عن تجربة محلية حقيقية، والهدف حجز الطاولات واستكشاف قائمة الموسم.";

const demoHtml = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="description" content="مائدة القاهرة — مطبخ مصري موسمي بذاكرة محلية.">
  <title>مائدة القاهرة</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <a class="skip" href="#main">انتقل إلى المحتوى</a>
  <header class="nav">
    <a class="wordmark" href="#main" aria-label="مائدة القاهرة — الرئيسية">مائدة<span>°</span></a>
    <nav aria-label="التنقل الرئيسي"><a href="#menu">قائمة اليوم</a><a href="#story">الحكاية</a></nav>
    <button class="reserve" type="button" data-open-reservation>احجز طاولتك</button>
  </header>
  <main id="main">
    <section class="hero" aria-labelledby="hero-title">
      <div class="season"><span>موسم ٠٣</span><b>الطماطم البلدية · الليمون المخلل · النعناع</b></div>
      <p class="kicker">القاهرة · الزمالك · منذ ٢٠٢٦</p>
      <h1 id="hero-title">القاهرة<br><em>تُقدَّم</em><br>على مهل.</h1>
      <div class="hero-foot"><p>وصفات مصرية لا تتنكر في هيئة أخرى. نطبخ من السوق، ونكتب اسم القرية بجانب كل طبق.</p><a href="#menu">اقرأ مائدة المساء <span aria-hidden="true">↓</span></a></div>
      <div class="sun" aria-hidden="true"><span>٣٠°</span><i></i><small>قبل الغروب</small></div>
    </section>
    <section class="menu" id="menu" aria-labelledby="menu-title">
      <div class="section-head"><p>المائدة / هذا الأسبوع</p><h2 id="menu-title">أربعة أطباق.<br>أربع جهات.</h2></div>
      <ol class="dishes">
        <li><span>٠١</span><div><h3>عيش شمسي، طحينة مدخنة</h3><p>قنا · سمسم سوهاج · ليمون معصفر</p></div><b>١٦٠</b></li>
        <li><span>٠٢</span><div><h3>طاجن بامية بلا استعجال</h3><p>الفيوم · صلصة محروقة · أرز مفلفل</p></div><b>٣٤٠</b></li>
        <li><span>٠٣</span><div><h3>سمك بحيرة البرلس</h3><p>كفر الشيخ · شبت · بطاطس بالكمون</p></div><b>٤٨٠</b></li>
        <li><span>٠٤</span><div><h3>أرز بلبن وقشرة نار</h3><p>دلتا النيل · مستكة · ملح بحري</p></div><b>١٨٠</b></li>
      </ol>
      <p class="currency">الأسعار بالجنيه المصري · تتغير الأطباق مع السوق</p>
    </section>
    <section class="story" id="story" aria-labelledby="story-title">
      <p class="vertical">من السوق إلى المائدة / ٢٧ كم</p>
      <div><span class="story-index">م / ٠١</span><h2 id="story-title">لا نبحث عن<br>نسخة حديثة من مصر.</h2></div>
      <div class="story-copy"><p>نبحث عن مصر نفسها: قِدر نحاس، نار واضحة، ومكونات نعرف أصحابها بالاسم.</p><p>كل خميس نزور سوق العبور قبل الفجر. ما يصل جيدًا يكتب قائمة الأسبوع.</p></div>
    </section>
    <section class="visit" aria-labelledby="visit-title">
      <p>العشاء من السادسة حتى منتصف الليل</p><h2 id="visit-title">مكانك<br>على المائدة.</h2>
      <button type="button" data-open-reservation>ابدأ الحجز <span aria-hidden="true">↗</span></button>
      <address>١٢ شارع البرازيل، الزمالك<br>القاهرة، مصر</address>
    </section>
  </main>
  <dialog id="reservation">
    <button class="dialog-close" type="button" data-close-reservation aria-label="إغلاق">×</button>
    <p>الحجز المباشر</p><h2>اختر طاولتك<br>بمكالمة قصيرة.</h2><a href="tel:+20200000000">+٢٠ ٢ ٠٠٠٠ ٠٠٠٠</a>
    <small>هذه معاينة تفاعلية؛ الرقم تجريبي ولا يتم إرسال أي بيانات.</small>
  </dialog>
  <script src="script.js"></script>
</body>
</html>`;

const demoCss = `:root{--ink:#14130f;--paper:#e8dfce;--tomato:#cf3e27;--lime:#c7d86b;--line:rgba(20,19,15,.22);font-family:Arial,"Segoe UI",Tahoma,sans-serif;color:var(--ink);background:var(--paper)}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--paper);color:var(--ink)}a{color:inherit}.skip{position:fixed;inset-block-start:10px;inset-inline-start:10px;z-index:20;padding:10px 14px;background:#fff;transform:translateY(-150%)}.skip:focus{transform:none}.nav{min-height:82px;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;padding:0 clamp(20px,4vw,64px);border-bottom:1px solid var(--line)}.wordmark{text-decoration:none;font-size:1.7rem;font-weight:800;justify-self:start}.wordmark span{color:var(--tomato)}.nav nav{display:flex;gap:28px}.nav nav a{font-size:.82rem;text-decoration:none}.reserve,.visit button{justify-self:end;border:1px solid var(--ink);background:transparent;padding:12px 18px;color:inherit;cursor:pointer}.hero{min-height:calc(100vh - 82px);position:relative;padding:clamp(34px,6vw,84px) clamp(20px,7vw,108px);overflow:hidden}.kicker{margin:0 0 3vh;font-size:.75rem;letter-spacing:.12em}.hero h1{position:relative;z-index:2;margin:0;font-size:clamp(4.6rem,13vw,11rem);font-weight:900;letter-spacing:-.085em;line-height:.72}.hero h1 em{font-family:Georgia,serif;font-weight:400;color:var(--tomato)}.season{position:absolute;inset-block-start:7%;inset-inline-end:4%;width:190px;display:grid;gap:7px;font-size:.67rem;line-height:1.5;transform:rotate(4deg)}.season span{color:var(--tomato);font-weight:800}.hero-foot{position:relative;z-index:2;width:min(500px,70%);margin-block-start:8vh;margin-inline-start:auto;display:grid;grid-template-columns:1fr auto;align-items:end;gap:30px}.hero-foot p{margin:0;line-height:1.8}.hero-foot a{text-decoration:none;font-weight:800}.sun{position:absolute;z-index:1;inset-inline-start:-7vw;inset-block-start:18%;width:clamp(220px,36vw,520px);aspect-ratio:1;border-radius:50%;background:var(--lime);display:grid;place-items:center;direction:ltr}.sun span{font-size:clamp(3rem,8vw,7rem);font-weight:900}.sun i{position:absolute;width:1px;height:120%;background:var(--ink);transform:rotate(28deg)}.sun small{position:absolute;inset-block-end:18%;font-weight:700}.menu{padding:clamp(70px,10vw,150px) clamp(20px,7vw,108px);background:var(--ink);color:var(--paper)}.section-head{display:grid;grid-template-columns:1fr 2fr;gap:30px;margin-bottom:70px}.section-head p{font-size:.72rem;color:var(--lime)}.section-head h2,.story h2,.visit h2{margin:0;font-size:clamp(3.3rem,8vw,7.5rem);letter-spacing:-.07em;line-height:.88}.dishes{margin:0;padding:0;list-style:none}.dishes li{display:grid;grid-template-columns:70px 1fr auto;align-items:center;gap:20px;padding:24px 0;border-top:1px solid rgba(232,223,206,.25)}.dishes li:last-child{border-bottom:1px solid rgba(232,223,206,.25)}.dishes span,.currency{color:#8d897f;font-size:.7rem}.dishes h3{margin:0 0 7px;font-size:clamp(1.2rem,3vw,2rem)}.dishes p{margin:0;color:#a9a398}.dishes b{color:var(--lime)}.currency{text-align:left;margin-top:16px}.story{min-height:90vh;display:grid;grid-template-columns:auto 1.5fr 1fr;align-items:center;gap:6vw;padding:clamp(70px,10vw,150px) clamp(20px,7vw,108px);border-bottom:1px solid var(--line)}.vertical{writing-mode:vertical-rl;font-size:.7rem;letter-spacing:.1em}.story-index{display:block;margin-bottom:24px;color:var(--tomato);font-weight:800}.story-copy{align-self:end;margin-bottom:9vh}.story-copy p{line-height:1.9}.story-copy p+p{margin-top:28px}.visit{position:relative;min-height:82vh;padding:clamp(70px,10vw,150px) clamp(20px,7vw,108px);background:var(--tomato);color:#f5e8d6}.visit>p{font-size:.75rem}.visit h2{margin:9vh 0 7vh;font-size:clamp(4.4rem,12vw,10rem)}.visit button{color:#f5e8d6;border-color:#f5e8d6;font-size:1rem}.visit address{position:absolute;inset-inline-end:7vw;inset-block-end:10vh;font-style:normal;line-height:1.8;font-size:.8rem}dialog{width:min(520px,calc(100% - 32px));border:0;padding:50px;background:var(--paper);color:var(--ink)}dialog::backdrop{background:rgba(20,19,15,.78)}dialog h2{font-size:2.8rem;line-height:.95}dialog a{display:block;margin:30px 0 14px;font-size:1.6rem;color:var(--tomato);font-weight:800}dialog small{display:block;line-height:1.6;color:#5e5a50}.dialog-close{position:absolute;inset-block-start:14px;inset-inline-end:16px;border:0;background:transparent;font-size:2rem;cursor:pointer}@media(max-width:760px){.nav{grid-template-columns:1fr auto}.nav nav{display:none}.hero{min-height:760px}.hero h1{font-size:clamp(4rem,21vw,7rem)}.season{display:none}.sun{inset-inline-start:-30vw;inset-block-start:28%;width:86vw}.hero-foot{width:100%;grid-template-columns:1fr;margin-top:35vh}.section-head,.story{grid-template-columns:1fr}.dishes li{grid-template-columns:38px 1fr auto}.vertical{writing-mode:horizontal-tb}.story{min-height:auto}.story-copy{margin:0}.visit address{position:static;margin-top:50px}}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}*{animation:none!important;transition:none!important}}`;

const demoScript = `const dialog=document.querySelector('#reservation');document.querySelectorAll('[data-open-reservation]').forEach((button)=>button.addEventListener('click',()=>dialog?.showModal()));document.querySelector('[data-close-reservation]')?.addEventListener('click',()=>dialog?.close());dialog?.addEventListener('click',(event)=>{if(event.target===dialog)dialog.close();});`;

export const PUBLIC_DEMO_PROJECT: GeneratedProject = {
  schemaVersion: 1,
  name: "maeda-cairo-public-demo",
  framework: "html",
  entryFile: "index.html",
  files: [
    { path: "index.html", content: demoHtml, language: "html", role: "source" },
    { path: "styles.css", content: demoCss, language: "css", role: "source" },
    { path: "script.js", content: demoScript, language: "javascript", role: "source" },
    { path: "README.md", content: "# مائدة القاهرة — Verve public demo\n\nA pre-generated HTML/CSS project used to let visitors inspect Verve without an API key. Open `index.html` directly or serve the folder with any static server.\n", language: "markdown", role: "documentation" },
  ],
  dependencies: {}, scripts: {}, warnings: [],
  readiness: { status: "ready", score: 96 },
  validation: { status: "ready", score: 96, checks: [], failed: 0, warnings: 0 },
};

export const PUBLIC_DEMO_RESULT = {
  demo: true as const,
  mode: "fast" as const,
  briefAnalysis: { subject: "مطعم مصري معاصر في القاهرة", audience: "سكان القاهرة والزوار الباحثون عن تجربة طعام محلية حقيقية", primaryJob: "استكشاف قائمة الموسم وحجز طاولة", tone: "محلي، واثق، صريح، دافئ", industry: "Restaurant / Hospitality" },
  plan: {
    colorPalette: [
      { name: "Papyrus", hex: "#E8DFCE", role: "background" }, { name: "Kohl", hex: "#14130F", role: "text / dark surface" },
      { name: "Tomato", hex: "#CF3E27", role: "primary signal" }, { name: "Pickle", hex: "#C7D86B", role: "seasonal accent" },
    ],
    typePairing: { display: "Arabic system grotesk", body: "Arial / Segoe UI / Tahoma", rationale: "A local, dependency-free stack keeps Arabic forms sharp while allowing the oversized editorial hierarchy to carry the identity." },
    layoutConcept: "A menu behaves like a city receipt: oversized Arabic typography, market annotations, and one seasonal sun move the visitor from appetite to provenance to reservation.",
    signatureElement: { name: "The Cairo Service Sun", description: "A measured lime disc cuts behind the hero and records the temperature before sunset.", justification: "It connects Cairo's heat and dinner service to a useful temporal marker instead of adding generic decoration." },
    referencesSampled: ["Egyptian market receipts", "Arabic editorial mastheads", "seasonal restaurant chalkboards"],
  },
  critique: { passed: true, flaggedElements: [], positiveElements: ["Arabic-first hierarchy", "Dish provenance is part of the information architecture", "One controlled signature element"], verdict: "Public demo preflight: a deliberately constrained restaurant identity with a runnable multi-file project and no external runtime dependencies.", transcript: "Pre-generated demonstration. No provider call was used in this browser session." },
  code: { code: demoHtml, framework: "html", componentName: "index.html", setupNotes: "Public demo snapshot. Edit the files in Live Project and download the current ZIP." },
  archetype: { id: "everyman", name: "Everyman", secondaryId: "creator", confidence: 0.88, reasoning: "Familiar food language is made memorable through editorial composition rather than luxury signals.", emotionalJob: "Feel welcomed into a recognizably Egyptian meal without tourist clichés.", archetypeConflict: "Imported fine-dining codes, gold-on-black luxury, and generic food photography." },
  distinctivenessReport: {
    score: 88, grade: "A", clichesAvoided: ["No full-bleed food photography", "No gold-on-black luxury palette", "No generic chef manifesto"], clichesDetected: [], signatureElement: "The Cairo Service Sun",
    critiqueSummary: "A curated demonstration that prioritizes local content structure over decorative restaurant conventions.", revisionCount: 1,
    recommendations: ["Replace the demonstration phone number before production.", "Connect reservation behavior to an explicit booking provider."], archetypeId: "everyman", archetypeCoherence: 88,
    normanLevels: {
      visceral: { score: 92, grade: "S", rationale: "The scale, Arabic rhythm, and seasonal disc make a decisive first impression.", improvements: [] },
      behavioral: { score: 86, grade: "A", rationale: "Menu, story, and reservation paths remain direct across breakpoints.", improvements: ["Connect the reservation CTA to a real booking contract."] },
      reflective: { score: 85, grade: "A", rationale: "Named regions and market logic give the identity a story worth repeating.", improvements: ["Add real supplier names once the restaurant exists."] },
    }, normanSummary: "Curated demo evidence. The visual result is still verified by Render Gate in the browser.",
  },
  restraintResult: { verdict: "disciplined" as const, boldestElement: "The Cairo Service Sun", reasoning: "The single oversized disc has a temporal and geographic role; supporting sections remain typographic and restrained.", suggestion: null, restraintScore: 92 },
  engineeringResult: {
    compositeScore: 94, grade: "S", passed: true,
    dimensions: [
      { id: "semantic", name: "Semantic HTML", score: 96, weight: 0.2, flags: [], passed: true }, { id: "accessibility", name: "Accessibility", score: 94, weight: 0.25, flags: [], passed: true },
      { id: "responsive", name: "Responsive Design", score: 92, weight: 0.2, flags: [], passed: true }, { id: "performance", name: "Performance", score: 96, weight: 0.15, flags: [], passed: true },
      { id: "clean-code", name: "Clean Code", score: 91, weight: 0.2, flags: [], passed: true },
    ], criticalFailures: [], recommendations: ["Use a real reservation provider before shipping."],
  },
  revisionCount: 1, durationMs: 0, project: PUBLIC_DEMO_PROJECT,
};

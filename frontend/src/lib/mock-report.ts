export type Citation = { id: number; title: string; authors: string; journal: string; year: number; doi: string };

export const citations: Citation[] = [
  { id: 1, title: "Akkermansia muciniphila and its role in metabolic health", authors: "Cani PD, Depommier C, Derrien M, et al.", journal: "Nat Rev Gastroenterol Hepatol", year: 2022, doi: "10.1038/s41575-022-00631-9" },
  { id: 2, title: "Short-chain fatty acids and gut microbiota–host interactions", authors: "Koh A, De Vadder F, Kovatcheva-Datchary P, Bäckhed F", journal: "Cell", year: 2016, doi: "10.1016/j.cell.2016.05.041" },
  { id: 3, title: "Standardised reporting of 16S rRNA sequencing in microbiome studies", authors: "Sinha R, Abu-Ali G, Vogtmann E, et al.", journal: "Nat Biotechnol", year: 2017, doi: "10.1038/nbt.3981" },
  { id: 4, title: "Bile acid metabolism by gut microbiota and its impact on host physiology", authors: "Wahlström A, Sayin SI, Marschall HU, Bäckhed F", journal: "Cell Metab", year: 2016, doi: "10.1016/j.cmet.2016.05.005" },
  { id: 5, title: "Diet rapidly and reproducibly alters the human gut microbiome", authors: "David LA, Maurice CF, Carmody RN, et al.", journal: "Nature", year: 2014, doi: "10.1038/nature12820" },
];

export type ProtocolStep = {
  id: string;
  phase: string;
  title: string;
  duration: string;
  description: string;
  refs: number[];
};

export const protocolSteps: ProtocolStep[] = [
  { id: "P1", phase: "Prep", title: "Subject recruitment & screening", duration: "Week 1", refs: [3], description: "Recruit n=24 healthy adults (18–55y, BMI 18.5–29.9). Exclude antibiotic use within 90 days. Collect baseline FFQ and Bristol stool chart entries for 7 consecutive days." },
  { id: "P2", phase: "Baseline", title: "Baseline stool & blood collection", duration: "Week 2", refs: [3, 5], description: "Collect 2× stool aliquots (1g each) flash-frozen at −80°C within 2 h of voiding. Draw 10 mL fasting venous blood for SCFA and bile acid panels." },
  { id: "P3", phase: "Intervention", title: "Dietary intervention crossover", duration: "Weeks 3–6", refs: [5], description: "Randomised crossover: 14 d high-fibre arm (40 g/d inulin + resistant starch) vs. 14 d control diet, 7-d washout between arms. Compliance via daily food log app." },
  { id: "P4", phase: "Sampling", title: "Endpoint stool & blood collection", duration: "Week 7", refs: [2, 4], description: "Repeat stool and blood collection at end of each arm. Ship samples on dry ice to sequencing facility within 24 h." },
  { id: "P5", phase: "Sequencing", title: "16S rRNA V4 region sequencing", duration: "Week 8", refs: [3], description: "Extract DNA via Qiagen DNeasy PowerSoil Pro. Amplify V4 (515F/806R primers). Sequence on Illumina MiSeq 2×250 bp, target 50k reads/sample." },
  { id: "P6", phase: "Analysis", title: "Bioinformatics & statistics", duration: "Weeks 9–10", refs: [1, 2], description: "Process reads in QIIME2 (DADA2). Compute α/β-diversity, differential abundance via ANCOM-BC. Mixed-effects models with subject as random effect; α=0.05, FDR-BH." },
];

export const validation = {
  approach: "Primary endpoint: change in faecal SCFA concentration (butyrate, μmol/g) between high-fibre and control arms. Secondary: shift in Akkermansia muciniphila relative abundance. Validation via (a) technical replicates on 10% of samples (CV target <15%), (b) mock community positive control on every sequencing run, (c) blinded sample IDs through analysis.",
  successCriteria: [
    "Δ butyrate ≥ 20% between arms (paired t-test, p<0.05)",
    "Sequencing depth ≥ 30,000 reads/sample after rarefaction",
    "Mock community taxonomic accuracy ≥ 95%",
    "Subject compliance ≥ 80% (validated via food log + plasma carotenoids)",
  ],
};

export type Material = { item: string; qty: string; vendor: string; catalog: string; lead: string; refs: number[]; cost: number };

export const materials: Material[] = [
  { item: "DNeasy PowerSoil Pro Kit (50 prep)", qty: "2 kits", vendor: "Qiagen", catalog: "47016", lead: "5 days", refs: [3], cost: 1280 },
  { item: "Inulin (chicory root, ≥90%)", qty: "500 g", vendor: "Sigma-Aldrich", catalog: "I2255", lead: "3 days", refs: [5], cost: 184 },
  { item: "Resistant starch type 2 (Hi-Maize 260)", qty: "1 kg", vendor: "Ingredion", catalog: "HM260", lead: "10 days", refs: [5], cost: 95 },
  { item: "Sodium butyrate standard, ≥98%", qty: "25 g", vendor: "Sigma-Aldrich", catalog: "S5501", lead: "2 days", refs: [2], cost: 67 },
  { item: "MiSeq Reagent Kit v2 (500-cycle)", qty: "1 kit", vendor: "Illumina", catalog: "MS-102-2003", lead: "7 days", refs: [3], cost: 1620 },
  { item: "515F/806R primers (custom, HPLC)", qty: "10 nmol ea.", vendor: "IDT", catalog: "Custom-V4", lead: "4 days", refs: [3], cost: 142 },
  { item: "ZymoBIOMICS Microbial Community Std", qty: "10 prep", vendor: "Zymo Research", catalog: "D6300", lead: "3 days", refs: [3], cost: 245 },
  { item: "Cryovials 2 mL, sterile", qty: "500 ea.", vendor: "Thermo Fisher", catalog: "5000-1020", lead: "2 days", refs: [], cost: 178 },
  { item: "SCFA derivatisation reagents (MTBSTFA)", qty: "25 mL", vendor: "Sigma-Aldrich", catalog: "394882", lead: "5 days", refs: [2], cost: 215 },
];

export type BudgetLine = { category: "Reagents" | "Equipment" | "Labor" | "Subjects"; description: string; amount: number };

export const budgetLines: BudgetLine[] = [
  { category: "Reagents", description: "Sequencing reagents & primers", amount: 1762 },
  { category: "Reagents", description: "DNA extraction kits", amount: 1280 },
  { category: "Reagents", description: "Dietary intervention substrates", amount: 279 },
  { category: "Reagents", description: "SCFA & bile acid analytical standards", amount: 282 },
  { category: "Reagents", description: "Consumables (cryovials, tips, plates)", amount: 415 },
  { category: "Equipment", description: "MiSeq run access fee (core facility)", amount: 2400 },
  { category: "Equipment", description: "GC-MS time (40 h @ $85/h)", amount: 3400 },
  { category: "Equipment", description: "−80°C storage (10 weeks)", amount: 350 },
  { category: "Labor", description: "Research assistant (0.5 FTE × 10 wk)", amount: 9800 },
  { category: "Labor", description: "Bioinformatician (80 h)", amount: 5600 },
  { category: "Subjects", description: "Participant compensation (24 × $200)", amount: 4800 },
  { category: "Subjects", description: "IRB & ethics processing", amount: 650 },
];

export const ganttDefinition = `gantt
    title Operational Timeline — Gut Microbiome × High-Fibre Crossover
    dateFormat  YYYY-MM-DD
    axisFormat  W%V
    section Prep
    Recruitment & screening      :prep1, 2026-05-04, 7d
    Baseline collection          :prep2, after prep1, 7d
    section Intervention
    High-fibre arm               :int1, after prep2, 14d
    Washout                      :int2, after int1, 7d
    Control arm                  :int3, after int2, 14d
    section Lab
    Endpoint sampling            :lab1, after int3, 7d
    DNA extraction & libraries   :lab2, after lab1, 5d
    MiSeq sequencing run         :lab3, after lab2, 2d
    section Analysis
    Bioinformatics (QIIME2)      :ana1, after lab3, 7d
    Statistical modelling        :ana2, after ana1, 5d
    Manuscript draft             :ana3, after ana2, 3d`;
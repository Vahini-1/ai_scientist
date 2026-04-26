export type PrintableExperimentData = {
  project: {
    id: string;
    name: string;
    status: string;
    hypothesis: string;
    pi: string;
    created: string;
  };
  currency: string;
  totalCost: number;
  noveltyScore: number;
  noveltySignal: string;
  executiveSummary: string;
  budget: Array<{
    category: string;
    value: number;
  }>;
  protocol: Array<{
    step: number;
    title: string;
    phase: string;
    duration: string;
    safety: string;
    notes: string;
  }>;
  materials: Array<{
    name: string;
    catalog: string;
    vendor: string;
    qty: number;
    unitCost: number;
  }>;
  references: Array<{
    title: string;
    authors: string;
    journal: string;
    doi: string;
    relevance: number;
  }>;
};

// Central printable export payload.
// Update this object when you want PDF/DOCX output to change.
export const experimentData: PrintableExperimentData = {
  project: {
    id: "EXP-2026-001",
    name: "Polyphenol-Gut Axis Pilot",
    status: "active",
    hypothesis:
      "A 14-day high-fiber dietary intervention increases fecal butyrate and Akkermansia muciniphila relative abundance versus matched control diet.",
    pi: "Dr. Vahini Chaudhary",
    created: "2026-04-26",
  },
  currency: "$",
  totalCost: 48250,
  noveltyScore: 78,
  noveltySignal: "similar work exists",
  executiveSummary:
    "This protocol tests whether a high-fiber intervention shifts microbiome-derived SCFA output in a clinically measurable window. The plan prioritizes reproducibility through standardized handling, constrained vendor selection, and phased QC checkpoints while staying inside a moderate translational budget.",
  budget: [
    { category: "Materials & Reagents", value: 16500 },
    { category: "Sequencing & Analytics", value: 14250 },
    { category: "Personnel", value: 11300 },
    { category: "Contingency", value: 6200 },
  ],
  protocol: [
    {
      step: 1,
      title: "Screen & enroll participants",
      phase: "Pre-study",
      duration: "Week 1",
      safety: "Low",
      notes: "Eligibility and baseline metadata capture.",
    },
    {
      step: 2,
      title: "Baseline sampling",
      phase: "Baseline",
      duration: "Week 2",
      safety: "Low",
      notes: "Collect stool and dietary logs before intervention.",
    },
    {
      step: 3,
      title: "Dietary intervention",
      phase: "Intervention",
      duration: "Weeks 3-4",
      safety: "Medium",
      notes: "Controlled fiber dosing with compliance checks.",
    },
    {
      step: 4,
      title: "Post-intervention sampling",
      phase: "Sampling",
      duration: "Week 5",
      safety: "Low",
      notes: "Repeat stool and symptom profile collection.",
    },
    {
      step: 5,
      title: "SCFA + sequencing analysis",
      phase: "Analysis",
      duration: "Weeks 6-10",
      safety: "Low",
      notes: "Quantify butyrate and taxonomic shifts.",
    },
  ],
  materials: [
    { name: "DNA Extraction Kit", catalog: "QI-51104", vendor: "Qiagen", qty: 30, unitCost: 42.5 },
    { name: "16S Library Prep Kit", catalog: "ILM-16S-24", vendor: "Illumina", qty: 3, unitCost: 980 },
    { name: "SCFA Assay Standards", catalog: "SIG-SCFA-8", vendor: "Sigma", qty: 2, unitCost: 310 },
    { name: "Collection Tubes", catalog: "THM-STL-100", vendor: "Thermo", qty: 120, unitCost: 3.6 },
  ],
  references: [
    {
      title: "Dietary fiber and short-chain fatty acid production in adults",
      authors: "Smith et al.",
      journal: "Gut Microbes",
      doi: "10.0000/gm.2025.101",
      relevance: 91,
    },
    {
      title: "Akkermansia response to controlled diet interventions",
      authors: "Lee et al.",
      journal: "Microbiome",
      doi: "10.0000/mb.2024.212",
      relevance: 86,
    },
  ],
};

import "server-only";

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import type { Citation } from "@/lib/types";

// Local retrieval over the generated NERM workflow catalog. This keeps demos
// independent of a managed data store; swap for ENTERPRISE_RAG_DATA_STORE later.
const DEFAULT_KNOWLEDGE_DIR = path.join(
  process.cwd(),
  "..",
  "knowledge-base",
  "uchicago-nerm",
  "generated-workflows"
);
const MAX_RESULTS = 4;

const STOPWORDS = new Set(
  "a an and are as at be by can do does for from how i if in is it me my of on or should the this to what when where which who why will with you your".split(
    " "
  )
);

// Map everyday phrasing onto the vocabulary used in NERM workflow names.
const SYNONYMS: Record<string, string[]> = {
  extend: ["end", "date", "adjust", "update"],
  extension: ["end", "date", "adjust", "update"],
  prolong: ["end", "date", "adjust"],
  change: ["update", "adjust"],
  modify: ["update", "adjust"],
  edit: ["update"],
  renew: ["reactivate"],
  reactivate: ["renew"],
  restore: ["reactivate"],
  terminate: ["end", "expire", "inactive"],
  remove: ["end", "expire", "inactive"],
  deactivate: ["expire", "inactive"],
  offboard: ["end", "inactive"],
  onboard: ["new", "create"],
  add: ["new", "create"],
  create: ["new", "add"],
  transfer: ["owner", "assign"],
  csv: ["bulk", "import"],
  upload: ["bulk", "import"],
  contractor: ["non", "employee", "assignment"],
  person: ["people"],
  people: ["person"],
};

type KnowledgeDocument = {
  file: string;
  title: string;
  summary?: string;
  content: string;
  titleTerms: Set<string>;
  termCounts: Map<string, number>;
};

let documentsPromise: Promise<KnowledgeDocument[]> | undefined;

export type RetrievedDocument = {
  title: string;
  content: string;
  citation: Citation;
};

export async function searchNermKnowledge(
  query: string
): Promise<RetrievedDocument[]> {
  const documents = await loadDocuments();
  const terms = expandTerms(tokenize(query));

  if (!documents.length || !terms.length) {
    return [];
  }

  const scored = documents
    .map((document) => ({ document, score: scoreDocument(document, terms) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);
  const best = scored[0]?.score ?? 0;

  return scored
    .filter(({ score }) => score >= best * 0.4)
    .slice(0, MAX_RESULTS)
    .map(({ document }) => ({
      title: document.title,
      content: document.content,
      citation: {
        title: document.title,
        source: "UChicago NERM workflow configuration",
        excerpt: document.summary,
      },
    }));
}

function scoreDocument(document: KnowledgeDocument, terms: string[]): number {
  return terms.reduce((score, term) => {
    const count = document.termCounts.get(term) ?? 0;
    const titleBoost = document.titleTerms.has(term) ? 4 : 0;
    return score + titleBoost + (count > 0 ? 1 + Math.log(count) : 0);
  }, 0);
}

async function loadDocuments(): Promise<KnowledgeDocument[]> {
  documentsPromise ??= readDocuments().catch((error) => {
    documentsPromise = undefined;
    console.error("Unable to load the NERM knowledge base:", error);
    return [];
  });
  return documentsPromise;
}

async function readDocuments(): Promise<KnowledgeDocument[]> {
  const directory = process.env.NERM_KNOWLEDGE_DIR ?? DEFAULT_KNOWLEDGE_DIR;
  const files = (await readdir(directory)).filter((file) => file.endsWith(".md"));

  return Promise.all(
    files.map(async (file) => {
      const content = await readFile(path.join(directory, file), "utf8");
      const title =
        content.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? file.replace(/\.md$/, "");
      const summary =
        content.match(/^- \*\*What it does:\*\*\s+(.+)$/m)?.[1]?.trim() ??
        content.match(/^- \*\*Workflow type:\*\*\s+(.+)$/m)?.[1]?.trim();
      const termCounts = new Map<string, number>();

      for (const term of tokenize(content)) {
        termCounts.set(term, (termCounts.get(term) ?? 0) + 1);
      }

      return {
        file,
        title,
        summary,
        content,
        titleTerms: new Set(tokenize(title)),
        termCounts,
      };
    })
  );
}

function tokenize(value: string): string[] {
  return (value.toLowerCase().match(/[a-z0-9]+/g) ?? [])
    .filter((word) => !STOPWORDS.has(word))
    .map(stem);
}

const STEMMED_SYNONYMS = new Map(
  Object.entries(SYNONYMS).map(([word, synonyms]) => [
    stem(word),
    synonyms.map(stem),
  ])
);

function expandTerms(terms: string[]): string[] {
  const expanded = new Set(terms);
  for (const term of terms) {
    for (const synonym of STEMMED_SYNONYMS.get(term) ?? []) {
      expanded.add(synonym);
    }
  }
  return [...expanded];
}

// Deliberately crude: strip common suffixes so "creates"/"created"/"create" match.
function stem(word: string): string {
  if (word.length <= 4) {
    return word;
  }
  const stripped = word.replace(/(ing|ed|s)$/, "");
  return stripped.length > 4 ? stripped.replace(/e$/, "") : stripped;
}

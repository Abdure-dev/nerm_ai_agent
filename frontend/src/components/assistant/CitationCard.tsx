import type { Citation } from "@/lib/types";

type CitationCardProps = {
  citation: Citation;
};

export function CitationCard({ citation }: CitationCardProps) {
  const title = citation.href ? (
    <a
      className="text-sm font-medium text-maroon underline decoration-maroon/30 underline-offset-2 hover:decoration-maroon"
      href={citation.href}
      rel="noreferrer"
      target="_blank"
    >
      {citation.title}
    </a>
  ) : (
    <p className="text-sm font-medium text-ink">{citation.title}</p>
  );

  return (
    <aside className="border border-greystone bg-greystone-light p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-maroon">
        Source
      </p>
      <div className="mt-1">{title}</div>
      <p className="text-xs text-greystone-dark">{citation.source}</p>
      {citation.excerpt && (
        <p className="mt-2 font-serif text-sm italic leading-6 text-ink/80">
          {citation.excerpt}
        </p>
      )}
    </aside>
  );
}

type SuggestedActionsProps = {
  actions: string[];
  disabled?: boolean;
  onSelect: (action: string) => void;
};

export function SuggestedActions({
  actions,
  disabled = false,
  onSelect,
}: SuggestedActionsProps) {
  return (
    <div className="flex flex-wrap gap-2 pt-1">
      {actions.map((action) => (
        <button
          key={action}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(action)}
          className="border border-maroon/40 bg-white px-3 py-1.5 text-xs font-medium text-maroon transition hover:border-maroon hover:bg-maroon-light disabled:cursor-not-allowed disabled:opacity-50"
        >
          {action}
        </button>
      ))}
    </div>
  );
}

import type { ApprovalRequest } from "@/lib/types";

type ApprovalModalProps = {
  approval: ApprovalRequest;
  disabled?: boolean;
  onApprove: () => void;
  onCancel: () => void;
};

export function ApprovalModal({
  approval,
  disabled = false,
  onApprove,
  onCancel,
}: ApprovalModalProps) {
  return (
    <div className="border border-maroon/30 bg-maroon-light p-4">
      <p className="font-serif text-lg text-maroon">{approval.title}</p>
      <p className="mt-1 text-xs leading-5 text-ink/80">
        {approval.description}
      </p>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <dt className="text-greystone-dark">Assignment</dt>
        <dd className="font-medium text-ink">
          {approval.details.assignmentId}
        </dd>
        <dt className="text-greystone-dark">New end date</dt>
        <dd className="font-medium text-ink">
          {approval.details.newEndDate}
        </dd>
        <dt className="text-greystone-dark">Reason</dt>
        <dd className="font-medium text-ink">
          {approval.details.reason}
        </dd>
      </dl>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={onApprove}
          className="bg-maroon px-3 py-2 text-xs font-semibold text-white transition hover:bg-maroon-dark disabled:opacity-50"
        >
          Approve proposal
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={onCancel}
          className="border border-maroon/40 bg-white px-3 py-2 text-xs font-semibold text-maroon transition hover:border-maroon disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

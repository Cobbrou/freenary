import type { Comment } from "./github";
import type { SubjectKind } from "./questions";
import type { Gap, GapOwner } from "./readiness";

export const COMMENT_MARKER = "<!-- freenary-triage -->";

const SECTION_TITLE_BY_OWNER = {
  author: "For the author:",
  maintainer: "For a maintainer:",
  waiting: "Waiting for:",
} as const satisfies Record<GapOwner, string>;

const SECTION_ORDER: readonly GapOwner[] = ["author", "maintainer", "waiting"];

const SUBJECT_NAME = {
  issue: "issue",
  "pull-request": "pull request",
} as const satisfies Record<SubjectKind, string>;

export const renderGapComment = (
  kind: SubjectKind,
  gaps: readonly Gap[]
): string | undefined => {
  const actionable = gaps.some((gap) => gap.owner !== "waiting");

  if (!actionable) {
    return undefined;
  }

  const sections = SECTION_ORDER.flatMap((owner) => {
    const lines = gaps.flatMap((gap) =>
      gap.owner === owner ? [`- ${gap.text}`] : []
    );

    return lines.length > 0
      ? [SECTION_TITLE_BY_OWNER[owner], ...lines, ""]
      : [];
  });

  return [
    COMMENT_MARKER,
    `**Triage:** this ${SUBJECT_NAME[kind]} is not ready yet.`,
    "",
    ...sections,
    gaps.some((gap) => gap.owner === "author")
      ? "Edit the description or reply here, and triage runs again."
      : "Adding a `type:`, `impact:` or `priority:` label runs triage again; a maintainer setting a `priority:` label closes this list.",
  ].join("\n");
};

export type CommentAction =
  | { readonly kind: "create"; readonly body: string }
  | { readonly kind: "update"; readonly id: number; readonly body: string }
  | { readonly kind: "delete"; readonly id: number }
  | { readonly kind: "none" };

export interface CommentInput {
  readonly comments: readonly Comment[];
  readonly author: string;
  readonly body: string | undefined;
}

export const planCommentAction = ({
  author,
  body,
  comments,
}: CommentInput): CommentAction => {
  const existing = comments.find(
    (comment) =>
      comment.user?.login === author &&
      (comment.body ?? "").startsWith(COMMENT_MARKER)
  );

  if (body === undefined) {
    return existing ? { id: existing.id, kind: "delete" } : { kind: "none" };
  }

  if (!existing) {
    return { body, kind: "create" };
  }

  return existing.body === body
    ? { kind: "none" }
    : { body, id: existing.id, kind: "update" };
};

import type { MessagePart } from "../lib/message-parts";

interface RichTextProps {
  parts: readonly MessagePart[];
}

const PartText = ({ part }: { part: MessagePart }) => {
  if (part.emphasis === "plain") {
    return part.text;
  }

  if (part.emphasis === "link") {
    return (
      <a
        className="text-foreground underline underline-offset-2"
        href={part.href}
        rel="noopener noreferrer"
        target="_blank"
      >
        {part.text}
      </a>
    );
  }

  if (part.emphasis === "code") {
    return (
      <code className="bg-muted text-foreground rounded px-1 font-mono break-all">
        {part.text}
      </code>
    );
  }

  return <strong className="text-foreground font-medium">{part.text}</strong>;
};

export const RichText = ({ parts }: RichTextProps) => (
  <>
    {parts.map((part) => (
      <PartText key={part.position} part={part} />
    ))}
  </>
);

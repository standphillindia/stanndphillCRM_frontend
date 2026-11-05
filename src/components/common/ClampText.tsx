// src/components/common/ClampText.tsx
//
// Long text (a whole enquiry message, a full scope line used as a project
// name) cut to a few lines with "Read more" / "Show less". The full text is
// also on hover. Short text shows as it is, with no button.
// Used in the Leads, Projects, Payments and Completed Projects lists so long
// values don't stretch a row to half a screen.

import { useState } from "react";

interface Props {
  text: string | null | undefined;
  /** Lines shown before "Read more" (1–3). */
  lines?: 1 | 2 | 3;
  /** Longer than this many characters gets the "Read more" button. */
  minChars?: number;
  className?: string;
  buttonClassName?: string;
}

const CLAMP = { 1: "line-clamp-1", 2: "line-clamp-2", 3: "line-clamp-3" } as const;

export default function ClampText({
  text,
  lines = 2,
  minChars = 60,
  className = "",
  buttonClassName = "text-xs font-medium text-blue-600 hover:underline",
}: Props) {
  const [open, setOpen] = useState(false);
  if (!text) return <span className={className}>—</span>;
  const long = text.length > minChars;
  return (
    <>
      <span
        title={text}
        className={`block break-words whitespace-pre-line ${long && !open ? CLAMP[lines] : ""} ${className}`}
      >
        {text}
      </span>
      {long && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen((v) => !v);
          }}
          className={`mt-0.5 ${buttonClassName}`}
        >
          {open ? "Show less" : "Read more"}
        </button>
      )}
    </>
  );
}
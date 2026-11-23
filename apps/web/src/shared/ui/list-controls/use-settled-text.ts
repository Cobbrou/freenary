import { useEffect, useRef, useState } from "react";

import { useDebouncedValue } from "@/shared/lib/use-debounced-value";

const TYPING_SETTLE_MS = 300;

export const useSettledText = (
  urlText: string,
  onSettled: (text: string) => void
) => {
  const [draft, setDraft] = useState(urlText);
  const settledText = useDebouncedValue(draft, TYPING_SETTLE_MS);
  const publishedText = useRef(urlText);

  useEffect(() => {
    if (settledText === publishedText.current) {
      return;
    }

    publishedText.current = settledText;
    onSettled(settledText);
  }, [onSettled, settledText]);

  useEffect(() => {
    if (urlText !== publishedText.current) {
      publishedText.current = urlText;
      setDraft(urlText);
    }
  }, [urlText]);

  return { draft, setDraft };
};

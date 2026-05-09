"use client";

import { useState, useCallback } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

type CopyButtonProps = {
  getText: () => string;
  className?: string;
};

export function CopyButton({ getText, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(getText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [getText]);

  return (
    <Button variant="ghost" size="sm" className={className ?? "h-8"} onClick={handleCopy}>
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 mr-1 text-green-400" />
          Copied
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5 mr-1" />
          Copy
        </>
      )}
    </Button>
  );
}

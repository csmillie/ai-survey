"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ConfigJsonEditorProps {
  config: Record<string, unknown>;
  questionType: string;
  onConfigChange: (config: Record<string, unknown>, valid: boolean) => void;
  children: React.ReactNode;
}

export function ConfigJsonEditor({
  config,
  questionType,
  onConfigChange,
  children,
}: ConfigJsonEditorProps): React.ReactElement {
  const [showJson, setShowJson] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);

  // When switching TO JSON mode, serialize the current config
  const handleShowJson = useCallback((): void => {
    setJsonText(JSON.stringify(config, null, 2));
    setJsonError(null);
    setShowJson(true);
  }, [config]);

  // When switching back TO visual mode, parse and validate
  const handleShowVisual = useCallback((): void => {
    try {
      const parsed: unknown = JSON.parse(jsonText);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        setJsonError("JSON must be an object");
        return;
      }
      const result = parsed as Record<string, unknown>;
      result.type = questionType;
      onConfigChange(result, true);
      setJsonError(null);
      setShowJson(false);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Invalid JSON";
      setJsonError(message);
    }
  }, [jsonText, questionType, onConfigChange]);

  // Real-time validation on every keystroke
  const handleJsonChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
      const text = e.target.value;
      setJsonText(text);

      try {
        const parsed: unknown = JSON.parse(text);
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
          setJsonError("JSON must be an object");
          return;
        }
        const result = parsed as Record<string, unknown>;
        result.type = questionType;
        setJsonError(null);
        onConfigChange(result, true);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Invalid JSON";
        setJsonError(message);
      }
    },
    [questionType, onConfigChange],
  );

  if (showJson) {
    return (
      <div>
        <div className="flex justify-end mb-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleShowVisual}
            aria-expanded={showJson}
          >
            Show Visual
          </Button>
        </div>
        <div>
          <Textarea
            className="font-mono text-xs"
            rows={12}
            value={jsonText}
            onChange={handleJsonChange}
            aria-label="JSON configuration editor"
          />
          {jsonError !== null && (
            <p className="mt-1 text-xs text-red-500">{jsonError}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <Button
          variant="outline"
          size="sm"
          onClick={handleShowJson}
          aria-expanded={showJson}
        >
          Show JSON
        </Button>
      </div>
      {children}
    </div>
  );
}

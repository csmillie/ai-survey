"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { SentimentBadge } from "./shared-components";
import type { ResponseData } from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SideBySideViewProps {
  responses: ResponseData[];
  questionType: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SideBySideView({ responses, questionType }: SideBySideViewProps): React.JSX.Element {
  const isRanked = questionType === "RANKED";

  // Compute common and unique entities across all responses
  const { commonEntities, uniqueEntities } = useMemo(() => {
    const allEntities = responses.map((r) => {
      const set = new Set<string>();
      if (r.entities) {
        for (const p of r.entities.people) set.add(p);
        for (const p of r.entities.places) set.add(p);
        for (const o of r.entities.organizations) set.add(o);
      }
      for (const b of r.brandMentions) set.add(b);
      for (const i of r.institutionMentions) set.add(i);
      return set;
    });

    const common = new Set<string>();
    const unique = new Map<string, string[]>();

    if (allEntities.length > 0) {
      // Common: entities present in ALL responses
      for (const entity of allEntities[0]) {
        if (allEntities.every((s) => s.has(entity))) {
          common.add(entity);
        }
      }

      // Unique: entities present in only ONE response
      for (let i = 0; i < responses.length; i++) {
        const onlyHere: string[] = [];
        for (const entity of allEntities[i]) {
          if (common.has(entity)) continue;
          const othersHave = allEntities.some(
            (s, j) => j !== i && s.has(entity)
          );
          if (!othersHave) {
            onlyHere.push(entity);
          }
        }
        if (onlyHere.length > 0) {
          unique.set(responses[i].modelName, onlyHere);
        }
      }
    }

    return { commonEntities: [...common], uniqueEntities: unique };
  }, [responses]);

  return (
    <div className="space-y-4">
      {/* Model cards grid */}
      <div
        className="grid gap-4 overflow-x-auto"
        style={{
          gridTemplateColumns: `repeat(${Math.min(responses.length, 4)}, minmax(220px, 1fr))`,
        }}
      >
        {responses.map((resp) => (
          <ModelCard
            key={resp.id}
            response={resp}
            isRanked={isRanked}
          />
        ))}
      </div>

      {/* Entity agreement section */}
      {(commonEntities.length > 0 || uniqueEntities.size > 0) && (
        <div className="space-y-2 rounded-lg border border-[hsl(var(--border))] p-4">
          <h4 className="text-sm font-medium">Entity Agreement</h4>

          {commonEntities.length > 0 && (
            <div>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                Common themes (all models):
              </p>
              <div className="mt-1 flex flex-wrap gap-1">
                {commonEntities.map((e) => (
                  <Badge key={e} variant="default">
                    {e}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {[...uniqueEntities.entries()].map(([model, entities]) => (
            <div key={model}>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                Unique to {model}:
              </p>
              <div className="mt-1 flex flex-wrap gap-1">
                {entities.map((e) => (
                  <Badge key={e} variant="outline">
                    {e}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ModelCard
// ---------------------------------------------------------------------------

function ModelCard({
  response,
  isRanked,
}: {
  response: ResponseData;
  isRanked: boolean;
}): React.JSX.Element {
  const borderColor =
    response.verificationStatus === "VERIFIED"
      ? "border-green-500/50"
      : response.verificationStatus === "INACCURATE"
        ? "border-red-500/50"
        : "border-[hsl(var(--border))]";

  return (
    <div
      className={`flex flex-col gap-3 rounded-lg border p-4 ${borderColor}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="font-medium text-sm">{response.modelName}</span>
          <span className="ml-1.5 text-xs text-[hsl(var(--muted-foreground))]">
            {response.provider}
          </span>
        </div>
        {response.verificationStatus !== "UNREVIEWED" && (
          <Badge
            variant={
              response.verificationStatus === "VERIFIED"
                ? "default"
                : "destructive"
            }
          >
            {response.verificationStatus === "VERIFIED"
              ? "Verified"
              : "Flagged"}
          </Badge>
        )}
      </div>

      {/* Score bar or answer */}
      {isRanked && response.score !== null && response.questionConfig ? (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold">
              {response.score} / {response.questionConfig.scaleMax}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-[hsl(var(--muted))]">
            <div
              className={`h-full rounded-full ${scoreColor(
                response.score,
                response.questionConfig.scaleMin,
                response.questionConfig.scaleMax
              )}`}
              style={{
                width: `${Math.min(
                  100,
                  Math.max(
                    0,
                    ((response.score - response.questionConfig.scaleMin) /
                      (response.questionConfig.scaleMax -
                        response.questionConfig.scaleMin)) *
                      100
                  )
                )}%`,
              }}
            />
          </div>
        </div>
      ) : (
        <p className="text-sm leading-relaxed line-clamp-6">
          {response.answerText}
        </p>
      )}

      {/* Sentiment badge */}
      {response.sentimentScore !== null && (
        <div>
          <SentimentBadge score={response.sentimentScore} />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function scoreColor(score: number, min: number, max: number): string {
  const pct = max > min ? ((score - min) / (max - min)) * 100 : 0;
  if (pct >= 70) return "bg-green-500";
  if (pct >= 40) return "bg-yellow-500";
  return "bg-red-500";
}

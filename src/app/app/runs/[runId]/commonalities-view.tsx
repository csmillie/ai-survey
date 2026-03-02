"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { ModelLabel } from "./shared-components";
import type { ResponseData } from "./types";
import {
  analyzeCommonalities,
  type CommonalitiesResult,
  type ConsensusStrength,
} from "@/lib/analysis/commonalities";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CommonalitiesViewProps {
  responses: ResponseData[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function consensusBadgeVariant(
  strength: ConsensusStrength
): "default" | "secondary" | "destructive" {
  switch (strength) {
    case "HIGH":
      return "default";
    case "MEDIUM":
      return "secondary";
    case "LOW":
      return "destructive";
  }
}

function strengthPercent(strength: number): string {
  return `${Math.round(strength * 100)}%`;
}

function findProvider(
  responses: ResponseData[],
  modelName: string
): string {
  const match = responses.find((r) => r.modelName === modelName);
  return match ? match.provider : modelName;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CommonalitiesView({
  responses,
}: CommonalitiesViewProps): React.JSX.Element | null {
  const result: CommonalitiesResult = useMemo(() => {
    const modelResponses = responses.map((r) => ({
      modelKey: r.modelName,
      text: r.answerText,
      entities: r.entities ?? undefined,
    }));
    return analyzeCommonalities(modelResponses);
  }, [responses]);

  const hasContent =
    result.consensusPoints.length > 0 ||
    result.sharedEntities.length > 0 ||
    result.sharedKeyphrases.length > 0;

  if (!hasContent) return null;

  return (
    <div className="mt-4 space-y-4">
      {/* Header with consensus strength badge */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Commonalities</h3>
        <Badge variant={consensusBadgeVariant(result.consensusStrength)}>
          {result.consensusStrength} Consensus
        </Badge>
      </div>

      {/* Consensus Points */}
      {result.consensusPoints.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
            Consensus Points
          </h4>
          {result.consensusPoints.map((cluster) => {
            const uniqueModels = [
              ...new Set(cluster.members.map((m) => m.modelKey)),
            ];
            return (
              <Card key={cluster.id}>
                <CardHeader className="pb-2 pt-3 px-4">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm font-normal leading-relaxed">
                      {cluster.representative}
                    </CardTitle>
                    <Badge variant="secondary" className="shrink-0">
                      {uniqueModels.length}/{responses.length}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-3 pt-0">
                  <div className="flex flex-wrap gap-1">
                    {uniqueModels.map((modelKey) => (
                      <span
                        key={modelKey}
                        className="inline-flex items-center rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-xs"
                      >
                        <ModelLabel
                          modelName={modelKey}
                          provider={findProvider(responses, modelKey)}
                        />
                      </span>
                    ))}
                  </div>
                  <div className="mt-1">
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">
                      Strength: {strengthPercent(cluster.strength)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Shared Entities */}
      {result.sharedEntities.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
            Shared Entities
          </h4>
          <div className="flex flex-wrap gap-2">
            {result.sharedEntities.map((entity) => (
              <Badge
                key={`${entity.type}-${entity.text}`}
                variant="outline"
                title={`${entity.type} — mentioned by ${entity.models.join(", ")}`}
              >
                {entity.text}
                <span className="ml-1 text-[hsl(var(--muted-foreground))]">
                  ({entity.type}, {entity.count}/{responses.length})
                </span>
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Shared Keyphrases */}
      {result.sharedKeyphrases.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
            Shared Keyphrases
          </h4>
          <div className="flex flex-wrap gap-2">
            {result.sharedKeyphrases.slice(0, 15).map((kp) => (
              <Badge
                key={kp.phrase}
                variant="secondary"
                title={`Shared by ${kp.models.join(", ")}`}
              >
                {kp.phrase}
                <span className="ml-1 text-[hsl(var(--muted-foreground))]">
                  ({kp.count})
                </span>
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

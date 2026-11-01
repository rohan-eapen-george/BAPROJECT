"use client";

import { useEffect, useState } from "react";
import { ModelArtifact } from "./model";

export function useModel() {
  const [model, setModel] = useState<ModelArtifact | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/model/model.json", { signal: controller.signal, cache: "force-cache" })
      .then((response) => {
        if (!response.ok) throw new Error("The calibrated model could not be loaded.");
        return response.json() as Promise<ModelArtifact>;
      })
      .then(setModel)
      .catch((caught: unknown) => {
        if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : "The model could not be loaded.");
      });
    return () => controller.abort();
  }, []);
  return { model, error, loading: !model && !error };
}

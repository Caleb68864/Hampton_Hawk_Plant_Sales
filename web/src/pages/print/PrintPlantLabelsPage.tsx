import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { plantsApi } from '@/api/plants.js';
import { PlantLabel } from '@/components/print/PlantLabel.js';
import { ErrorBanner } from '@/components/shared/ErrorBanner.js';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner.js';
import type { Plant } from '@/types/plant.js';

function parsePlantIds(params: URLSearchParams): string[] {
  return (params.get('ids') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

export function PrintPlantLabelsPage() {
  const [searchParams] = useSearchParams();
  const plantIds = useMemo(() => parsePlantIds(searchParams), [searchParams]);

  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (plantIds.length === 0) {
      setPlants([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    Promise.all(plantIds.map((id) => plantsApi.getById(id)))
      .then((results) => setPlants(results))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load plant labels'))
      .finally(() => setLoading(false));
  }, [plantIds]);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorBanner message={error} onDismiss={() => setError(null)} />;

  return (
    <div className="print-label-page">
      <div className="no-print print-toolbar">
        <a href="/plants" className="text-sm text-blue-600 hover:text-blue-700">&larr; Back to Plants</a>
        <button
          type="button"
          className="px-4 py-2 text-sm font-medium text-white bg-hawk-600 rounded-md hover:bg-hawk-700"
          onClick={() => window.print()}
        >
          Print Labels
        </button>
      </div>

      {plants.length === 0 ? (
        <div className="no-print rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
          No plants selected. Select one or more plants from the Plants list to print labels.
        </div>
      ) : (
        <section className="label-sheet" aria-label="Plant labels">
          {plants.map((plant) => (
            <PlantLabel key={plant.id} plant={plant} />
          ))}
        </section>
      )}
    </div>
  );
}

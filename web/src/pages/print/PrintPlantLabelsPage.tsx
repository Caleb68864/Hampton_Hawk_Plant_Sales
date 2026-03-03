import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { plantsApi } from '@/api/plants.js';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner.js';
import { ErrorBanner } from '@/components/shared/ErrorBanner.js';
import { PrintLayout } from '@/components/print/PrintLayout.js';
import type { Plant } from '@/types/plant.js';

type DensityMode = 'test' | 'sheet' | 'roll';

function BarcodeSvg({ value }: { value: string }) {
  const bars = Array.from(value || '0').flatMap((char, index) => {
    const seed = char.charCodeAt(0) + index * 17;
    return [1, 2, 3, 2, 1, 3].map((multiplier, patternIndex) => ({
      width: ((seed >> patternIndex) & 1 ? 2 : 1) * multiplier,
      dark: patternIndex % 2 === 0,
      key: `${char}-${index}-${patternIndex}`,
    }));
  });

  const totalWidth = bars.reduce((sum, bar) => sum + bar.width, 0) || 1;
  let offset = 0;

  return (
    <svg viewBox={`0 0 ${totalWidth} 32`} className="w-full h-8" preserveAspectRatio="none" aria-label={`Barcode ${value}`}>
      {bars.map((bar) => {
        const x = offset;
        offset += bar.width;
        if (!bar.dark) return null;
        return <rect key={bar.key} x={x} y={0} width={bar.width} height={32} fill="black" />;
      })}
    </svg>
  );
}

function truncateLabel(text: string, maxLength = 36) {
  if (text.length <= maxLength) return text;
  const slice = text.slice(0, maxLength - 1);
  const lastSpace = slice.lastIndexOf(' ');
  if (lastSpace > 16) return `${slice.slice(0, lastSpace)}…`;
  return `${slice}…`;
}

function PlantLabel({ plant }: { plant: Plant }) {
  return (
    <div
      className="border border-black rounded-sm p-1.5 flex flex-col justify-between overflow-hidden"
      style={{ width: '2in', height: '1in' }}
    >
      <BarcodeSvg value={plant.barcode || plant.sku} />
      <p className="text-[9px] leading-tight font-medium tracking-tight">{truncateLabel(plant.name)}</p>
      <div className="flex items-end justify-between gap-2">
        <p className="text-[18px] leading-none font-bold tracking-tight">{plant.sku}</p>
        <p className="text-[8px] font-mono text-gray-700">{plant.barcode}</p>
      </div>
    </div>
  );
}

async function loadAllPlants() {
  const all: Plant[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const result = await plantsApi.list({ page, pageSize: 200 });
    all.push(...result.items);
    totalPages = result.totalPages;
    page += 1;
  }

  return all;
}

export function PrintPlantLabelsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const density = (searchParams.get('density') as DensityMode | null) ?? 'test';
  const plantId = searchParams.get('plantId');
  const skuCsv = searchParams.get('skus') ?? '';
  const barcodeCsv = searchParams.get('barcodes') ?? '';

  const repeats = density === 'test' ? 1 : density === 'sheet' ? 30 : 80;

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      try {
        if (plantId) {
          const plant = await plantsApi.getById(plantId);
          setPlants([plant]);
          return;
        }

        const requestedSkus = skuCsv
          .split(',')
          .map((x) => x.trim().toLowerCase())
          .filter(Boolean);

        const requestedBarcodes = barcodeCsv
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean);

        if (requestedSkus.length === 0 && requestedBarcodes.length === 0) {
          const result = await plantsApi.list({ page: 1, pageSize: 24, activeOnly: true });
          setPlants(result.items);
          return;
        }

        const inventory = await loadAllPlants();
        const bySku = new Map(inventory.map((p) => [p.sku.toLowerCase(), p]));
        const byBarcode = new Map(inventory.map((p) => [p.barcode, p]));

        const matched = [
          ...requestedSkus.map((sku) => bySku.get(sku)).filter((p): p is Plant => Boolean(p)),
          ...requestedBarcodes.map((barcode) => byBarcode.get(barcode)).filter((p): p is Plant => Boolean(p)),
        ];

        const deduped = Array.from(new Map(matched.map((p) => [p.id, p])).values());
        setPlants(deduped);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load labels');
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [plantId, skuCsv, barcodeCsv]);

  const labelsToRender = useMemo(() => {
    if (plants.length === 0) return [];
    if (density === 'test') return plants.slice(0, 1);

    const output: Plant[] = [];
    for (let i = 0; i < repeats; i += 1) {
      output.push(plants[i % plants.length]);
    }

    return output;
  }, [density, plants, repeats]);

  function updateDensity(nextDensity: DensityMode) {
    const next = new URLSearchParams(searchParams);
    next.set('density', nextDensity);
    setSearchParams(next, { replace: true });
  }

  if (loading) return <LoadingSpinner message="Loading labels..." />;
  if (error) return <ErrorBanner message={error} />;

  return (
    <PrintLayout backTo={plantId ? `/plants/${plantId}` : '/imports'}>
      <div className="no-print mb-4 rounded-md border border-gray-300 bg-gray-50 p-3">
        <h1 className="text-lg font-semibold text-gray-800">Plant Labels (1&quot; x 2&quot;)</h1>
        <div className="mt-2 flex flex-wrap items-center gap-4 text-sm">
          <span className="font-medium text-gray-700">Density:</span>
          {([
            { value: 'test', label: '1-up Test' },
            { value: 'sheet', label: 'Full Sheet (30)' },
            { value: 'roll', label: 'Full Roll (80)' },
          ] as { value: DensityMode; label: string }[]).map((option) => (
            <label key={option.value} className="inline-flex items-center gap-2 text-gray-700">
              <input
                type="radio"
                checked={density === option.value}
                onChange={() => updateDensity(option.value)}
              />
              {option.label}
            </label>
          ))}
        </div>
        <p className="mt-3 text-xs text-gray-600">
          Calibration hints: use 100% scale, disable “Fit to page”, and verify top/left offsets with 1-up test before running a full batch.
        </p>
      </div>

      {labelsToRender.length === 0 ? (
        <p className="text-sm text-gray-600">No plants found for label printing.</p>
      ) : (
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(2in, 1fr))' }}>
          {labelsToRender.map((plant, index) => (
            <PlantLabel key={`${plant.id}-${index}`} plant={plant} />
          ))}
        </div>
      )}
    </PrintLayout>
  );
}

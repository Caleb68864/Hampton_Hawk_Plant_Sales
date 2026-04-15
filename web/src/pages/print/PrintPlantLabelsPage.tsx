import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { plantsApi } from '@/api/plants.js';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner.js';
import { ErrorBanner } from '@/components/shared/ErrorBanner.js';
import { PrintLayout } from '@/components/print/PrintLayout.js';
import { PlantLabel } from '@/components/print/PlantLabel.js';
import type { Plant } from '@/types/plant.js';

type DensityMode = 'test' | 'sheet' | 'roll';

type LabelPreset = {
  label: string;
  count: number;
};

function isDensityMode(value: string | null): value is DensityMode {
  return value === 'test' || value === 'sheet' || value === 'roll';
}

function parsePositiveInteger(value: string | null) {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseCsvValues(value: string) {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
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

function buildPresetCounts(density: DensityMode, selectedPlantCount: number): LabelPreset[] {
  if (density === 'test') return [];

  const minimumCount = Math.max(selectedPlantCount, 1);
  const baseCounts = density === 'sheet' ? [30, 60, 90] : [80, 160, 240];
  const unitLabel = density === 'sheet' ? 'sheet' : 'roll';

  const presets: LabelPreset[] = [
    {
      label: selectedPlantCount > 1 ? `All selected (${minimumCount})` : '1 label',
      count: minimumCount,
    },
  ];

  baseCounts.forEach((baseCount, index) => {
    const normalizedCount = Math.max(baseCount, minimumCount);
    const quantity = index + 1;
    presets.push({
      label: `${quantity} ${unitLabel}${quantity === 1 ? '' : 's'} (${normalizedCount})`,
      count: normalizedCount,
    });
  });

  return presets;
}

export function PrintPlantLabelsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const densityParam = searchParams.get('density');
  const countParam = searchParams.get('count');
  const plantId = searchParams.get('plantId');
  const idsCsv = searchParams.get('ids') ?? '';
  const skuCsv = searchParams.get('skus') ?? '';
  const barcodeCsv = searchParams.get('barcodes') ?? '';

  const requestedIds = useMemo(() => parseCsvValues(idsCsv), [idsCsv]);
  const requestedSkus = useMemo(() => parseCsvValues(skuCsv).map((value) => value.toLowerCase()), [skuCsv]);
  const requestedBarcodes = useMemo(() => parseCsvValues(barcodeCsv), [barcodeCsv]);
  const requestedLabelCount = parsePositiveInteger(countParam);

  const requestedCount = (plantId ? 1 : 0) + requestedIds.length + requestedSkus.length + requestedBarcodes.length;
  const density: DensityMode = isDensityMode(densityParam) ? densityParam : requestedCount === 1 ? 'test' : 'sheet';

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

        if (requestedIds.length > 0) {
          const requestedPlants = await Promise.all(
            requestedIds.map(async (requestedId) => {
              try {
                return await plantsApi.getById(requestedId);
              } catch {
                return null;
              }
            }),
          );
          setPlants(requestedPlants.filter((plant): plant is Plant => Boolean(plant)));
          return;
        }

        if (requestedSkus.length === 0 && requestedBarcodes.length === 0) {
          const result = await plantsApi.list({ page: 1, pageSize: 24, activeOnly: true });
          setPlants(result.items);
          return;
        }

        const inventory = await loadAllPlants();
        const bySku = new Map(inventory.map((plant) => [plant.sku.toLowerCase(), plant]));
        const byBarcode = new Map(inventory.map((plant) => [plant.barcode, plant]));

        const matched = [
          ...requestedSkus.map((sku) => bySku.get(sku)).filter((plant): plant is Plant => Boolean(plant)),
          ...requestedBarcodes.map((barcode) => byBarcode.get(barcode)).filter((plant): plant is Plant => Boolean(plant)),
        ];

        const deduped = Array.from(new Map(matched.map((plant) => [plant.id, plant])).values());
        setPlants(deduped);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load labels');
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [plantId, requestedBarcodes, requestedIds, requestedSkus]);

  const minimumLabelCount = useMemo(() => (density === 'test' ? 1 : Math.max(plants.length, 1)), [density, plants.length]);

  const defaultLabelCount = useMemo(() => {
    if (plants.length === 0) return 0;
    if (density === 'test') return 1;
    const baseCount = density === 'sheet' ? 30 : 80;
    return Math.max(baseCount, minimumLabelCount);
  }, [density, minimumLabelCount, plants.length]);

  const labelCount = density === 'test'
    ? 1
    : Math.max(requestedLabelCount ?? defaultLabelCount, minimumLabelCount);

  const labelPresets = useMemo(() => buildPresetCounts(density, plants.length), [density, plants.length]);

  const labelsToRender = useMemo(() => {
    if (plants.length === 0) return [];
    if (density === 'test') return plants.slice(0, 1);

    return Array.from({ length: labelCount }, (_, index) => plants[index % plants.length]);
  }, [density, labelCount, plants]);

  const densityHint = density === 'test'
    ? 'Single-label alignment test.'
    : density === 'sheet'
      ? 'Letter-sheet preview with labels laid out across full sheets.'
      : 'Thermal-roll preview with one label per printer page step.';

  const printCss = useMemo(() => {
    const pageRule = density === 'sheet'
      ? '@page { size: letter portrait; margin: 0.35in; }'
      : '@page { size: 2in 1in; margin: 0; }';

    const itemBreakRule = density === 'roll'
      ? '.label-roll-item { break-after: page; page-break-after: always; } .label-roll-item:last-child { break-after: auto; page-break-after: auto; }'
      : density === 'test'
        ? '.label-test-item { break-after: auto; page-break-after: auto; }'
        : '';

    return `
      .plant-label-print-layout {
        max-width: 56rem;
      }

      .label-sheet-preview {
        display: flex;
        flex-wrap: wrap;
        gap: 0.12in;
        width: min(100%, 6.5in);
        margin: 0 auto;
        justify-content: flex-start;
      }

      .label-sheet-item {
        flex: 0 0 2in;
        width: 2in;
        display: flex;
        justify-content: center;
      }

      .label-roll-preview,
      .label-test-preview {
        width: min(100%, 2.35in);
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.18in;
      }

      .label-roll-item,
      .label-test-item {
        width: 2in;
        display: flex;
        justify-content: center;
      }

      @media print {
        ${pageRule}

        .plant-label-print-layout {
          max-width: none !important;
          margin: 0 !important;
          padding: 0 !important;
        }

        .label-sheet-preview,
        .label-roll-preview,
        .label-test-preview {
          margin: 0 auto;
        }

        .label-sheet-preview {
          width: 6.5in;
          gap: 0.08in;
        }

        .label-sheet-item {
          break-inside: avoid;
          page-break-inside: avoid;
        }

        .label-roll-preview,
        .label-test-preview {
          width: 2in;
          gap: 0;
        }

        .label-roll-item,
        .label-test-item {
          width: 2in;
        }

        ${itemBreakRule}
      }
    `;
  }, [density]);

  function updateDensity(nextDensity: DensityMode) {
    const next = new URLSearchParams(searchParams);
    next.set('density', nextDensity);
    setSearchParams(next, { replace: true });
  }

  function updateLabelCount(nextValue: string) {
    const parsed = parsePositiveInteger(nextValue);
    if (!parsed) return;

    const normalizedCount = Math.max(parsed, minimumLabelCount);
    const next = new URLSearchParams(searchParams);
    if (normalizedCount === defaultLabelCount) {
      next.delete('count');
    } else {
      next.set('count', String(normalizedCount));
    }
    setSearchParams(next, { replace: true });
  }

  function applyPreset(count: number) {
    updateLabelCount(String(count));
  }

  const backTo = plantId ? `/plants/${plantId}` : idsCsv ? '/plants' : '/imports';
  const previewClassName = density === 'sheet' ? 'label-sheet-preview' : density === 'roll' ? 'label-roll-preview' : 'label-test-preview';
  const itemClassName = density === 'sheet' ? 'label-sheet-item' : density === 'roll' ? 'label-roll-item' : 'label-test-item';

  if (loading) return <LoadingSpinner message="Loading labels..." />;
  if (error) return <ErrorBanner message={error} />;

  return (
    <PrintLayout backTo={backTo} className="plant-label-print-layout">
      <style>{printCss}</style>

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
        {density !== 'test' && (
          <>
            <div className="mt-3 flex flex-wrap gap-2">
              {labelPresets.map((preset) => {
                const isActive = labelCount === preset.count;
                return (
                  <button
                    key={`${density}-${preset.count}-${preset.label}`}
                    type="button"
                    className={`rounded-md border px-3 py-1.5 text-xs font-medium ${isActive ? 'border-hawk-600 bg-hawk-600 text-white' : 'border-gray-300 text-gray-700 hover:bg-gray-100'}`}
                    onClick={() => applyPreset(preset.count)}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-gray-700">
              <label className="inline-flex items-center gap-2">
                <span className="font-medium">Labels to print:</span>
                <input
                  type="number"
                  min={minimumLabelCount}
                  step={1}
                  value={labelCount}
                  onChange={(event) => updateLabelCount(event.target.value)}
                  className="w-24 rounded-md border border-gray-300 px-2 py-1"
                />
              </label>
              <button
                type="button"
                className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                onClick={() => applyPreset(defaultLabelCount)}
              >
                Reset to default ({defaultLabelCount})
              </button>
            </div>
          </>
        )}
        <p className="mt-3 text-xs text-gray-600">{densityHint}</p>
        {density !== 'test' && (
          <>
            <p className="mt-1 text-xs text-gray-600">
              Rendering {labelCount} label{labelCount === 1 ? '' : 's'} for {plants.length} selected plant{plants.length === 1 ? '' : 's'}.
            </p>
            {plants.length > 1 && (
              <p className="mt-1 text-xs text-gray-600">
                Every selected plant prints at least once. Extra labels repeat in selection order.
              </p>
            )}
          </>
        )}
        <p className="mt-1 text-xs text-gray-600">
          Calibration hints: use 100% scale, disable "Fit to page", and verify top/left offsets with 1-up test before running a full batch.
        </p>
      </div>

      {labelsToRender.length === 0 ? (
        <p className="text-sm text-gray-600">No plants found for label printing.</p>
      ) : (
        <div className={previewClassName}>
          {labelsToRender.map((plant, index) => (
            <div key={`${plant.id}-${index}`} className={itemClassName}>
              <PlantLabel plant={plant} />
            </div>
          ))}
        </div>
      )}
    </PrintLayout>
  );
}

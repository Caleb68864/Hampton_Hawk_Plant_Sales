export type PickupAutoJumpMode = 'ExactMatchOnly' | 'BestMatchWhenSingle';

export interface AppSettings {
  saleClosed: boolean;
  saleClosedAt: string | null;

  // Scanner tuning fields (added in SS-02 / consumed in SS-09)
  pickupSearchDebounceMs?: number;
  pickupAutoJumpMode?: PickupAutoJumpMode;
  pickupMultiScanEnabled?: boolean;
}

export interface UpdateScannerTuningRequest {
  pickupSearchDebounceMs?: number;
  pickupAutoJumpMode?: PickupAutoJumpMode;
  pickupMultiScanEnabled?: boolean;
}

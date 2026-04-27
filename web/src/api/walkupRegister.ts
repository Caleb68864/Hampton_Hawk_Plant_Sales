/**
 * Walk-Up Register API Client
 * Consumes the WalkUpRegisterController endpoints from SS-07.
 *
 * Routes (from api/walkup-register):
 *   POST   /draft                                   -> CreateDraft
 *   POST   /draft/{id}/scan                         -> ScanIntoDraft
 *   PATCH  /draft/{id}/lines/{lineId}               -> AdjustLine
 *   DELETE /draft/{id}/lines/{lineId}               -> VoidLine (admin pin)
 *   POST   /draft/{id}/close                        -> CloseDraft
 *   POST   /draft/{id}/cancel                       -> CancelDraft (admin pin)
 *   GET    /draft/open?workstationName=...          -> GetOpenDrafts
 */
import {
  get,
  post,
  patch,
  patchWithHeaders,
  delWithHeaders,
  postWithHeaders,
} from './client.js';
import type {
  DraftOrder,
  CreateDraftRequest,
  ScanIntoDraftRequest,
  AdjustLineRequest,
  CloseDraftRequest,
} from '@/types/walkupRegister.js';

const BASE_PATH = '/walkup-register';

export const walkupRegisterApi = {
  /** Create a new draft order for a workstation. */
  createDraft: (data: CreateDraftRequest = {}) =>
    post<DraftOrder>(`${BASE_PATH}/draft`, data),

  /**
   * Scan a plant barcode into a draft. The client must supply a stable scanId
   * (crypto.randomUUID()) so the backend can dedupe retries. Optional
   * `quantity` drives multi-quantity scanning (set N, scan once); the backend
   * caps at walk-up availability + on-hand inventory and returns the actual
   * applied amount in the resulting line. Defaults to 1.
   */
  scan: (draftId: string, data: ScanIntoDraftRequest) =>
    post<DraftOrder>(`${BASE_PATH}/draft/${draftId}/scan`, {
      ...data,
      quantity: data.quantity && data.quantity > 0 ? data.quantity : 1,
    }),

  /**
   * Adjust a line. The backend may require admin pin/reason if increasing past
   * walk-up availability; pass them through when present.
   */
  adjustLine: (
    draftId: string,
    lineId: string,
    data: AdjustLineRequest,
    adminPin?: string,
    adminReason?: string,
  ) => {
    if (adminPin) {
      return patchWithHeaders<DraftOrder>(
        `${BASE_PATH}/draft/${draftId}/lines/${lineId}`,
        data,
        {
          'X-Admin-Pin': adminPin,
          'X-Admin-Reason': adminReason ?? '',
        },
      );
    }
    return patch<DraftOrder>(
      `${BASE_PATH}/draft/${draftId}/lines/${lineId}`,
      data,
    );
  },

  /** Void a line (admin pin required). */
  voidLine: (
    draftId: string,
    lineId: string,
    adminPin: string,
    adminReason: string,
  ) =>
    delWithHeaders<DraftOrder>(
      `${BASE_PATH}/draft/${draftId}/lines/${lineId}`,
      {
        'X-Admin-Pin': adminPin,
        'X-Admin-Reason': adminReason,
      },
    ),

  /** Close (finalize) the draft. Captures payment metadata. */
  close: (draftId: string, data: CloseDraftRequest) =>
    post<DraftOrder>(`${BASE_PATH}/draft/${draftId}/close`, data),

  /** Cancel the draft (admin pin required). */
  cancel: (draftId: string, adminPin: string, adminReason: string) =>
    postWithHeaders<DraftOrder>(
      `${BASE_PATH}/draft/${draftId}/cancel`,
      {},
      {
        'X-Admin-Pin': adminPin,
        'X-Admin-Reason': adminReason,
      },
    ),

  /** List open drafts, optionally scoped to a workstation. */
  getOpenDrafts: (workstationName?: string) =>
    get<DraftOrder[]>(
      `${BASE_PATH}/draft/open`,
      workstationName ? { workstationName } : undefined,
    ),
};

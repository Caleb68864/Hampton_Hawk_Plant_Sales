/**
 * Walk-Up Register API Client
 * Consumes the WalkUpRegisterController endpoints from SS-07
 */
import { get, post, postWithHeaders, delWithHeaders } from './client.js';
import type {
  DraftOrder,
  CreateDraftRequest,
  ScanIntoDraftRequest,
  ScanIntoDraftResponse,
  AdjustLineRequest,
  CloseDraftRequest,
  CancelDraftRequest,
} from '@/types/walkupRegister.js';

const BASE_PATH = '/walkup-register';

export const walkupRegisterApi = {
  /**
   * Create a new draft order for a workstation
   */
  createDraft: (data: CreateDraftRequest) =>
    post<DraftOrder>(`${BASE_PATH}/draft`, data),

  /**
   * Get a draft by ID
   */
  getDraft: (draftId: string) =>
    get<DraftOrder>(`${BASE_PATH}/draft/${draftId}`),

  /**
   * Scan a plant barcode into a draft
   * Uses idempotency key (scanId) for safe retries
   */
  scan: (draftId: string, data: ScanIntoDraftRequest) =>
    post<ScanIntoDraftResponse>(`${BASE_PATH}/draft/${draftId}/scan`, data),

  /**
   * Adjust line quantity (admin-only)
   */
  adjustLine: (draftId: string, lineId: string, data: AdjustLineRequest, adminPin: string, adminReason: string) =>
    postWithHeaders<DraftOrder>(
      `${BASE_PATH}/draft/${draftId}/lines/${lineId}/adjust`,
      data,
      {
        'X-Admin-Pin': adminPin,
        'X-Admin-Reason': adminReason,
      },
    ),

  /**
   * Void a line (admin-only)
   */
  voidLine: (draftId: string, lineId: string, adminPin: string, adminReason: string) =>
    delWithHeaders<DraftOrder>(
      `${BASE_PATH}/draft/${draftId}/lines/${lineId}`,
      {
        'X-Admin-Pin': adminPin,
        'X-Admin-Reason': adminReason,
      },
    ),

  /**
   * Close a draft (finalize sale)
   */
  close: (draftId: string, data: CloseDraftRequest) =>
    post<DraftOrder>(`${BASE_PATH}/draft/${draftId}/close`, data),

  /**
   * Cancel a draft (admin-only)
   */
  cancel: (draftId: string, data: CancelDraftRequest, adminPin: string, adminReason: string) =>
    postWithHeaders<DraftOrder>(
      `${BASE_PATH}/draft/${draftId}/cancel`,
      data,
      {
        'X-Admin-Pin': adminPin,
        'X-Admin-Reason': adminReason,
      },
    ),

  /**
   * Get open drafts for a workstation
   */
  getOpenDrafts: (workstationName?: string) =>
    get<DraftOrder[]>(`${BASE_PATH}/draft/open`, workstationName ? { workstationName } : undefined),
};

interface ErrorPattern {
  pattern: RegExp;
  whatHappened: string;
  whatToDoNext: string;
}

export interface ActionableErrorMessage {
  whatHappened: string;
  whatToDoNext: string;
  details?: string;
}

const defaultMessage: Omit<ActionableErrorMessage, 'details'> = {
  whatHappened: 'Something went wrong while processing your request.',
  whatToDoNext: 'Try again. If this keeps happening, ask an admin to review the technical details.',
};

// Top recurring API/UI errors observed in logs, normalized to action-based messages.
const topErrorPatterns: ErrorPattern[] = [
  { pattern: /sale is closed/i, whatHappened: 'Sales are currently closed.', whatToDoNext: 'Ask an admin to reopen sales or wait until sales reopen.' },
  { pattern: /not on this order|wrong order/i, whatHappened: 'That item does not belong to this order.', whatToDoNext: 'Confirm the order number or add the item to this order before scanning again.' },
  { pattern: /out of stock/i, whatHappened: 'This item is out of stock.', whatToDoNext: 'Set aside the item and ask an admin to adjust inventory or substitute another item.' },
  { pattern: /barcode not found/i, whatHappened: 'The scanned barcode is not in the plant catalog.', whatToDoNext: 'Rescan the label carefully, or ask an admin to add/fix the catalog entry.' },
  { pattern: /already fulfilled/i, whatHappened: 'This line is already fully fulfilled.', whatToDoNext: 'Move to the next item, or use Undo if the previous scan was a mistake.' },
  { pattern: /concurrent scan conflict|deadlock|serialize access|concurrent update/i, whatHappened: 'Another station updated this order at the same time.', whatToDoNext: 'Wait a moment and scan again.' },
  { pattern: /order not found/i, whatHappened: 'We could not find that order.', whatToDoNext: 'Verify the order number, then search again.' },
  { pattern: /no accepted scan found to undo/i, whatHappened: 'There is no recent accepted scan to undo.', whatToDoNext: 'Scan an item first, or confirm you are on the correct order.' },
  { pattern: /cannot undo event without a plant reference/i, whatHappened: 'The last scan cannot be safely undone.', whatToDoNext: 'Ask an admin to review fulfillment history before retrying.' },
  { pattern: /order line or inventory not found for undo/i, whatHappened: 'Undo could not be completed because order data changed.', whatToDoNext: 'Refresh the order and try again. If it still fails, ask an admin to review inventory records.' },
  { pattern: /cannot complete order: not all lines are fully fulfilled/i, whatHappened: 'The order still has unfulfilled items.', whatToDoNext: 'Finish scanning remaining items or use admin force-complete if approved.' },
  { pattern: /only completed orders can be reset/i, whatHappened: 'This order is not eligible for reset.', whatToDoNext: 'Complete the order first, then try reset again.' },
  { pattern: /invalid admin pin|admin pin required|forbidden/i, whatHappened: 'Admin verification failed.', whatToDoNext: 'Re-enter a valid admin PIN and reason to continue.' },
  { pattern: /duplicate sku/i, whatHappened: 'That SKU is already in use.', whatToDoNext: 'Use a unique SKU value before saving.' },
  { pattern: /duplicate barcode|barcode .*already exists/i, whatHappened: 'That barcode is already in use.', whatToDoNext: 'Use a unique barcode value before saving.' },
  { pattern: /validation/i, whatHappened: 'Some fields are invalid or missing.', whatToDoNext: 'Review required fields and correct any highlighted values.' },
  { pattern: /failed to load/i, whatHappened: 'The page data could not be loaded.', whatToDoNext: 'Refresh the page. If it still fails, check network status and try again.' },
  { pattern: /failed to save|failed to update|failed to create|failed to delete/i, whatHappened: 'Your change was not saved.', whatToDoNext: 'Retry the action. If it keeps failing, ask an admin to review technical details.' },
  { pattern: /network error|network/i, whatHappened: 'The app could not reach the server.', whatToDoNext: 'Check the network connection and retry.' },
  { pattern: /timeout|timed out/i, whatHappened: 'The request took too long and timed out.', whatToDoNext: 'Try again in a few seconds.' },
];

export function mapToActionableError(rawMessage: string): ActionableErrorMessage {
  const normalized = rawMessage.trim();
  const matched = topErrorPatterns.find((entry) => entry.pattern.test(normalized));
  return {
    whatHappened: matched?.whatHappened ?? defaultMessage.whatHappened,
    whatToDoNext: matched?.whatToDoNext ?? defaultMessage.whatToDoNext,
    details: normalized || undefined,
  };
}

export function toBannerMessage(error: ActionableErrorMessage): string {
  const detailsText = error.details ? `\nTechnical details: ${error.details}` : '';
  return `What happened: ${error.whatHappened}\nWhat to do next: ${error.whatToDoNext}${detailsText}`;
}


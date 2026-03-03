import type { Meta, StoryObj } from '@storybook/react';
import { OrderLinesTable } from '@/components/OrderLinesTable.js';
import type { OrderLine } from '@/types/order.js';

const meta: Meta<typeof OrderLinesTable> = {
  title: 'Orders/OrderLinesTable',
  component: OrderLinesTable,
};

export default meta;
type Story = StoryObj<typeof OrderLinesTable>;

const makeLine = (overrides: Partial<OrderLine> = {}): OrderLine => ({
  id: crypto.randomUUID(),
  orderId: crypto.randomUUID(),
  plantCatalogId: crypto.randomUUID(),
  plantName: 'Red Maple',
  plantSku: 'RM-001',
  qtyOrdered: 5,
  qtyFulfilled: 0,
  notes: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

export const Empty: Story = {
  args: { lines: [] },
};

export const WithLines: Story = {
  args: {
    lines: [
      makeLine({ plantName: 'Red Maple', plantSku: 'RM-001', qtyOrdered: 5, qtyFulfilled: 2 }),
      makeLine({ plantName: 'Blue Spruce', plantSku: 'BS-002', qtyOrdered: 3, qtyFulfilled: 0 }),
      makeLine({ plantName: 'White Oak', plantSku: 'WO-003', qtyOrdered: 10, qtyFulfilled: 7 }),
    ],
  },
};

export const FullyFulfilled: Story = {
  args: {
    lines: [
      makeLine({ plantName: 'Red Maple', plantSku: 'RM-001', qtyOrdered: 5, qtyFulfilled: 5 }),
      makeLine({ plantName: 'Blue Spruce', plantSku: 'BS-002', qtyOrdered: 3, qtyFulfilled: 3 }),
    ],
  },
};

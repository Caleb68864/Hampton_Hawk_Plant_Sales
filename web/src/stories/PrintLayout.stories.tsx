import type { Meta, StoryObj } from '@storybook/react';
import { PrintLayout } from '@/components/print/PrintLayout.js';

const meta: Meta<typeof PrintLayout> = {
  title: 'Print/PrintLayout',
  component: PrintLayout,
};

export default meta;
type Story = StoryObj<typeof PrintLayout>;

export const WithSampleContent: Story = {
  args: {
    backTo: '/orders',
    children: (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Order #ORD-001</h1>
        <p className="text-gray-600">Customer: Jane Smith</p>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Plant</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            <tr>
              <td className="px-4 py-2 text-sm">Red Maple</td>
              <td className="px-4 py-2 text-sm text-right">5</td>
            </tr>
            <tr>
              <td className="px-4 py-2 text-sm">Blue Spruce</td>
              <td className="px-4 py-2 text-sm text-right">3</td>
            </tr>
          </tbody>
        </table>
      </div>
    ),
  },
};

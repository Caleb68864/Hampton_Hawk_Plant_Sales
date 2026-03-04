import type { Meta, StoryObj } from '@storybook/react';
import { QuickFindOverlay } from '@/components/shared/QuickFindOverlay.js';
import { BrowserRouter } from 'react-router-dom';

const meta: Meta<typeof QuickFindOverlay> = {
  title: 'Shared/QuickFindOverlay',
  component: QuickFindOverlay,
  decorators: [
    (Story) => (
      <BrowserRouter>
        <p className="text-sm text-gray-500 mb-4">Press Ctrl+K to open the overlay (customers, orders, plants, sellers)</p>
        <Story />
      </BrowserRouter>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof QuickFindOverlay>;

export const Default: Story = {};

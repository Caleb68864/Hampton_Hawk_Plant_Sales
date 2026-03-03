import type { Meta, StoryObj } from '@storybook/react';
import { ScanInput } from '@/components/pickup/ScanInput.js';

const meta: Meta<typeof ScanInput> = {
  title: 'Pickup/ScanInput',
  component: ScanInput,
  args: {
    onScan: (barcode: string) => console.log('Scanned:', barcode),
  },
};

export default meta;
type Story = StoryObj<typeof ScanInput>;

export const Default: Story = {};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};

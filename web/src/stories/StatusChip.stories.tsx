import type { Meta, StoryObj } from '@storybook/react';
import { StatusChip } from '@/components/shared/StatusChip.js';

const meta: Meta<typeof StatusChip> = {
  title: 'Shared/StatusChip',
  component: StatusChip,
};

export default meta;
type Story = StoryObj<typeof StatusChip>;

export const Open: Story = {
  args: { status: 'Open' },
};

export const InProgress: Story = {
  args: { status: 'InProgress' },
};

export const Complete: Story = {
  args: { status: 'Complete' },
};

export const Cancelled: Story = {
  args: { status: 'Cancelled' },
};

export const WithIssue: Story = {
  args: { status: 'InProgress', hasIssue: true },
};

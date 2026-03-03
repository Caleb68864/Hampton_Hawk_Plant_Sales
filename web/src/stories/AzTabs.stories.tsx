import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { AzTabs } from '@/components/shared/AzTabs.js';

const meta: Meta<typeof AzTabs> = {
  title: 'Shared/AzTabs',
  component: AzTabs,
};

export default meta;
type Story = StoryObj<typeof AzTabs>;

function AzTabsWithState({ initial }: { initial: string | null }) {
  const [selected, setSelected] = useState<string | null>(initial);
  return <AzTabs selected={selected} onSelect={setSelected} />;
}

export const Default: Story = {
  render: () => <AzTabsWithState initial={null} />,
};

export const WithActiveTab: Story = {
  render: () => <AzTabsWithState initial="M" />,
};

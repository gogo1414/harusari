
import type { Meta, StoryObj } from '@storybook/react';
import { AnimatedNumber, AnimatedCurrency, AnimatedPercent, CountUp } from './AnimatedNumber';

const meta: Meta<typeof AnimatedNumber> = {
  title: 'Components/AnimatedNumber',
  component: AnimatedNumber,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof AnimatedNumber>;

export const Default: Story = {
  args: {
    value: 12345,
  },
};

export const Currency: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <AnimatedCurrency value={1000000} showSign type="income" className="text-2xl font-bold" />
      <AnimatedCurrency value={-50000} showSign type="expense" className="text-2xl font-bold" />
      <AnimatedCurrency value={0} showSign type="neutral" className="text-2xl font-bold" />
    </div>
  ),
};

export const Percent: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <AnimatedPercent value={12.5} className="text-xl" />
      <AnimatedPercent value={-5.2} className="text-xl text-red-500" />
      <AnimatedPercent value={100} decimals={0} className="text-xl font-bold" />
    </div>
  ),
};

export const CountUpDemo: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
       <div className='text-4xl font-bold'>
          <CountUp end={100} duration={2} />
       </div>
       <div className='text-4xl font-bold text-primary'>
          <CountUp start={500} end={1000} duration={1} />
       </div>
    </div>
  ),
};

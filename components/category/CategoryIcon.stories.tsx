
import type { Meta, StoryObj } from '@storybook/react';
import { CategoryIcon } from './IconPicker';

const meta: Meta<typeof CategoryIcon> = {
  title: 'Components/CategoryIcon',
  component: CategoryIcon,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'circle', 'squircle'],
    },
    showBackground: {
      control: 'boolean',
    },
  },
};

export default meta;
type Story = StoryObj<typeof CategoryIcon>;

export const Default: Story = {
  args: {
    iconName: 'food',
    showBackground: true,
    variant: 'squircle',
    className: 'h-12 w-12',
  },
};

export const Circle: Story = {
  args: {
    iconName: 'cafe',
    showBackground: true,
    variant: 'circle',
    className: 'h-12 w-12',
  },
};

export const WithoutBackground: Story = {
  args: {
    iconName: 'transport',
    showBackground: false,
    className: 'h-12 w-12',
  },
};

export const EmojiIcon: Story = {
  args: {
    iconName: '🍔',
    showBackground: true,
    variant: 'squircle',
    className: 'h-12 w-12',
  },
};

export const AllIcons: Story = {
  render: () => (
    <div className="grid grid-cols-6 gap-4">
      {['food', 'cafe', 'alcohol', 'transport', 'shopping', 'home', 
        'medical', 'education', 'salary', 'gift', 'love', 'money'].map((icon) => (
        <div key={icon} className="flex flex-col items-center gap-2">
          <CategoryIcon 
            iconName={icon} 
            showBackground={true} 
            variant="squircle" 
            className="h-10 w-10" 
          />
          <span className="text-xs text-gray-500">{icon}</span>
        </div>
      ))}
    </div>
  ),
};

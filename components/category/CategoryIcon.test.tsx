import { render, screen } from '@testing-library/react';
import { CategoryIcon } from '@/app/components/IconPicker';

describe('CategoryIcon', () => {
  it('renders a matched Lucide icon', () => {
    // 'food' maps to Utensils in ICON_MAP
    const { container } = render(<CategoryIcon iconName="food" />);
    // Check if SVG exists
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders an emoji correctly', () => {
    const emoji = '🍔';
    render(<CategoryIcon iconName={emoji} />);
    expect(screen.getByText(emoji)).toBeInTheDocument();
  });

  it('renders fallback icon for unknown name', () => {
    const { container } = render(<CategoryIcon iconName="unknown_icon_name" />);
    // Should render DollarSign (SVG)
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders with background when showBackground is true', () => {
    const { container } = render(<CategoryIcon iconName="food" showBackground={true} />);
    // Check if style attribute exists and contains background-color
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveAttribute('style');
    expect(wrapper.style.backgroundColor).not.toBe('');
  });

  it('renders circular shape when variant is circle', () => {
    const { container } = render(<CategoryIcon iconName="food" variant="circle" />);
    expect(container.firstChild).toHaveClass('rounded-full');
  });
});

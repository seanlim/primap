import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EmptyState } from '@/components/ui/empty-state'

const MockIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} data-testid="icon" />
)

describe('EmptyState', () => {
  it('renders title', () => {
    render(<EmptyState title="No items found" />)
    expect(screen.getByText('No items found')).toBeInTheDocument()
  })

  it('renders description when provided', () => {
    render(<EmptyState title="No items" description="Try adding something" />)
    expect(screen.getByText('Try adding something')).toBeInTheDocument()
  })

  it('does not render description when not provided', () => {
    const { container } = render(<EmptyState title="No items" />)
    const descriptions = container.querySelectorAll('.text-sm.text-gray-400')
    expect(descriptions).toHaveLength(0)
  })

  it('renders icon when provided', () => {
    render(<EmptyState title="No items" icon={MockIcon} />)
    expect(screen.getByTestId('icon')).toBeInTheDocument()
  })

  it('does not render icon when not provided', () => {
    render(<EmptyState title="No items" />)
    expect(screen.queryByTestId('icon')).not.toBeInTheDocument()
  })

  it('renders link action with href', () => {
    render(
      <EmptyState
        title="No items"
        action={{ label: 'Go home', href: '/home' }}
      />
    )
    const link = screen.getByText('Go home')
    expect(link.tagName).toBe('A')
    expect(link).toHaveAttribute('href', '/home')
  })

  it('renders button action with onClick', () => {
    const onClick = vi.fn()
    render(
      <EmptyState title="No items" action={{ label: 'Add item', onClick }} />
    )
    const button = screen.getByText('Add item')
    expect(button.tagName).toBe('BUTTON')
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('does not render action when not provided', () => {
    const { container } = render(<EmptyState title="No items" />)
    expect(container.querySelector('a')).not.toBeInTheDocument()
    expect(container.querySelector('button')).not.toBeInTheDocument()
  })
})

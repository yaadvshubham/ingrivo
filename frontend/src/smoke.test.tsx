import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

describe('Smoke test', () => {
  it('renders a simple div', () => {
    render(<div>Hello Vitest</div>)
    expect(screen.getByText('Hello Vitest')).toBeInTheDocument()
  })
})

import type { Job } from '@occ/shared'
import { fireEvent, render, screen } from '@testing-library/react-native'

import { JobCard } from './JobCard'

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 'job-1',
    title: 'Backend Engineer',
    company: 'Acme Corp',
    city: 'CDMX',
    salary: 35000,
    description: 'desc',
    publishedAt: '2026-01-01T00:00:00.000Z',
    tags: ['remote', 'senior'],
    ...overrides,
  }
}

describe('JobCard', () => {
  it('renders title, company, and city (R9)', () => {
    render(<JobCard job={makeJob()} onPress={jest.fn()} />)

    expect(screen.getByText('Backend Engineer')).toBeTruthy()
    expect(screen.getByText('Acme Corp · CDMX')).toBeTruthy()
  })

  it('renders a formatted salary line when salary is present (R9)', () => {
    render(<JobCard job={makeJob({ salary: 35000 })} onPress={jest.fn()} />)

    // Exact currency formatting is locale/ICU-dependent; assert the numeric
    // magnitude is present rather than the exact separator/symbol string.
    expect(screen.getByText(/35,?000/)).toBeTruthy()
  })

  it('omits the salary line entirely when salary is null (R9)', () => {
    render(<JobCard job={makeJob({ salary: null })} onPress={jest.fn()} />)

    expect(screen.queryByText(/35,?000/)).toBeNull()
  })

  it('renders tags as badges', () => {
    render(<JobCard job={makeJob({ tags: ['remote', 'senior'] })} onPress={jest.fn()} />)

    expect(screen.getByText('remote')).toBeTruthy()
    expect(screen.getByText('senior')).toBeTruthy()
  })

  it('calls onPress when tapped (R9)', () => {
    const onPress = jest.fn()
    render(<JobCard job={makeJob()} onPress={onPress} />)

    fireEvent.press(screen.getByRole('button'))

    expect(onPress).toHaveBeenCalledTimes(1)
  })
})

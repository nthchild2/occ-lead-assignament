import type { Job } from '@occ/shared'
import { fireEvent, render, screen } from '@testing-library/react-native'

import { JobCardSkeleton } from '../../../../core/components'
import { ActivityList, type ActivityRow } from './ActivityList'

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 'job-1',
    title: 'Backend Engineer',
    company: 'Acme Corp',
    city: 'Ciudad de México',
    salary: 35000,
    description: 'desc',
    publishedAt: '2026-01-01T00:00:00.000Z',
    tags: ['remote'],
    ...overrides,
  }
}

function makeRow(overrides: Partial<ActivityRow> = {}): ActivityRow {
  const job = makeJob(overrides.job ? { ...overrides.job } : {})
  return { id: job.id, job, ...overrides }
}

describe('ActivityList', () => {
  it('renders JobCardSkeleton placeholders when loading and rows is empty', () => {
    render(
      <ActivityList
        rows={[]}
        isLoading={true}
        error={null}
        onRetry={jest.fn()}
        onPress={jest.fn()}
        onRemove={jest.fn()}
        removeLabel="Cancelar"
        emptyTitle="Sin resultados"
      />,
    )

    expect(screen.UNSAFE_getAllByType(JobCardSkeleton).length).toBeGreaterThan(0)
    expect(screen.queryByText('Sin resultados')).toBeNull()
    expect(screen.queryByText('No se pudo cargar la información')).toBeNull()
  })

  it('renders ErrorState and pressing retry calls onRetry when error and rows is empty', () => {
    const onRetry = jest.fn()
    render(
      <ActivityList
        rows={[]}
        isLoading={false}
        error="Network down"
        onRetry={onRetry}
        onPress={jest.fn()}
        onRemove={jest.fn()}
        removeLabel="Cancelar"
        emptyTitle="Sin resultados"
      />,
    )

    expect(screen.getByText('No se pudo cargar la información')).toBeTruthy()
    expect(screen.getByText('Network down')).toBeTruthy()

    fireEvent.press(screen.getByText('Reintentar'))

    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('renders EmptyState with the given title/description when not loading, no error, and rows is empty', () => {
    render(
      <ActivityList
        rows={[]}
        isLoading={false}
        error={null}
        onRetry={jest.fn()}
        onPress={jest.fn()}
        onRemove={jest.fn()}
        removeLabel="Cancelar"
        emptyTitle="Sin postulaciones"
        emptyDescription="Aún no tienes postulaciones."
      />,
    )

    expect(screen.getByText('Sin postulaciones')).toBeTruthy()
    expect(screen.getByText('Aún no tienes postulaciones.')).toBeTruthy()
  })

  it('renders one row per item when rows are present', () => {
    const rows = [
      makeRow({ job: makeJob({ id: 'a', title: 'Job A' }) }),
      makeRow({ job: makeJob({ id: 'b', title: 'Job B' }) }),
    ]
    render(
      <ActivityList
        rows={rows}
        isLoading={false}
        error={null}
        onRetry={jest.fn()}
        onPress={jest.fn()}
        onRemove={jest.fn()}
        removeLabel="Cancelar"
        emptyTitle="Sin resultados"
      />,
    )

    expect(screen.getByText('Job A')).toBeTruthy()
    expect(screen.getByText('Job B')).toBeTruthy()
  })

  it('tapping a JobCard calls onPress with that row and index, not onRemove', () => {
    const onPress = jest.fn()
    const onRemove = jest.fn()
    const rows = [
      makeRow({ id: 'row-a', job: makeJob({ id: 'a', title: 'Job A' }) }),
      makeRow({ id: 'row-b', job: makeJob({ id: 'b', title: 'Job B' }) }),
    ]
    render(
      <ActivityList
        rows={rows}
        isLoading={false}
        error={null}
        onRetry={jest.fn()}
        onPress={onPress}
        onRemove={onRemove}
        removeLabel="Cancelar"
        emptyTitle="Sin resultados"
      />,
    )

    fireEvent.press(screen.getByText('Job B'))

    expect(onPress).toHaveBeenCalledTimes(1)
    expect(onPress).toHaveBeenCalledWith(rows[1], 1)
    expect(onRemove).not.toHaveBeenCalled()
  })

  it('tapping the remove Button calls onRemove with that row id, and does NOT also trigger onPress (sibling, not nested, Pressables)', () => {
    const onPress = jest.fn()
    const onRemove = jest.fn()
    const rows = [
      makeRow({ id: 'row-a', job: makeJob({ id: 'a', title: 'Job A' }) }),
      makeRow({ id: 'row-b', job: makeJob({ id: 'b', title: 'Job B' }) }),
    ]
    render(
      <ActivityList
        rows={rows}
        isLoading={false}
        error={null}
        onRetry={jest.fn()}
        onPress={onPress}
        onRemove={onRemove}
        removeLabel="Cancelar"
        emptyTitle="Sin resultados"
      />,
    )

    fireEvent.press(screen.getByLabelText('Cancelar Job B'))

    expect(onRemove).toHaveBeenCalledTimes(1)
    expect(onRemove).toHaveBeenCalledWith('row-b')
    expect(onPress).not.toHaveBeenCalled()
  })
})

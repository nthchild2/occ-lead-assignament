import type { Job } from '@occ/shared'
import { render } from '@testing-library/react-native'
import React from 'react'
import { Text } from 'react-native'

import {
  ActivityList,
  Avatar,
  Badge,
  Button,
  Card,
  CollapsibleHeader,
  EmptyState,
  ErrorState,
  Input,
  JobCard,
  JobCardSkeleton,
  Select,
  Skeleton,
} from './index'

// A4 Decision 1 (snapshot policy): every component in the `core/components/`
// library carries a snapshot for regression detection. Behavioral assertions
// live in each component's own co-located test (e.g. `JobCard.test.tsx`);
// this suite only pins the rendered output of the library as a whole, so an
// unintended visual/structural change to a "done" component fails loudly in
// the diff instead of slipping through. Per the policy in A4: snapshots are
// reviewed on intentional changes, never blindly `--updateSnapshot`-ed.

const job: Job = {
  id: 'job-1',
  title: 'React Native Developer',
  company: 'OCC',
  city: 'Ciudad de México',
  salary: 45000,
  description: 'Desarrollo de la app móvil.',
  publishedAt: '2026-07-01T12:00:00.000Z',
  tags: ['react-native', 'typescript', 'remoto'],
}

const noop = jest.fn()

describe('core/components snapshots (A4 snapshot policy)', () => {
  it('ActivityList — populated row with remove action', () => {
    expect(
      render(
        <ActivityList
          rows={[{ id: job.id, job }]}
          isLoading={false}
          error={null}
          onRetry={noop}
          onPress={noop}
          onRemove={noop}
          removeLabel="Cancelar"
          emptyTitle="Sin postulaciones"
        />,
      ).toJSON(),
    ).toMatchSnapshot()
  })

  it('Avatar — image variant', () => {
    expect(
      render(<Avatar uri="https://example.com/logo.png" fallback="OC" />).toJSON(),
    ).toMatchSnapshot()
  })

  it('Avatar — initials fallback variant', () => {
    expect(render(<Avatar fallback="OCC México" />).toJSON()).toMatchSnapshot()
  })

  it('Badge — default (ink) variant', () => {
    expect(render(<Badge label="remoto" />).toJSON()).toMatchSnapshot()
  })

  it('Badge — leaf variant (success chips)', () => {
    expect(render(<Badge label="Agregado a favoritos" variant="leaf" />).toJSON()).toMatchSnapshot()
  })

  it('Button — primary md', () => {
    expect(render(<Button label="Aplicar" onPress={noop} />).toJSON()).toMatchSnapshot()
  })

  it('Button — secondary disabled', () => {
    expect(
      render(<Button label="Ya aplicaste" variant="secondary" disabled onPress={noop} />).toJSON(),
    ).toMatchSnapshot()
  })

  it('Button — danger sm loading', () => {
    expect(
      render(
        <Button label="Cancelar" variant="danger" size="sm" loading onPress={noop} />,
      ).toJSON(),
    ).toMatchSnapshot()
  })

  it('Card — static', () => {
    expect(
      render(
        <Card>
          <Text>Contenido</Text>
        </Card>,
      ).toJSON(),
    ).toMatchSnapshot()
  })

  it('Card — pressable with a11y label/hint', () => {
    expect(
      render(
        <Card onPress={noop} accessibilityLabel="Tarjeta" accessibilityHint="Abre el detalle">
          <Text>Contenido</Text>
        </Card>,
      ).toJSON(),
    ).toMatchSnapshot()
  })

  it('EmptyState — with description and action', () => {
    expect(
      render(
        <EmptyState
          title="Sin resultados"
          description="Intenta ajustar tu búsqueda."
          actionLabel="Reintentar"
          onAction={noop}
        />,
      ).toJSON(),
    ).toMatchSnapshot()
  })

  it('ErrorState — default message', () => {
    expect(render(<ErrorState onRetry={noop} />).toJSON()).toMatchSnapshot()
  })

  it('Input — label, placeholder and hint', () => {
    expect(
      render(
        <Input label="Email" placeholder="tu@correo.com" hint="Usa tu correo corporativo" />,
      ).toJSON(),
    ).toMatchSnapshot()
  })

  it('Input — error state', () => {
    expect(render(<Input label="Password" error="Campo requerido" />).toJSON()).toMatchSnapshot()
  })

  it('JobCard — full job with salary and tags', () => {
    expect(render(<JobCard job={job} onPress={noop} />).toJSON()).toMatchSnapshot()
  })

  it('JobCard — job without salary', () => {
    expect(
      render(<JobCard job={{ ...job, salary: null }} onPress={noop} />).toJSON(),
    ).toMatchSnapshot()
  })

  it('JobCardSkeleton', () => {
    expect(render(<JobCardSkeleton />).toJSON()).toMatchSnapshot()
  })

  it('Select — closed with selection', () => {
    expect(
      render(
        <Select
          label="Ciudad"
          value="cdmx"
          options={[
            { label: 'Ciudad de México', value: 'cdmx' },
            { label: 'Guadalajara', value: 'gdl' },
          ]}
          onChange={noop}
        />,
      ).toJSON(),
    ).toMatchSnapshot()
  })

  it('Skeleton — custom size', () => {
    expect(render(<Skeleton width={120} height={24} />).toJSON()).toMatchSnapshot()
  })

  it('CollapsibleHeader — collapsed state', () => {
    expect(
      render(<CollapsibleHeader label="Filtros" isExpanded={false} onToggle={noop} />).toJSON(),
    ).toMatchSnapshot()
  })

  it('CollapsibleHeader — expanded state', () => {
    expect(
      render(<CollapsibleHeader label="Filtros" isExpanded onToggle={noop} />).toJSON(),
    ).toMatchSnapshot()
  })
})

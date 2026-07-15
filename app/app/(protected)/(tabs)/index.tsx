import type { Job, JobFilters } from '@occ/shared'
import { FlashList, type FlashListRef } from '@shopify/flash-list'
import type React from 'react'
import { useEffect, useRef, useState } from 'react'
import { Animated, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import {
  CollapsibleHeader,
  EmptyState,
  ErrorState,
  Input,
  JobCard,
  JobCardSkeleton,
  Select,
  type SelectOption,
} from '../../../core/components'
import { useDebounce } from '../../../core/hooks/useDebounce'
import { useTheme } from '../../../core/hooks/useTheme'
import type { Theme } from '../../../core/theme'
import { useJobs } from '../../../core/hooks/useJobs'
import { useJobsStore } from '../../../store/jobs.store'

const ALL_CITIES = '__all__'

// Matches `be-jobs`'s seed data (`backend/src/domains/jobs/jobs.seed.ts`) so
// the filter's options correspond to cities that actually appear in results.
const CITY_OPTIONS: SelectOption<string>[] = [
  { label: 'Todas las ciudades', value: ALL_CITIES },
  { label: 'Ciudad de México', value: 'Ciudad de México' },
  { label: 'Guadalajara', value: 'Guadalajara' },
  { label: 'Monterrey', value: 'Monterrey' },
  { label: 'Puebla', value: 'Puebla' },
  { label: 'Querétaro', value: 'Querétaro' },
  { label: 'Tijuana', value: 'Tijuana' },
  { label: 'Mérida', value: 'Mérida' },
  { label: 'León', value: 'León' },
  { label: 'Cancún', value: 'Cancún' },
  { label: 'Remoto', value: 'Remoto' },
]

const SORT_OPTIONS: SelectOption<NonNullable<JobFilters['sort']>>[] = [
  { label: 'Más recientes', value: 'date_desc' },
  { label: 'Más antiguos', value: 'date_asc' },
  { label: 'Salario: mayor a menor', value: 'salary_desc' },
  { label: 'Salario: menor a mayor', value: 'salary_asc' },
  { label: 'Relevancia', value: 'relevance' },
]

const SKELETON_COUNT = 5

function parseSalary(text: string): number | undefined {
  if (text.trim() === '') return undefined
  const parsed = Number(text)
  return Number.isNaN(parsed) ? undefined : parsed
}

interface FilterBarProps {
  theme: Theme
  searchText: string
  onSearchTextChange: (text: string) => void
  salaryMinText: string
  onSalaryMinTextChange: (text: string) => void
  salaryMaxText: string
  onSalaryMaxTextChange: (text: string) => void
  city: string
  onCityChange: (value: string) => void
  sort: NonNullable<JobFilters['sort']>
  onSortChange: (value: NonNullable<JobFilters['sort']>) => void
  isExpanded: boolean
  onToggleExpanded: () => void
}

// Extracted so the screen component's own branching stays under the
// complexity ceiling (mirrors `Button.tsx`'s helper-extraction pattern).
function FilterBar({
  theme,
  searchText,
  onSearchTextChange,
  salaryMinText,
  onSalaryMinTextChange,
  salaryMaxText,
  onSalaryMaxTextChange,
  city,
  onCityChange,
  sort,
  onSortChange,
  isExpanded,
  onToggleExpanded,
}: FilterBarProps) {
  const heightAnim = useRef(new Animated.Value(1)).current

  useEffect(() => {
    Animated.timing(heightAnim, {
      toValue: isExpanded ? 1 : 0,
      duration: theme.motion.base.duration,
      useNativeDriver: false,
    }).start()
  }, [isExpanded, heightAnim, theme.motion.base.duration])

  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        borderBottomColor: theme.colors.border,
        borderBottomWidth: 1,
      }}
    >
      <CollapsibleHeader label="Filtros" isExpanded={isExpanded} onToggle={onToggleExpanded} />

      <Animated.View
        style={{
          opacity: heightAnim,
          maxHeight: heightAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 500],
          }),
          overflow: 'hidden',
        }}
      >
        <View style={{ padding: theme.gutter, gap: theme.spacing[3] }}>
          <Input
            label="Buscar"
            placeholder="Puesto, empresa o palabra clave"
            value={searchText}
            onChangeText={onSearchTextChange}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={{ flexDirection: 'row', gap: theme.spacing[3] }}>
            <View style={{ flex: 1 }}>
              <Input
                label="Salario mín."
                placeholder="0"
                value={salaryMinText}
                onChangeText={onSalaryMinTextChange}
                keyboardType="numeric"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Input
                label="Salario máx."
                placeholder="Sin límite"
                value={salaryMaxText}
                onChangeText={onSalaryMaxTextChange}
                keyboardType="numeric"
              />
            </View>
          </View>
          <Select label="Ciudad" value={city} options={CITY_OPTIONS} onChange={onCityChange} />
          <Select label="Ordenar por" value={sort} options={SORT_OPTIONS} onChange={onSortChange} />
        </View>
      </Animated.View>
    </View>
  )
}

function ListContent({
  theme,
  jobs,
  isLoading,
  error,
  onRetry,
  onEndReached,
  onJobPress,
  onScroll,
  flashListRef,
}: {
  theme: Theme
  jobs: Job[]
  isLoading: boolean
  error: string | null
  onRetry: () => void
  onEndReached: () => void
  onJobPress: (job: Job, index: number) => void
  onScroll: () => void
  flashListRef: React.RefObject<FlashListRef<Job> | null>
}) {
  if (isLoading && jobs.length === 0) {
    return (
      <View style={{ paddingHorizontal: theme.gutter }}>
        {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
          <JobCardSkeleton key={i} />
        ))}
      </View>
    )
  }

  if (error && jobs.length === 0) {
    return <ErrorState message={error} onRetry={onRetry} />
  }

  if (!isLoading && jobs.length === 0) {
    return (
      <EmptyState title="Sin resultados" description="Intenta ajustar tu búsqueda o filtros." />
    )
  }

  return (
    <FlashList
      ref={flashListRef}
      data={jobs}
      renderItem={({ item, index }) => (
        <JobCard job={item} onPress={() => onJobPress(item, index)} />
      )}
      keyExtractor={(item) => item.id}
      getItemType={(item) => (item.salary ? 'with-salary' : 'without-salary')}
      drawDistance={250}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      onScroll={onScroll}
      contentContainerStyle={{ paddingHorizontal: theme.gutter, paddingBottom: theme.spacing[6] }}
    />
  )
}

export default function SearchScreen() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const { refetch, fetchNextPage } = useJobs()
  const jobs = useJobsStore((s) => s.jobs)
  const isLoading = useJobsStore((s) => s.isLoading)
  const error = useJobsStore((s) => s.error)
  // Subscribed (not directly rendered) so the screen re-renders whenever
  // pagination changes — e.g. after `fetchNextPage` appends a page, keeping
  // the FlashList's `data` prop and any future pagination UI in sync.
  useJobsStore((s) => s.pagination)

  const [searchText, setSearchText] = useState('')
  const [salaryMinText, setSalaryMinText] = useState('')
  const [salaryMaxText, setSalaryMaxText] = useState('')
  const [city, setCity] = useState(ALL_CITIES)
  const [sort, setSort] = useState<NonNullable<JobFilters['sort']>>('date_desc')
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(true)

  const debouncedSearch = useDebounce(searchText, 300)
  const debouncedSalaryMin = useDebounce(salaryMinText, 300)
  const debouncedSalaryMax = useDebounce(salaryMaxText, 300)

  const isFirstSearchRender = useRef(true)
  const isFirstSalaryRender = useRef(true)
  const isMounted = useRef(false)
  const flashListRef = useRef<FlashListRef<Job>>(null)

  // R7: registers this screen's FlashList ref into `jobs.store` once on
  // mount so `(protected)/_layout.tsx` (a different component tree) can
  // imperatively call `scrollToIndex` on sheet dismiss. Runs once — the ref
  // object itself is stable for the lifetime of this component.
  useEffect(() => {
    useJobsStore.getState().setFlashListRef(flashListRef)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (isFirstSearchRender.current) {
      isFirstSearchRender.current = false
      return
    }
    useJobsStore.getState().setFilters({ q: debouncedSearch || undefined })
    void refetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch])

  useEffect(() => {
    if (isFirstSalaryRender.current) {
      isFirstSalaryRender.current = false
      return
    }
    useJobsStore.getState().setFilters({
      salary_min: parseSalary(debouncedSalaryMin),
      salary_max: parseSalary(debouncedSalaryMax),
    })
    void refetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSalaryMin, debouncedSalaryMax])

  useEffect(() => {
    if (isMounted.current) return
    isMounted.current = true
    void refetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleCityChange(value: string): void {
    setCity(value)
    useJobsStore.getState().setFilters({ city: value === ALL_CITIES ? undefined : value })
    void refetch()
  }

  function handleSortChange(value: NonNullable<JobFilters['sort']>): void {
    setSort(value)
    useJobsStore.getState().setFilters({ sort: value })
    void refetch()
  }

  function handleJobPress(job: Job, index: number): void {
    useJobsStore.getState().setActiveJob(job.id, index)
  }

  function handleListScroll(): void {
    if (isFiltersExpanded) {
      setIsFiltersExpanded(false)
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <Text
        style={{
          fontFamily: theme.type.headingSm.fontFamily,
          fontSize: theme.type.headingSm.fontSize,
          color: theme.colors.fg,
          paddingHorizontal: theme.gutter,
          paddingTop: insets.top + theme.spacing[3],
          paddingBottom: theme.spacing[2],
        }}
      >
        Buscar empleos
      </Text>
      <FilterBar
        theme={theme}
        searchText={searchText}
        onSearchTextChange={setSearchText}
        salaryMinText={salaryMinText}
        onSalaryMinTextChange={setSalaryMinText}
        salaryMaxText={salaryMaxText}
        onSalaryMaxTextChange={setSalaryMaxText}
        city={city}
        onCityChange={handleCityChange}
        sort={sort}
        onSortChange={handleSortChange}
        isExpanded={isFiltersExpanded}
        onToggleExpanded={() => setIsFiltersExpanded(!isFiltersExpanded)}
      />
      <View style={{ flex: 1 }}>
        <ListContent
          theme={theme}
          jobs={jobs}
          isLoading={isLoading}
          error={error}
          onRetry={refetch}
          onEndReached={fetchNextPage}
          onJobPress={handleJobPress}
          onScroll={handleListScroll}
          flashListRef={flashListRef}
        />
      </View>
    </View>
  )
}

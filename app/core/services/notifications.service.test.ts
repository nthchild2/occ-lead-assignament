import notifee, { AndroidImportance } from '@notifee/react-native'
import { Platform } from 'react-native'

import { initNotificationChannel, triggerDemoJobNotification } from './notifications.service'

// Uses notifee's own shipped `jest-mock.js` (wired repo-wide via
// `moduleNameMapper` in `app/package.json`) — `createChannel`/
// `displayNotification` are already `jest.fn()`s, no hand-rolled mock needed
// (per `02-plan.md`'s explicit test boundary).
const mockedCreateChannel = notifee.createChannel as jest.Mock
const mockedDisplayNotification = notifee.displayNotification as jest.Mock

const originalOS = Platform.OS

afterEach(() => {
  jest.clearAllMocks()
  Platform.OS = originalOS
})

describe('initNotificationChannel (R1)', () => {
  it('creates the jobs channel with HIGH importance on Android', async () => {
    Platform.OS = 'android'

    await initNotificationChannel()

    expect(mockedCreateChannel).toHaveBeenCalledWith(
      expect.objectContaining({ importance: AndroidImportance.HIGH }),
    )
  })

  it('is a no-op on iOS', async () => {
    Platform.OS = 'ios'

    await initNotificationChannel()

    expect(mockedCreateChannel).not.toHaveBeenCalled()
  })
})

describe('triggerDemoJobNotification (R2)', () => {
  it('calls displayNotification with the job id in data and the demo title', async () => {
    await triggerDemoJobNotification('job-7')

    expect(mockedDisplayNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Nueva vacante para ti',
        data: { jobId: 'job-7' },
      }),
    )
  })
})

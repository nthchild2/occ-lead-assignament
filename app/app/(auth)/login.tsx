import { LoginRequestSchema } from '@occ/shared'
import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native'

import { Button, Input } from '../../core/components'
import { useTheme } from '../../core/hooks/useTheme'
import { useAuthStore } from '../../store/auth.store'

interface FieldErrors {
  email?: string
  password?: string
}

// Maps the first Zod validation issue to the offending field. Issues without
// a recognized `path[0]` (shouldn't happen given `LoginRequestSchema`'s two
// independently-validated fields, but guarded per the plan's risk note) fall
// through to the caller's `formError` instead of being silently dropped.
function mapIssueToFieldErrors(issue: { path: PropertyKey[]; message: string }): FieldErrors {
  const field = issue.path[0]
  if (field === 'email') return { email: issue.message }
  if (field === 'password') return { password: issue.message }
  return {}
}

export default function LoginScreen() {
  const theme = useTheme()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | undefined>(undefined)

  async function handleSubmit() {
    setFormError(undefined)

    const result = LoginRequestSchema.safeParse({ email, password })
    if (!result.success) {
      setFieldErrors(mapIssueToFieldErrors(result.error.issues[0]))
      return
    }
    setFieldErrors({})

    setIsSubmitting(true)
    try {
      await useAuthStore.getState().login(email, password)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, justifyContent: 'center', padding: theme.spacing[6] }}
      >
        <Text
          style={{
            fontFamily: theme.type.headingSm.fontFamily,
            fontSize: theme.type.headingSm.fontSize,
            color: theme.colors.fg,
            marginBottom: theme.spacing[6],
          }}
        >
          Iniciar sesión
        </Text>

        <View style={{ marginBottom: theme.spacing[4] }}>
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            error={fieldErrors.email}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={{ marginBottom: theme.spacing[4] }}>
          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            error={fieldErrors.password}
            secureTextEntry
          />
        </View>

        {formError ? (
          <Text
            style={{
              fontFamily: theme.type.caption.fontFamily,
              fontSize: theme.type.caption.fontSize,
              color: theme.colors.danger,
              marginBottom: theme.spacing[4],
            }}
          >
            {formError}
          </Text>
        ) : null}

        <Button label="Iniciar sesión" loading={isSubmitting} onPress={handleSubmit} />
      </KeyboardAvoidingView>
    </View>
  )
}

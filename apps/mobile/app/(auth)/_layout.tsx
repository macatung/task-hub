import React from 'react';
import { Stack } from 'expo-router';
import { colors } from '@/theme/colors';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.midnight[950],
        },
        headerTintColor: colors.phantom.cyan,
        headerTitleStyle: {
          fontWeight: '600',
          color: colors.textPrimary,
        },
        contentStyle: {
          backgroundColor: colors.midnight[950],
        },
      }}
    >
      <Stack.Screen name="login" options={{ title: 'Connect to Task Hub' }} />
      <Stack.Screen name="scan-pair" options={{ title: 'Pair Device' }} />
    </Stack>
  );
}

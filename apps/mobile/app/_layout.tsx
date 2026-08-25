import '../global.css';
import React, { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { Stack } from 'expo-router';
import { View } from 'react-native';
import { colors } from '@/theme/colors';

export default function RootLayout() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            gcTime: 1000 * 60 * 60 * 24, // 24 hours
            retry: 2,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="light" backgroundColor={colors.midnight[950]} />
        <View className="flex-1 bg-midnight-950">
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
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen
              name="tasks/[id]"
              options={{ title: 'Task Details', presentation: 'card' }}
            />
            <Stack.Screen
              name="tasks/new"
              options={{ title: 'New Task', presentation: 'modal' }}
            />
            <Stack.Screen
              name="agent-runs/[id]"
              options={{ title: 'Live Stream Logs', presentation: 'card' }}
            />
            <Stack.Screen
              name="agent-runs/[id]/review"
              options={{ title: 'Handoff Review', presentation: 'modal' }}
            />
            <Stack.Screen
              name="scanner"
              options={{ title: 'Scan QR Code', presentation: 'fullScreenModal' }}
            />
          </Stack>
        </View>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

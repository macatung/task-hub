import React from 'react';
import { Tabs } from 'expo-router';
import { LayoutDashboard, Zap, CheckSquare, Activity, Settings } from 'lucide-react-native';
import { colors } from '@/theme/colors';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.midnight[950],
          borderBottomWidth: 1,
          borderBottomColor: colors.midnight[800],
        },
        headerTintColor: colors.phantom.cyan,
        headerTitleStyle: {
          fontWeight: '600',
          color: colors.textPrimary,
        },
        tabBarStyle: {
          backgroundColor: colors.midnight[900],
          borderTopColor: colors.midnight[800],
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarActiveTintColor: colors.phantom.cyan,
        tabBarInactiveTintColor: colors.textMuted,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Workspaces',
          tabBarLabel: 'Workspaces',
          tabBarIcon: ({ color, size }) => <LayoutDashboard color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="sprints"
        options={{
          title: 'Sprints',
          tabBarLabel: 'Sprints',
          tabBarIcon: ({ color, size }) => <Zap color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Tasks',
          tabBarLabel: 'Tasks',
          tabBarIcon: ({ color, size }) => <CheckSquare color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="telemetry"
        options={{
          title: 'Telemetry',
          tabBarLabel: 'Telemetry',
          tabBarIcon: ({ color, size }) => <Activity color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color, size }) => <Settings color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}

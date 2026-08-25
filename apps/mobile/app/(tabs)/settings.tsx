import React, { useState } from 'react';
import { View, Text, ScrollView, Switch } from 'react-native';
import { Shield, Smartphone, Server } from 'lucide-react-native';
import { env } from '@/config/env';
import { colors } from '@/theme/colors';

export default function SettingsScreen() {
  const [biometricsEnabled, setBiometricsEnabled] = useState(true);

  return (
    <ScrollView className="flex-1 bg-midnight-950 p-4">
      <View className="mb-6">
        <Text className="text-xl font-bold text-slate-100">Settings & Security</Text>
        <Text className="text-xs text-slate-400">Configuration and device credentials</Text>
      </View>

      <View className="bg-midnight-850 rounded-xl border border-midnight-700 p-4 mb-4">
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center flex-1 mr-2">
            <Shield size={18} color={colors.phantom.cyan} />
            <View className="ml-3">
              <Text className="text-sm font-semibold text-slate-100">Biometric Approval Gate</Text>
              <Text className="text-xs text-slate-400">Require FaceID/TouchID for handoffs</Text>
            </View>
          </View>
          <Switch
            value={biometricsEnabled}
            onValueChange={setBiometricsEnabled}
            trackColor={{ false: colors.midnight[700], true: colors.phantom.cyan }}
            thumbColor={colors.midnight[950]}
          />
        </View>

        <View className="border-t border-midnight-700 pt-3">
          <View className="flex-row items-center">
            <Server size={16} color={colors.textSecondary} />
            <Text className="text-xs text-slate-300 ml-2 font-medium">API Endpoint:</Text>
            <Text className="text-xs text-slate-400 ml-auto font-mono">{env.apiUrl}</Text>
          </View>
        </View>
      </View>

      <View className="bg-midnight-850 rounded-xl border border-midnight-700 p-4 mb-4">
        <View className="flex-row items-center">
          <Smartphone size={16} color={colors.textSecondary} />
          <Text className="text-xs text-slate-300 ml-2 font-medium">App Version:</Text>
          <Text className="text-xs text-slate-400 ml-auto font-mono">{env.appVersion} ({env.environment})</Text>
        </View>
      </View>
    </ScrollView>
  );
}

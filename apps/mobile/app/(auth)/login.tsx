import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { env } from '@/config/env';
import { colors } from '@/theme/colors';

export default function LoginScreen() {
  const router = useRouter();
  const [serverUrl, setServerUrl] = useState(env.apiUrl);
  const [token, setToken] = useState('');

  const handleConnect = () => {
    // Navigates to main app on pairing
    router.replace('/(tabs)');
  };

  return (
    <View className="flex-1 bg-midnight-950 p-6 justify-center">
      <View className="items-center mb-8">
        <Text className="text-3xl font-bold text-phantom-cyan mb-2">TASK HUB</Text>
        <Text className="text-sm text-slate-400">Mobile Command & Control</Text>
      </View>

      <View className="bg-midnight-850 p-5 rounded-xl border border-midnight-700 mb-6">
        <Text className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
          Server Endpoint URL
        </Text>
        <TextInput
          className="bg-midnight-900 text-slate-100 p-3 rounded-lg border border-midnight-600 mb-4 font-mono text-sm"
          value={serverUrl}
          onChangeText={setServerUrl}
          placeholder="http://localhost:8000"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
          Workspace Bearer Token
        </Text>
        <TextInput
          className="bg-midnight-900 text-slate-100 p-3 rounded-lg border border-midnight-600 mb-6 font-mono text-sm"
          value={token}
          onChangeText={setToken}
          placeholder="th_ws_..."
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
        />

        <TouchableOpacity
          className="bg-phantom-cyan p-4 rounded-lg items-center mb-3 active:opacity-80"
          onPress={handleConnect}
        >
          <Text className="text-midnight-950 font-bold text-base">Connect Session</Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="bg-midnight-700 p-4 rounded-lg items-center border border-midnight-600 active:opacity-80"
          onPress={() => router.push('/scanner')}
        >
          <Text className="text-slate-100 font-semibold text-sm">Scan QR Code from Web/Desktop</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

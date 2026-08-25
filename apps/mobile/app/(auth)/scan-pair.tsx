import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { QrCode, KeyRound, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react-native';
import { DevicePairingService, PairingStatus } from '@/services/devicePairing';
import { env } from '@/config/env';
import { colors } from '@/theme/colors';

export default function ScanPairScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    hub_url?: string;
    pairing_id?: string;
    device_secret?: string;
    code?: string;
    workspace_id?: string;
  }>();

  const [mode, setMode] = useState<'qr' | 'manual'>('qr');
  const [hubUrl, setHubUrl] = useState(params.hub_url || env.apiUrl);
  const [pairingId, setPairingId] = useState(params.pairing_id || '');
  const [deviceSecret, setDeviceSecret] = useState(params.device_secret || '');
  const [pairingCode, setPairingCode] = useState(params.code || '');

  const [, setPollingStatus] = useState<PairingStatus | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Auto-start polling if launched with params from QR scanner
  useEffect(() => {
    if (params.pairing_id && params.device_secret) {
      startStatusPolling(
        params.hub_url || env.apiUrl,
        params.pairing_id,
        params.device_secret
      );
    }
    return () => {
      abortControllerRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.pairing_id, params.device_secret]);

  const startStatusPolling = async (url: string, id: string, secret: string) => {
    setIsPolling(true);
    setPollingStatus('pending');
    setErrorMessage(null);

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const result = await DevicePairingService.pollPairingStatus(url, id, secret, {
        signal: controller.signal,
        onStatusChange: (status) => setPollingStatus(status),
      });

      if (result.status === 'approved') {
        setIsSuccess(true);
        await DevicePairingService.completePairing(result, url);
        setTimeout(() => {
          router.replace('/(tabs)');
        }, 1200);
      } else if (result.status === 'denied') {
        setErrorMessage('Pairing request was denied on the desktop or web console.');
        setIsPolling(false);
      } else if (result.status === 'expired') {
        setErrorMessage('Pairing request has expired. Please initiate a new pairing QR code.');
        setIsPolling(false);
      } else {
        setErrorMessage(`Pairing ended with status: ${result.status}`);
        setIsPolling(false);
      }
    } catch (err: any) {
      if (err.message !== 'Pairing status polling aborted') {
        setErrorMessage(err?.message || 'Pairing failed. Please check connection and try again.');
      }
      setIsPolling(false);
    }
  };

  const handleManualPairSubmit = () => {
    if (!pairingId.trim()) {
      setErrorMessage('Pairing ID is required');
      return;
    }
    if (!deviceSecret.trim() || deviceSecret.trim().length < 16) {
      setErrorMessage('Device secret must be at least 16 characters');
      return;
    }
    startStatusPolling(hubUrl, pairingId.trim(), deviceSecret.trim());
  };

  const handleCancelPolling = () => {
    abortControllerRef.current?.abort();
    setIsPolling(false);
    setPollingStatus(null);
    setErrorMessage(null);
  };

  return (
    <ScrollView
      className="flex-1 bg-midnight-950"
      contentContainerStyle={{ padding: 24, justifyContent: 'center', minHeight: '100%' }}
    >
      <View className="items-center mb-8">
        <Text className="text-2xl font-bold text-slate-100 mb-1">Device Pairing</Text>
        <Text className="text-xs text-slate-400 text-center">
          Pair mobile console with Task Hub Desktop or Web session
        </Text>
      </View>

      {/* Success State */}
      {isSuccess && (
        <View className="bg-midnight-850 p-6 rounded-2xl border border-phantom-mint/50 items-center mb-6">
          <CheckCircle2 size={48} color={colors.phantom.mint} />
          <Text className="text-lg font-bold text-slate-100 mt-4 mb-1">Pairing Approved!</Text>
          <Text className="text-xs text-slate-400 text-center">
            Security tokens stored securely in hardware keychain. Loading workspace...
          </Text>
          <ActivityIndicator size="small" color={colors.phantom.mint} className="mt-4" />
        </View>
      )}

      {/* Polling / Waiting State */}
      {isPolling && !isSuccess && (
        <View className="bg-midnight-850 p-6 rounded-2xl border border-midnight-700 items-center mb-6">
          <ActivityIndicator size="large" color={colors.phantom.cyan} />
          <Text className="text-base font-bold text-slate-100 mt-4 mb-1">
            Waiting for Authorization
          </Text>
          <Text className="text-xs text-slate-400 text-center mb-4 leading-4">
            Please approve the pairing prompt on your Task Hub desktop or web console.
          </Text>

          {pairingCode ? (
            <View className="bg-midnight-900 px-6 py-3 rounded-xl border border-midnight-600 mb-4 items-center">
              <Text className="text-xs text-slate-400 uppercase tracking-wider mb-1">
                Verification Code
              </Text>
              <Text className="text-2xl font-mono font-bold text-phantom-cyan tracking-widest">
                {pairingCode}
              </Text>
            </View>
          ) : null}

          <TouchableOpacity
            className="bg-midnight-750 px-5 py-2.5 rounded-lg border border-midnight-600 active:opacity-80"
            onPress={handleCancelPolling}
          >
            <Text className="text-slate-300 font-semibold text-xs">Cancel Pairing</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Error Banner */}
      {errorMessage && !isPolling && !isSuccess && (
        <View className="bg-talisman-cinnabar/15 p-4 rounded-xl border border-talisman-cinnabar/40 flex-row items-start mb-6 gap-3">
          <AlertTriangle size={20} color={colors.talisman.cinnabar} className="mt-0.5" />
          <View className="flex-1">
            <Text className="text-sm font-semibold text-talisman-cinnabar mb-1">Pairing Error</Text>
            <Text className="text-xs text-slate-300 leading-4">{errorMessage}</Text>
          </View>
        </View>
      )}

      {!isPolling && !isSuccess && (
        <>
          {/* Mode Switcher Tabs */}
          <View className="flex-row bg-midnight-850 p-1 rounded-xl border border-midnight-700 mb-6">
            <TouchableOpacity
              className={`flex-1 py-2.5 rounded-lg items-center flex-row justify-center gap-2 ${
                mode === 'qr' ? 'bg-midnight-700' : ''
              }`}
              onPress={() => setMode('qr')}
            >
              <QrCode size={16} color={mode === 'qr' ? colors.phantom.cyan : colors.textMuted} />
              <Text
                className={`text-xs font-semibold ${
                  mode === 'qr' ? 'text-phantom-cyan' : 'text-slate-400'
                }`}
              >
                Scan QR Code
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className={`flex-1 py-2.5 rounded-lg items-center flex-row justify-center gap-2 ${
                mode === 'manual' ? 'bg-midnight-700' : ''
              }`}
              onPress={() => setMode('manual')}
            >
              <KeyRound size={16} color={mode === 'manual' ? colors.phantom.cyan : colors.textMuted} />
              <Text
                className={`text-xs font-semibold ${
                  mode === 'manual' ? 'text-phantom-cyan' : 'text-slate-400'
                }`}
              >
                Manual Entry
              </Text>
            </TouchableOpacity>
          </View>

          {/* Mode 1: QR Scan Card */}
          {mode === 'qr' ? (
            <View className="bg-midnight-850 p-6 rounded-2xl border border-midnight-700 items-center">
              <View className="w-20 h-20 bg-midnight-900 rounded-2xl items-center justify-center border border-midnight-700 mb-4">
                <QrCode size={40} color={colors.phantom.cyan} />
              </View>
              <Text className="text-base font-bold text-slate-100 mb-2 text-center">
                Scan Desktop QR Code
              </Text>
              <Text className="text-xs text-slate-400 text-center mb-6 leading-5">
                Open Task Hub Desktop or Web Settings, click "Pair Mobile App", and align the QR code inside camera viewfinder.
              </Text>
              <TouchableOpacity
                className="w-full bg-phantom-cyan py-3.5 rounded-xl items-center flex-row justify-center gap-2 active:opacity-80"
                onPress={() => router.push('/scanner')}
              >
                <QrCode size={18} color={colors.midnight[950]} />
                <Text className="text-midnight-950 font-bold text-sm">Open QR Scanner</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* Mode 2: Manual Code Entry Form */
            <View className="bg-midnight-850 p-5 rounded-2xl border border-midnight-700">
              <Text className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Task Hub Server URL
              </Text>
              <TextInput
                className="bg-midnight-900 text-slate-100 p-3 rounded-lg border border-midnight-600 mb-4 font-mono text-xs"
                value={hubUrl}
                onChangeText={setHubUrl}
                placeholder="http://localhost:8000"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
              />

              <Text className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Pairing Session ID
              </Text>
              <TextInput
                className="bg-midnight-900 text-slate-100 p-3 rounded-lg border border-midnight-600 mb-4 font-mono text-xs"
                value={pairingId}
                onChangeText={setPairingId}
                placeholder="UUID or session ID"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
              />

              <Text className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Device Secret Key
              </Text>
              <TextInput
                className="bg-midnight-900 text-slate-100 p-3 rounded-lg border border-midnight-600 mb-4 font-mono text-xs"
                value={deviceSecret}
                onChangeText={setDeviceSecret}
                placeholder="64-character verifier secret"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                autoCapitalize="none"
              />

              <Text className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Verification Code (Optional)
              </Text>
              <TextInput
                className="bg-midnight-900 text-slate-100 p-3 rounded-lg border border-midnight-600 mb-6 font-mono text-xs uppercase"
                value={pairingCode}
                onChangeText={setPairingCode}
                placeholder="XXXX-YYYY"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="characters"
              />

              <TouchableOpacity
                className="w-full bg-phantom-cyan py-3.5 rounded-xl items-center flex-row justify-center gap-2 active:opacity-80"
                onPress={handleManualPairSubmit}
              >
                <Text className="text-midnight-950 font-bold text-sm">Verify & Connect</Text>
                <ArrowRight size={16} color={colors.midnight[950]} />
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

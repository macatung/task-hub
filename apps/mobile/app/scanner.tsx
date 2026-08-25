import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { QRCameraScanner } from '@/components/scanner/QRCameraScanner';
import { QRScannerService } from '@/services/qrScanner';
import { DevicePairingService } from '@/services/devicePairing';
import { AlertCircle, RefreshCw } from 'lucide-react-native';
import { colors } from '@/theme/colors';

export default function FullscreenScannerScreen() {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleScanned = async (rawData: string) => {
    if (isProcessing) return;
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const validationResult = QRScannerService.parseAndValidateQrPayload(rawData);

      if (!validationResult.success) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setErrorMessage(validationResult.error);
        setIsProcessing(false);
        return;
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const payload = validationResult.payload;

      if (payload.token) {
        // Direct bearer token present in QR payload: complete immediately
        await DevicePairingService.completePairing(payload);
        router.replace('/(tabs)');
      } else {
        // Pairing session payload needing desktop approval / polling
        router.replace({
          pathname: '/(auth)/scan-pair',
          params: {
            hub_url: payload.task_hub_url,
            pairing_id: payload.pairing_id,
            device_secret: payload.device_secret,
            code: payload.code || '',
            workspace_id: payload.workspace_id ? String(payload.workspace_id) : '',
          },
        });
      }
    } catch (err: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrorMessage(err?.message || 'Failed to process QR code');
      setIsProcessing(false);
    }
  };

  return (
    <View className="flex-1 bg-midnight-950">
      <QRCameraScanner
        isActive={!isProcessing && !errorMessage}
        onScanned={handleScanned}
        onCancel={() => router.back()}
      />

      {/* Processing Spinner Overlay */}
      {isProcessing && !errorMessage && (
        <View className="absolute inset-0 bg-midnight-950/80 items-center justify-center p-6">
          <ActivityIndicator size="large" color={colors.phantom.cyan} />
          <Text className="text-base font-bold text-slate-100 mt-4">
            Connecting to Task Hub...
          </Text>
          <Text className="text-xs text-slate-400 mt-1">Exchanging security tokens</Text>
        </View>
      )}

      {/* Error Banner Modal Overlay */}
      {errorMessage && (
        <View className="absolute inset-0 bg-midnight-950/90 items-center justify-center p-6">
          <View className="w-full bg-midnight-850 p-6 rounded-2xl border border-talisman-cinnabar/40 items-center">
            <View className="w-12 h-12 bg-talisman-cinnabar/20 rounded-full items-center justify-center mb-3">
              <AlertCircle size={24} color={colors.talisman.cinnabar} />
            </View>
            <Text className="text-lg font-bold text-slate-100 mb-2 text-center">
              Invalid QR Code
            </Text>
            <Text className="text-xs text-slate-300 text-center mb-6 leading-4">
              {errorMessage}
            </Text>
            <View className="flex-row gap-3 w-full">
              <TouchableOpacity
                className="flex-1 bg-midnight-700 py-3 rounded-lg items-center border border-midnight-600 active:opacity-80"
                onPress={() => router.back()}
              >
                <Text className="text-slate-200 font-semibold text-sm">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 bg-phantom-cyan py-3 rounded-lg items-center flex-row justify-center gap-2 active:opacity-80"
                onPress={() => {
                  setErrorMessage(null);
                  setIsProcessing(false);
                }}
              >
                <RefreshCw size={16} color={colors.midnight[950]} />
                <Text className="text-midnight-950 font-bold text-sm">Try Again</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

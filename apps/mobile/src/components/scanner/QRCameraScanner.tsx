import React, { useState, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { X, Zap, ZapOff, Camera } from 'lucide-react-native';
import { colors } from '@/theme/colors';

export interface QRCameraScannerProps {
  onScanned: (data: string) => void;
  onCancel?: () => void;
  isActive?: boolean;
  scanDelay?: number;
  testID?: string;
}

export function QRCameraScanner({
  onScanned,
  onCancel,
  isActive = true,
  scanDelay = 1500,
  testID = 'qr-camera-scanner',
}: QRCameraScannerProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [torchEnabled, setTorchEnabled] = useState(false);
  const lastScanTimestamp = useRef<number>(0);

  const handleBarcodeScanned = useCallback(
    ({ data }: { data: string }) => {
      if (!isActive) return;
      const now = Date.now();
      if (now - lastScanTimestamp.current < scanDelay) return;
      lastScanTimestamp.current = now;
      onScanned(data);
    },
    [isActive, onScanned, scanDelay]
  );

  // Permission Loading State
  if (!permission) {
    return (
      <View testID={testID} className="flex-1 bg-midnight-950 items-center justify-center p-6">
        <ActivityIndicator size="large" color={colors.phantom.cyan} />
        <Text className="text-sm text-slate-400 mt-4">Initializing camera...</Text>
      </View>
    );
  }

  // Permission Denied State
  if (!permission.granted) {
    return (
      <View testID={testID} className="flex-1 bg-midnight-950 items-center justify-center p-6">
        <View className="w-16 h-16 bg-midnight-800 rounded-full items-center justify-center mb-4 border border-midnight-700">
          <Camera size={32} color={colors.phantom.cyan} />
        </View>
        <Text className="text-xl font-bold text-slate-100 mb-2 text-center">
          Camera Access Needed
        </Text>
        <Text className="text-sm text-slate-400 text-center mb-6 leading-5">
          Task Hub requires camera access to scan pairing QR codes from your desktop or web console.
        </Text>
        <TouchableOpacity
          testID="grant-camera-permission-btn"
          className="bg-phantom-cyan px-6 py-3 rounded-lg active:opacity-80 mb-3"
          onPress={requestPermission}
        >
          <Text className="text-midnight-950 font-bold text-sm">Grant Permission</Text>
        </TouchableOpacity>
        {onCancel && (
          <TouchableOpacity
            testID="cancel-camera-permission-btn"
            className="p-3"
            onPress={onCancel}
          >
            <Text className="text-slate-400 font-semibold text-sm">Cancel</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View testID={testID} className="flex-1 bg-black">
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        enableTorch={torchEnabled}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
        onBarcodeScanned={handleBarcodeScanned}
      />

      {/* Viewfinder & Overlay UI */}
      <View className="flex-1 justify-between p-6 bg-black/40">
        {/* Top Header */}
        <View className="flex-row justify-between items-center pt-8">
          <TouchableOpacity
            testID="toggle-torch-btn"
            className="bg-midnight-900/80 p-3 rounded-full border border-midnight-700/60 active:opacity-80"
            onPress={() => setTorchEnabled((prev) => !prev)}
          >
            {torchEnabled ? (
              <Zap size={20} color={colors.talisman.yellow} />
            ) : (
              <ZapOff size={20} color={colors.textSecondary} />
            )}
          </TouchableOpacity>

          <Text className="text-base font-bold text-slate-100">Scan Pairing Code</Text>

          {onCancel ? (
            <TouchableOpacity
              testID="close-scanner-btn"
              className="bg-midnight-900/80 p-3 rounded-full border border-midnight-700/60 active:opacity-80"
              onPress={onCancel}
            >
              <X size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          ) : (
            <View className="w-11" />
          )}
        </View>

        {/* Center Target Frame */}
        <View className="items-center justify-center">
          <View
            testID="qr-target-box"
            className="w-64 h-64 relative items-center justify-center"
          >
            {/* 4 Corner Markers */}
            <View className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-phantom-cyan rounded-tl-lg" />
            <View className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-phantom-cyan rounded-tr-lg" />
            <View className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-phantom-cyan rounded-bl-lg" />
            <View className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-phantom-cyan rounded-br-lg" />

            {/* Faint Inner Viewfinder */}
            <View className="w-56 h-56 border border-dashed border-phantom-cyan/30 rounded-lg items-center justify-center">
              <Text className="text-xs text-phantom-cyan/80 text-center px-4 font-medium">
                Align QR Code in frame
              </Text>
            </View>
          </View>
        </View>

        {/* Bottom Hint */}
        <View className="pb-8 items-center">
          <View className="bg-midnight-900/90 px-5 py-3 rounded-xl border border-midnight-700/60">
            <Text className="text-xs text-slate-300 text-center">
              Scan QR code from Task Hub Desktop or Web
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { colors } from '@/theme/colors';

export interface MermaidDiagramProps {
  chart: string;
  title?: string;
}

export const MermaidDiagram: React.FC<MermaidDiagramProps> = ({ chart, title }) => {
  const [showCode, setShowCode] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [height, setHeight] = useState(250);
  const [hasError, setHasError] = useState(false);

  const handleZoomIn = () => setZoomLevel((z) => Math.min(z + 0.25, 3));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(z - 0.25, 0.5));
  const handleResetZoom = () => setZoomLevel(1);

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'height' && typeof data.height === 'number') {
        setHeight(Math.max(data.height + 20, 150));
      } else if (data.type === 'error') {
        setHasError(true);
      }
    } catch {
      // Ignored
    }
  };

  const escapedChart = chart.replace(/\\/g, '\\\\').replace(/`/g, '\\`');

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=yes">
        <style>
          body {
            margin: 0;
            padding: 12px;
            background-color: ${colors.midnight[950]};
            color: ${colors.textPrimary};
            font-family: -apple-system, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            overflow: auto;
          }
          #container {
            width: 100%;
            transform-origin: top center;
            transform: scale(${zoomLevel});
          }
          svg {
            max-width: 100% !important;
            height: auto !important;
          }
        </style>
        <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
      </head>
      <body>
        <div id="container" class="mermaid">
          ${escapedChart}
        </div>
        <script>
          try {
            mermaid.initialize({
              startOnLoad: true,
              theme: 'dark',
              themeVariables: {
                darkMode: true,
                background: '${colors.midnight[950]}',
                primaryColor: '${colors.phantom.cyan}',
                primaryTextColor: '${colors.midnight[950]}',
                primaryBorderColor: '${colors.phantom.cyan}',
                lineColor: '${colors.phantom.blue}',
                secondaryColor: '${colors.surfaceHighlight}',
                tertiaryColor: '${colors.surfaceCard}'
              }
            });
            setTimeout(() => {
              const h = document.body.scrollHeight;
              window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'height', height: h }));
            }, 300);
          } catch(e) {
            window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'error', message: e.message }));
          }
        </script>
      </body>
    </html>
  `;

  return (
    <View style={styles.container} testID="mermaid-diagram-container">
      {/* Header with Title & Action Controls */}
      <View style={styles.headerRow} testID="mermaid-header">
        <Text style={styles.titleText} numberOfLines={1}>
          📊 {title || 'Architecture Diagram'}
        </Text>

        <View style={styles.controlsRow}>
          {/* Zoom controls */}
          <TouchableOpacity onPress={handleZoomOut} style={styles.btnSmall} testID="zoom-out-btn">
            <Text style={styles.btnText}>-</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleResetZoom} style={styles.btnSmall} testID="zoom-reset-btn">
            <Text style={styles.btnText}>{`${Math.round(zoomLevel * 100)}%`}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleZoomIn} style={styles.btnSmall} testID="zoom-in-btn">
            <Text style={styles.btnText}>+</Text>
          </TouchableOpacity>

          {/* Toggle Code / Diagram */}
          <TouchableOpacity
            onPress={() => setShowCode(!showCode)}
            style={[styles.btnSmall, styles.toggleBtn]}
            testID="toggle-code-btn"
          >
            <Text style={styles.toggleBtnText}>{showCode ? 'Diagram' : 'Code'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Content Area */}
      {showCode || hasError ? (
        <View style={styles.codeContainer} testID="mermaid-raw-code-container">
          <Text style={styles.codeText} testID="mermaid-raw-code">
            {chart}
          </Text>
        </View>
      ) : (
        <View style={[styles.webviewWrapper, { height }]} testID="mermaid-webview-wrapper">
          <WebView
            testID="mermaid-webview"
            originWhitelist={['*']}
            source={{ html: htmlContent }}
            onMessage={handleMessage}
            scrollEnabled={true}
            style={styles.webview}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceCard,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginVertical: 8,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  titleText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  btnSmall: {
    backgroundColor: colors.surfaceHighlight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  btnText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  toggleBtn: {
    backgroundColor: 'rgba(0, 245, 212, 0.15)',
    borderWidth: 1,
    borderColor: colors.phantom.cyan,
  },
  toggleBtnText: {
    color: colors.phantom.cyan,
    fontSize: 11,
    fontWeight: '700',
  },
  webviewWrapper: {
    width: '100%',
    backgroundColor: colors.midnight[950],
  },
  webview: {
    backgroundColor: colors.midnight[950],
  },
  codeContainer: {
    padding: 12,
    backgroundColor: colors.midnight[950],
  },
  codeText: {
    fontFamily: 'Courier',
    fontSize: 12,
    color: colors.phantom.mint,
  },
});
